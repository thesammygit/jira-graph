import { hybrid } from './hybrid';
import { layouts } from './index';
import type { Graph } from '../../core/model';
import { ROW_H } from './types';

function n(key: string, level: number): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
function he(s: string, t: string): any { return { id: `h-${s}-${t}`, source: s, target: t, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }
function le(s: string, t: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'b', directed: true, raw: {} }; }

const graph: Graph = { nodes: [n('E', 2), n('A', 1), n('B', 1)], edges: [he('E', 'A'), he('E', 'B'), le('A', 'B')] };

test('keeps hierarchy y-by-level (E above A and B)', () => {
  const pos = hybrid(graph);
  expect(pos.get('E')!.y).toBe(0);
  expect(pos.get('A')!.y).toBe(ROW_H);
  expect(pos.get('B')!.y).toBe(ROW_H);
});

test('registry exposes all three layouts', () => {
  expect(Object.keys(layouts).sort()).toEqual(['force', 'hierarchical', 'hybrid']);
});
