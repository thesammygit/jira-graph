import type { Capabilities, Graph } from '../core/model';
import { normalizeIssues } from '../core/normalize';
import { neighborhood } from '../graph/depth';
import type { DataProvider, NodeSummary } from './DataProvider';

/**
 * Demonstrates the lazy-loading contract against fixture data: roots arrive
 * first, children stream in per level as the Show depth asks for them —
 * exactly how the JiraProvider behaves against a live instance, minus the
 * network. A small artificial delay makes the loading states visible.
 */
export class LazyMockProvider implements DataProvider {
  readonly lazy = true;
  readonly sizeHint: number;
  private graph: Graph;
  private childrenOf = new Map<string, Set<string>>();
  private hasParent = new Set<string>();
  constructor(rawIssues: any[], private caps: Capabilities, private delayMs = 250) {
    this.graph = normalizeIssues(rawIssues, caps);
    this.sizeHint = this.graph.nodes.length;
    for (const e of this.graph.edges) {
      if (e.kind !== 'hierarchy') continue;
      const set = this.childrenOf.get(e.source) ?? new Set();
      if (!this.childrenOf.has(e.source)) this.childrenOf.set(e.source, set);
      set.add(e.target);
      this.hasParent.add(e.target);
    }
  }

  private slice(keys: Set<string>): Graph {
    // nodes in the slice + EVERY edge touching them (dangling ends resolve
    // as later levels arrive; consumers skip unresolved endpoints)
    return {
      nodes: this.graph.nodes.filter((n) => keys.has(n.key)),
      edges: this.graph.edges.filter((e) => keys.has(e.source) || keys.has(e.target)),
    };
  }
  private async delay() { await new Promise((r) => setTimeout(r, this.delayMs)); }

  async capabilities(): Promise<Capabilities> { return this.caps; }
  async getGraph(): Promise<Graph> { return this.getRoots(); }

  async getRoots(): Promise<Graph> {
    await this.delay();
    return this.slice(new Set(this.graph.nodes.filter((n) => !this.hasParent.has(n.key)).map((n) => n.key)));
  }

  async getChildren(parentKeys: string[]): Promise<Graph> {
    await this.delay();
    const keys = new Set<string>();
    for (const p of parentKeys) for (const c of this.childrenOf.get(p) ?? []) keys.add(c);
    return this.slice(keys);
  }

  async getNeighborhood(focusKey: string, depth: number): Promise<Graph> { return neighborhood(this.graph, focusKey, depth); }
  async search(query: string): Promise<NodeSummary[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return this.graph.nodes
      .filter((n) => n.key.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q))
      .map((n) => ({ key: n.key, summary: n.summary, kind: n.type.kind }));
  }
}
