import type { Capabilities, Graph, IssueKind } from '../core/model';

export interface NodeSummary { key: string; summary: string; kind: IssueKind }

export interface DataProvider {
  capabilities(): Promise<Capabilities>;
  getGraph(): Promise<Graph>;
  getNeighborhood(focusKey: string, depth: number): Promise<Graph>;
  search(query: string): Promise<NodeSummary[]>;

  /** Lazy-loading providers serve roots first and children on demand —
   *  the app fetches deeper levels only when the Show depth asks for them. */
  lazy?: boolean;
  /** Rough total size, so scale-aware defaults apply before everything loads. */
  sizeHint?: number;
  /** Hierarchy roots only (epics + loose tickets). */
  getRoots?(): Promise<Graph>;
  /** Direct children of the given parents (one level down). */
  getChildren?(parentKeys: string[]): Promise<Graph>;
}
