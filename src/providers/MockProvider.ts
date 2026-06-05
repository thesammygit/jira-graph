import type { Capabilities, Graph } from '../core/model';
import { normalizeIssues } from '../core/normalize';
import { neighborhood } from '../graph/depth';
import type { DataProvider, NodeSummary } from './DataProvider';

export class MockProvider implements DataProvider {
  private graph: Graph;
  constructor(rawIssues: any[], private caps: Capabilities) {
    this.graph = normalizeIssues(rawIssues, caps);
  }
  async capabilities(): Promise<Capabilities> { return this.caps; }
  async getGraph(): Promise<Graph> { return this.graph; }
  async getNeighborhood(focusKey: string, depth: number): Promise<Graph> {
    return neighborhood(this.graph, focusKey, depth);
  }
  async search(query: string): Promise<NodeSummary[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return this.graph.nodes
      .filter((n) => n.key.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q))
      .map((n) => ({ key: n.key, summary: n.summary, kind: n.type.kind }));
  }
}
