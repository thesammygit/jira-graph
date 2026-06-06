import { normalizeIssue, normalizeIssues } from './normalize';
import type { Capabilities } from './model';

const base: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false };

test('v3 parent of an Epic produces an epic hierarchy edge', () => {
  const raw = { key: 'STORY-10', fields: {
    summary: 's', issuetype: { name: 'Story', subtask: false }, status: {},
    parent: { key: 'EPIC-1', fields: { issuetype: { name: 'Epic', subtask: false } } },
  }};
  const { edges } = normalizeIssue(raw, base);
  expect(edges).toHaveLength(1);
  expect(edges[0]).toMatchObject({ kind: 'hierarchy', relation: 'epic', source: 'EPIC-1', target: 'STORY-10', directed: true });
  expect(edges[0].id).toBe('hier:epic:EPIC-1->STORY-10');
});

test('subtask parent produces a subtask edge', () => {
  const raw = { key: 'SUB-30', fields: {
    summary: 's', issuetype: { name: 'Sub-task', subtask: true }, status: {},
    parent: { key: 'TASK-20', fields: { issuetype: { name: 'Task', subtask: false } } },
  }};
  const { edges } = normalizeIssue(raw, base);
  expect(edges[0]).toMatchObject({ relation: 'subtask', source: 'TASK-20', target: 'SUB-30' });
});

test('legacy Epic Link is read by configured field id when capability present', () => {
  const caps: Capabilities = { ...base, hasEpicLink: true, epicLinkFieldId: 'customfield_10014' };
  const raw = { key: 'STORY-77', fields: {
    summary: 's', issuetype: { name: 'Story', subtask: false }, status: {},
    customfield_10014: 'EPIC-9',
  }};
  const { edges } = normalizeIssue(raw, caps);
  expect(edges[0]).toMatchObject({ relation: 'epic', source: 'EPIC-9', target: 'STORY-77' });
});

test('Epic Link absent (capability off) yields no epic edge', () => {
  const raw = { key: 'STORY-77', fields: {
    summary: 's', issuetype: { name: 'Story', subtask: false }, status: {},
    customfield_10014: 'EPIC-9',
  }};
  const { edges } = normalizeIssue(raw, base);
  expect(edges).toHaveLength(0);
});

test('parent field takes precedence over a present Epic Link', () => {
  const caps: Capabilities = { ...base, hasEpicLink: true, epicLinkFieldId: 'customfield_10014' };
  const raw = { key: 'STORY-10', fields: {
    summary: 's', issuetype: { name: 'Story', subtask: false }, status: {},
    parent: { key: 'EPIC-1', fields: { issuetype: { name: 'Epic', subtask: false } } },
    customfield_10014: 'EPIC-9', // should be ignored because parent wins
  }};
  const { edges } = normalizeIssue(raw, caps);
  expect(edges).toHaveLength(1);
  expect(edges[0]).toMatchObject({ relation: 'epic', source: 'EPIC-1', target: 'STORY-10' });
});

test('WBSGantt "Hierarchy link" issue links become real hierarchy edges (epic nests epic)', () => {
  const caps: any = { apiVersion: 2, baseUrl: 'https://x.invalid', hasEpicLink: false };
  const issues = [
    { key: 'EP-1', fields: { summary: 'Parent epic', issuetype: { name: 'Epic', subtask: false },
      status: { name: 'Open', statusCategory: { key: 'new' } },
      issuelinks: [{ type: { name: 'Hierarchy link (WBSGantt)', inward: 'is contained in', outward: 'contains' }, outwardIssue: { key: 'EP-2' } }] } },
    { key: 'EP-2', fields: { summary: 'Child epic', issuetype: { name: 'Epic', subtask: false },
      status: { name: 'Open', statusCategory: { key: 'new' } } } },
  ];
  const g = normalizeIssues(issues, caps);
  const hier = g.edges.find((e: any) => e.kind === 'hierarchy');
  expect(hier).toBeTruthy();
  expect(hier!.source).toBe('EP-1'); // parent contains child
  expect(hier!.target).toBe('EP-2');
  expect(g.edges.some((e: any) => e.kind === 'link')).toBe(false); // promoted, not duplicated
});

test('WBSGantt link stays a plain wire when the child already has a parent', () => {
  const caps: any = { apiVersion: 2, baseUrl: 'https://x.invalid', hasEpicLink: false };
  const issues = [
    { key: 'EP-1', fields: { summary: 'e', issuetype: { name: 'Epic', subtask: false }, status: { name: 'O', statusCategory: { key: 'new' } },
      issuelinks: [{ type: { name: 'Hierarchy link (WBSGantt)', inward: 'is contained in', outward: 'contains' }, outwardIssue: { key: 'ST-1' } }] } },
    { key: 'EP-9', fields: { summary: 'e9', issuetype: { name: 'Epic', subtask: false }, status: { name: 'O', statusCategory: { key: 'new' } } } },
    { key: 'ST-1', fields: { summary: 's', issuetype: { name: 'Story', subtask: false }, status: { name: 'O', statusCategory: { key: 'new' } },
      parent: { key: 'EP-9', fields: { issuetype: { name: 'Epic', subtask: false } } } } },
  ];
  const g = normalizeIssues(issues, caps);
  // real parent wins; the WBSGantt link survives as a visible wire, no second parent
  expect(g.edges.filter((e: any) => e.kind === 'hierarchy' && e.target === 'ST-1')).toHaveLength(1);
  expect(g.edges.find((e: any) => e.kind === 'hierarchy' && e.target === 'ST-1')!.source).toBe('EP-9');
  expect(g.edges.some((e: any) => e.kind === 'link' && e.target === 'ST-1')).toBe(true);
});
