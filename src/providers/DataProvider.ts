import type { Capabilities, Graph, IssueKind } from '../core/model';

export interface NodeSummary { key: string; summary: string; kind: IssueKind }

export interface DataProvider {
  capabilities(): Promise<Capabilities>;
  getGraph(): Promise<Graph>;
  getNeighborhood(focusKey: string, depth: number): Promise<Graph>;
  search(query: string): Promise<NodeSummary[]>;
}
