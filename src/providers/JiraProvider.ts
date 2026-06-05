import type { Capabilities, Graph } from '../core/model';
import { normalizeIssues } from '../core/normalize';
import { neighborhood } from '../graph/depth';
import type { DataProvider, NodeSummary } from './DataProvider';

/**
 * Wired up at work behind a thin auth/CORS proxy. Detects Epic Link via
 * /rest/api/2/field, then fetches issues via /search/jql and normalizes them
 * with the SAME normalize() the MockProvider uses.
 */
export class JiraProvider implements DataProvider {
  private cache?: Graph;
  constructor(private baseUrl: string, private fetchFn: typeof fetch = fetch) {}

  async capabilities(): Promise<Capabilities> {
    const res = await this.fetchFn(`${this.baseUrl}/rest/api/3/field`);
    const fields: Array<{ id: string; name: string }> = await res.json();
    const epic = fields.find((f) => f.name === 'Epic Link');
    const points = fields.find((f) => f.name === 'Story Points' || f.name === 'Story point estimate');
    const start = fields.find((f) => f.name === 'Start date' || f.name === 'Start Date');
    const sprint = fields.find((f) => f.name === 'Sprint');
    return {
      apiVersion: 3, baseUrl: this.baseUrl,
      hasEpicLink: !!epic, epicLinkFieldId: epic?.id, storyPointsFieldId: points?.id,
      startDateFieldId: start?.id, sprintFieldId: sprint?.id,
    };
  }

  private async load(): Promise<Graph> {
    if (this.cache) return this.cache;
    const caps = await this.capabilities();
    // TODO(work): page through GET /rest/api/3/search/jql (token pagination) with a JQL filter.
    const res = await this.fetchFn(`${this.baseUrl}/rest/api/3/search/jql?fields=*all`);
    const data = await res.json();
    this.cache = normalizeIssues(data.issues ?? [], caps);
    return this.cache;
  }

  async getGraph(): Promise<Graph> { return this.load(); }
  async getNeighborhood(focusKey: string, depth: number): Promise<Graph> { return neighborhood(await this.load(), focusKey, depth); }
  async search(query: string): Promise<NodeSummary[]> {
    const q = query.toLowerCase();
    return (await this.load()).nodes.filter((n) => n.key.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q))
      .map((n) => ({ key: n.key, summary: n.summary, kind: n.type.kind }));
  }
}
