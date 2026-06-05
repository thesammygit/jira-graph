import { relationStyle, legendEntries } from './relation-colors';
import type { Graph } from '../core/model';

test('known relations map to stable color vars + labels', () => {
  expect(relationStyle('blocks')).toEqual({ key: 'blocks', label: 'Blocks', colorVar: 'var(--rel-blocks)' });
  expect(relationStyle('relates').colorVar).toBe('var(--rel-relates)');
  expect(relationStyle('hierarchy').colorVar).toBe('var(--rel-hierarchy)');
});

test('unknown relation falls back to a default with a capitalized label', () => {
  expect(relationStyle('mentions')).toEqual({ key: 'mentions', label: 'Mentions', colorVar: 'var(--rel-default)' });
});

test('legendEntries returns only the relations present, deduped, hierarchy collapsed', () => {
  const g: Graph = { nodes: [], edges: [
    { id: 'a', source: 'x', target: 'y', kind: 'hierarchy', relation: 'epic', label: 'epic', directed: true, raw: {} },
    { id: 'b', source: 'x', target: 'y', kind: 'link', relation: 'blocks', label: 'b', directed: true, raw: {} },
    { id: 'c', source: 'y', target: 'z', kind: 'link', relation: 'blocks', label: 'b', directed: true, raw: {} },
  ] };
  const keys = legendEntries(g).map((e) => e.key);
  expect(keys).toContain('hierarchy');
  expect(keys).toContain('blocks');
  expect(keys.filter((k) => k === 'blocks')).toHaveLength(1);
});
