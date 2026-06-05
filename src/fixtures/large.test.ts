import { largeIssues, largeCaps } from './large';
import { normalizeIssues } from '../core/normalize';

test('large dataset spans 3 projects and many assignees', () => {
  const g = normalizeIssues(largeIssues, largeCaps);
  expect(g.nodes.length).toBeGreaterThanOrEqual(80);
  expect(g.nodes.length).toBeLessThanOrEqual(180);
  expect(new Set(g.nodes.map((n) => n.project.key)).size).toBeGreaterThanOrEqual(3);
  const assignees = new Set(g.nodes.map((n) => n.assignee?.displayName).filter(Boolean));
  expect(assignees.size).toBeGreaterThanOrEqual(8);
});

test('has a full epic→story→task→subtask chain (deep grouping + epic badges)', () => {
  const g = normalizeIssues(largeIssues, largeCaps);
  const sub = g.nodes.find((n) => n.type.kind === 'subtask' && n.epicKey);
  expect(sub).toBeTruthy();
  // its epic ancestor exists and is an epic
  const epic = g.nodes.find((n) => n.key === sub!.epicKey);
  expect(epic?.type.kind).toBe('epic');
});

test('contains blocks and relates links (incl. at least one cross-project)', () => {
  const g = normalizeIssues(largeIssues, largeCaps);
  expect(g.edges.some((e) => e.relation === 'blocks')).toBe(true);
  expect(g.edges.some((e) => e.relation === 'relates')).toBe(true);
  const crossProject = g.edges.some((e) => {
    const s = g.nodes.find((n) => n.key === e.source), t = g.nodes.find((n) => n.key === e.target);
    return e.kind === 'link' && s && t && s.project.key !== t.project.key;
  });
  expect(crossProject).toBe(true);
});
