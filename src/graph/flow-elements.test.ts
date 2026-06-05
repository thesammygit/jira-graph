import { toFlowElements } from './flow-elements';
import type { Graph } from '../core/model';
import { initialState } from '../state/graphReducer';
import { hierarchical } from './layouts/hierarchical';

function n(key: string, kind: any, level: number): any { return { id: key, key, summary: key, type: { name: kind, kind }, status: { name: 's', category: 'todo' }, project: { key: 'X', name: 'X' }, hierarchyLevel: level, url: '', raw: {} }; }
const graph: Graph = {
  nodes: [n('EPIC-1', 'epic', 2), n('BUG-40', 'bug', 1)],
  edges: [{ id: 'l1', source: 'BUG-40', target: 'EPIC-1', kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} }],
};

test('maps nodes and edges with positions', () => {
  const { nodes, edges } = toFlowElements(graph, hierarchical(graph), initialState);
  expect(nodes).toHaveLength(2);
  expect(nodes[0].position).toBeDefined();
  expect(edges).toHaveLength(1);
});

test('hides nodes whose type is filtered, and edges touching them', () => {
  const state = { ...initialState, hiddenTypes: new Set(['bug'] as any) } as typeof initialState;
  const { nodes, edges } = toFlowElements(graph, hierarchical(graph), state);
  expect(nodes.map((x) => x.id)).toEqual(['EPIC-1']);
  expect(edges).toHaveLength(0);
});

test('hides edges whose relation is filtered', () => {
  const state = { ...initialState, hiddenRelations: new Set(['blocks']) };
  const { edges } = toFlowElements(graph, hierarchical(graph), state);
  expect(edges).toHaveLength(0);
});
