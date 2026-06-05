import { ticketRelationships } from './relationships';
import type { Graph } from '../core/model';
function n(key: string): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, project: { key: 'P', name: 'P' }, hierarchyLevel: 1, url: '', raw: {} }; }
const graph: Graph = { nodes: ['A', 'B', 'C'].map(n), edges: [
  { id: 'e1', source: 'A', target: 'B', kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} },
  { id: 'e2', source: 'C', target: 'A', kind: 'link', relation: 'relates', label: 'relates to', directed: false, raw: {} },
]};

test('returns outward + inward rows for a ticket', () => {
  const rows = ticketRelationships(graph, 'A');
  expect(rows.find((r) => r.otherKey === 'B' && r.outward)).toBeTruthy();   // A blocks B (outward)
  expect(rows.find((r) => r.otherKey === 'C' && !r.outward)).toBeTruthy();  // C relates A (inward to A)
});
