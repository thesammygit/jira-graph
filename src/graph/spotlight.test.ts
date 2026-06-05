import { spotlightModel } from './spotlight';
import type { Graph } from '../core/model';

function n(key: string, kind: any = 'task', epicKey?: string): any {
  return { id: key, key, summary: `${key} sum`, type: { name: kind, kind }, status: { name: 's', category: 'todo' }, project: { key: 'P', name: 'P' }, hierarchyLevel: 1, url: '', raw: {}, epicKey };
}
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'parent', label: 'parent', directed: true, raw: {} }; }
function l(s: string, t: string, rel: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: rel, label: rel, directed: rel !== 'relates', raw: {} }; }

const graph: Graph = {
  nodes: [n('EPIC-1', 'epic'), n('STORY-1', 'story', 'EPIC-1'), n('HERO', 'task', 'EPIC-1'), n('SUB-1', 'subtask', 'EPIC-1'),
          n('B1', 'task', 'EPIC-1'), n('B2', 'task', 'EPIC-1'), n('R1', 'task', 'EPIC-1')],
  edges: [h('EPIC-1', 'STORY-1'), h('STORY-1', 'HERO'), h('HERO', 'SUB-1'),
          l('HERO', 'B1', 'blocks'), l('B2', 'HERO', 'blocks'), l('HERO', 'R1', 'relates')],
};

test('sorts every related ticket into the right lane', () => {
  const m = spotlightModel(graph, 'HERO')!;
  expect(m.hero.key).toBe('HERO');
  expect(m.epic?.key).toBe('EPIC-1');
  expect(m.parent?.key).toBe('STORY-1');
  expect(m.children.map((c) => c.key)).toEqual(['SUB-1']);
  expect(m.blocks.map((c) => c.key)).toEqual(['B1']);
  expect(m.blockedBy.map((c) => c.key)).toEqual(['B2']);
  expect(m.relates.map((c) => c.key)).toEqual(['R1']);
});

test('returns null when the hero is not in the graph', () => {
  expect(spotlightModel(graph, 'NOPE')).toBeNull();
});

test('a ticket appears in only one lane (parent beats children/links)', () => {
  const m = spotlightModel(graph, 'HERO')!;
  const all = [m.epic, m.parent, ...m.children, ...m.blocks, ...m.blockedBy, ...m.relates].filter(Boolean).map((x: any) => x.key);
  expect(new Set(all).size).toBe(all.length);
});
