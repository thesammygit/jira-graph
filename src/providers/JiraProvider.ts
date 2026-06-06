import type { Capabilities, Graph } from '../core/model';
import { normalizeIssues } from '../core/normalize';
import { neighborhood } from '../graph/depth';
import { MemoryCache, type IssueCache } from '../core/cache';
import type { DataProvider, NodeSummary } from './DataProvider';

export interface JiraProviderOpts {
  /** Scope the fetch — e.g. `project = CHK`. Defaults to every issue visible to the user. */
  jql?: string;
  fetchFn?: typeof fetch;
  /** Issue-payload cache (IndexedDB in the app); reopening fetches only the `updated >=` delta. */
  cache?: IssueCache;
  onProgress?: (loaded: number) => void;
  pageSize?: number;
}

/** Only the fields the visualizer reads — never `*all` (10–20× the bytes). */
const BASE_FIELDS = ['summary', 'issuetype', 'status', 'priority', 'assignee', 'project', 'labels', 'components', 'parent', 'issuelinks', 'duedate'];

/**
 * Live Jira provider, built for projects with thousands of tickets:
 *  - token pagination through /rest/api/3/search/jql (the modern endpoint;
 *    startAt-based search is deprecated), 100 issues per page
 *  - strict fields whitelist (capabilities-detected custom fields included)
 *  - payload cache + delta sync: reopening reads the cache and fetches only
 *    issues `updated >=` the last sync
 *  - lazy mode: getRoots() pulls just the epics, getChildren() pulls one
 *    level at a time with batched `parent in (…)` JQL
 * Wired up at work behind a thin auth/CORS proxy. Epic Link is detected via
 * /rest/api/3/field; everything normalizes through the same normalize() the
 * MockProvider uses.
 */
export class JiraProvider implements DataProvider {
  private capsP?: Promise<Capabilities>;
  private graphP?: Promise<Graph>;
  private cache: IssueCache;
  constructor(private baseUrl: string, private opts: JiraProviderOpts = {}) {
    this.cache = opts.cache ?? new MemoryCache();
  }
  private get fetchFn() { return this.opts.fetchFn ?? fetch; }

  async capabilities(): Promise<Capabilities> {
    this.capsP ??= (async () => {
      const res = await this.fetchFn(`${this.baseUrl}/rest/api/3/field`);
      const fields: Array<{ id: string; name: string }> = await res.json();
      const epic = fields.find((f) => f.name === 'Epic Link');
      const points = fields.find((f) => f.name === 'Story Points' || f.name === 'Story point estimate');
      const start = fields.find((f) => f.name === 'Start date' || f.name === 'Start Date');
      const sprint = fields.find((f) => f.name === 'Sprint');
      return {
        apiVersion: 3 as const, baseUrl: this.baseUrl,
        hasEpicLink: !!epic, epicLinkFieldId: epic?.id, storyPointsFieldId: points?.id,
        startDateFieldId: start?.id, sprintFieldId: sprint?.id,
      };
    })();
    return this.capsP;
  }

  private fieldsParam(caps: Capabilities): string {
    return [...BASE_FIELDS, caps.epicLinkFieldId, caps.storyPointsFieldId, caps.startDateFieldId, caps.sprintFieldId]
      .filter(Boolean).join(',');
  }

  /** Page through /search/jql with nextPageToken until exhausted. */
  private async fetchPages(jql: string, caps: Capabilities): Promise<any[]> {
    const out: any[] = [];
    const pageSize = this.opts.pageSize ?? 100;
    let token: string | undefined;
    do {
      const params = new URLSearchParams({ jql, fields: this.fieldsParam(caps), maxResults: String(pageSize) });
      if (token) params.set('nextPageToken', token);
      const res = await this.fetchFn(`${this.baseUrl}/rest/api/3/search/jql?${params}`);
      if (!res.ok) throw new Error(`Jira search failed: ${res.status}`);
      const data = await res.json();
      out.push(...(data.issues ?? []));
      this.opts.onProgress?.(out.length);
      token = data.nextPageToken || undefined;
    } while (token);
    return out;
  }

  private scoped(extra?: string): string {
    const base = this.opts.jql?.trim();
    if (base && extra) return `(${base}) AND ${extra}`;
    return extra ?? base ?? '';
  }

  private async load(): Promise<Graph> {
    this.graphP ??= (async () => {
      const caps = await this.capabilities();
      const cacheKey = `${this.baseUrl}::${this.scoped()}`;
      const cached = await this.cache.get(cacheKey);
      let issues: any[];
      if (cached) {
        // Delta sync: only what changed since the last visit.
        const delta = await this.fetchPages(this.scoped(`updated >= "${cached.lastSync}"`), caps);
        const byKey = new Map(cached.issues.map((i: any) => [i.key, i]));
        for (const i of delta) byKey.set(i.key, i);
        issues = [...byKey.values()];
      } else {
        issues = await this.fetchPages(this.scoped(), caps);
      }
      await this.cache.set(cacheKey, { issues, lastSync: jqlTimestamp(new Date()) });
      return normalizeIssues(issues, caps);
    })();
    return this.graphP;
  }

  async getGraph(): Promise<Graph> { return this.load(); }

  /** Lazy mode: epics only — ~1–2 pages even on a 50k-ticket instance. */
  async getRoots(): Promise<Graph> {
    const caps = await this.capabilities();
    return normalizeIssues(await this.fetchPages(this.scoped('issuetype = Epic'), caps), caps);
  }

  /** One hierarchy level down, batched 50 parents per JQL call. */
  async getChildren(parentKeys: string[]): Promise<Graph> {
    const caps = await this.capabilities();
    const issues: any[] = [];
    for (let i = 0; i < parentKeys.length; i += 50) {
      const batch = parentKeys.slice(i, i + 50);
      issues.push(...await this.fetchPages(this.scoped(`parent in (${batch.join(',')})`), caps));
    }
    return normalizeIssues(issues, caps);
  }

  async getNeighborhood(focusKey: string, depth: number): Promise<Graph> { return neighborhood(await this.load(), focusKey, depth); }
  async search(query: string): Promise<NodeSummary[]> {
    const q = query.toLowerCase();
    return (await this.load()).nodes.filter((n) => n.key.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q))
      .map((n) => ({ key: n.key, summary: n.summary, kind: n.type.kind }));
  }
}

/** Jira JQL timestamp: `yyyy-MM-dd HH:mm`. */
export function jqlTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
