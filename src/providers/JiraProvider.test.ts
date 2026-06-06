import { JiraProvider, jqlTimestamp } from './JiraProvider';
import { MemoryCache } from '../core/cache';

const FIELDS_RESPONSE = [
  { id: 'customfield_10014', name: 'Epic Link' },
  { id: 'customfield_10016', name: 'Story Points' },
  { id: 'customfield_10020', name: 'Sprint' },
];

function issue(key: string, type = 'Task', parent?: string): any {
  return {
    key,
    fields: {
      summary: `Summary ${key}`,
      issuetype: { name: type, subtask: false },
      status: { name: 'To Do', statusCategory: { key: 'new' } },
      project: { key: key.split('-')[0], name: key.split('-')[0] },
      labels: [], components: [],
      ...(parent ? { parent: { key: parent, fields: { issuetype: { name: 'Epic', subtask: false } } } } : {}),
    },
  };
}

/** fetch stub that records every URL and serves canned pages. */
function fakeFetch(pages: Record<string, any[][]>) {
  const calls: string[] = [];
  const pageIndex = new Map<string, number>();
  const fn = (async (url: string) => {
    calls.push(url);
    if (url.includes('/rest/api/3/field')) {
      return { ok: true, json: async () => FIELDS_RESPONSE } as Response;
    }
    const u = new URL(url);
    const jql = u.searchParams.get('jql') ?? '';
    const match = Object.keys(pages).find((k) => jql.includes(k)) ?? '';
    const seq = pages[match] ?? [[]];
    const i = Math.min(pageIndex.get(match) ?? 0, seq.length - 1);
    pageIndex.set(match, i + 1);
    return {
      ok: true,
      json: async () => ({ issues: seq[i], nextPageToken: i < seq.length - 1 ? `tok${i + 1}` : undefined }),
    } as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test('pages through nextPageToken with a strict fields whitelist (never *all)', async () => {
  const { fn, calls } = fakeFetch({ '': [[issue('A-1')], [issue('A-2')], [issue('A-3')]] });
  const progress: number[] = [];
  const p = new JiraProvider('https://x.test', { fetchFn: fn, onProgress: (n) => progress.push(n) });
  const g = await p.getGraph();
  expect(g.nodes.map((n) => n.key).sort()).toEqual(['A-1', 'A-2', 'A-3']);
  const searches = calls.filter((c) => c.includes('search/jql'));
  expect(searches).toHaveLength(3); // 3 pages
  expect(searches[1]).toContain('nextPageToken=tok1');
  for (const s of searches) {
    expect(s).toContain('fields=summary');
    expect(s).toContain('customfield_10014'); // detected Epic Link rides along
    expect(s).not.toContain('*all');
  }
  expect(progress).toEqual([1, 2, 3]);
});

test('delta sync: cached issues + only `updated >=` fetched, merged by key', async () => {
  const cache = new MemoryCache();
  await cache.set('https://x.test::', {
    issues: [issue('A-1'), issue('A-2')],
    lastSync: '2026-06-01 09:00',
  });
  const { fn, calls } = fakeFetch({ 'updated >=': [[{ ...issue('A-2'), fields: { ...issue('A-2').fields, summary: 'UPDATED' } }, issue('A-9')]] });
  const p = new JiraProvider('https://x.test', { fetchFn: fn, cache });
  const g = await p.getGraph();
  const deltaCall = calls.find((c) => c.includes('updated'));
  expect(deltaCall).toBeTruthy();
  expect(decodeURIComponent(deltaCall!.replaceAll('+', ' '))).toContain('updated >= "2026-06-01 09:00"');
  expect(g.nodes.map((n) => n.key).sort()).toEqual(['A-1', 'A-2', 'A-9']);
  expect(g.nodes.find((n) => n.key === 'A-2')!.summary).toBe('UPDATED');
});

test('lazy mode: getRoots fetches epics, getChildren batches parent-in JQL', async () => {
  const { fn, calls } = fakeFetch({
    'issuetype = Epic': [[issue('A-1', 'Epic')]],
    'parent in': [[issue('A-2', 'Story', 'A-1')]],
  });
  const p = new JiraProvider('https://x.test', { fetchFn: fn });
  const roots = await p.getRoots!();
  expect(roots.nodes.map((n) => n.key)).toEqual(['A-1']);
  const kids = await p.getChildren!(['A-1']);
  expect(kids.nodes.map((n) => n.key)).toEqual(['A-2']);
  const childCall = decodeURIComponent(calls[calls.length - 1].replaceAll('+', ' '));
  expect(childCall).toContain('parent in (A-1)');
});

test('jql scoping wraps user JQL around every request', async () => {
  const { fn, calls } = fakeFetch({ '': [[issue('A-1', 'Epic')]] });
  const p = new JiraProvider('https://x.test', { fetchFn: fn, jql: 'project = CHK' });
  await p.getRoots!();
  expect(decodeURIComponent(calls[calls.length - 1].replaceAll('+', ' '))).toContain('(project = CHK) AND issuetype = Epic');
});

test('jqlTimestamp formats for JQL', () => {
  expect(jqlTimestamp(new Date(2026, 5, 6, 9, 5))).toBe('2026-06-06 09:05');
});
