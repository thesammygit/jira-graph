import { v3Issues, v3Caps } from './v3';
import { v2Issues, v2Caps } from './v2';
import { normalizeIssues } from '../core/normalize';

test('v3 fixtures normalize into a connected graph with epic + link edges', () => {
  const g = normalizeIssues(v3Issues, v3Caps);
  expect(g.nodes.length).toBeGreaterThanOrEqual(20);
  expect(g.edges.some((e) => e.relation === 'epic')).toBe(true);
  expect(g.edges.some((e) => e.relation === 'blocks')).toBe(true);
  expect(g.edges.some((e) => e.relation === 'relates')).toBe(true);
  expect(g.edges.some((e) => e.relation === 'subtask')).toBe(true);
});

test('v2 fixtures produce epic edges via Epic Link when capability is on', () => {
  const on = normalizeIssues(v2Issues, v2Caps);
  expect(on.edges.some((e) => e.relation === 'epic')).toBe(true);
  const off = normalizeIssues(v2Issues, { ...v2Caps, hasEpicLink: false });
  expect(off.edges.some((e) => e.relation === 'epic')).toBe(false);
});
