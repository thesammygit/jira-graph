import { generateIssues, hugeCaps } from './fixtures/huge';
import { normalizeIssues } from './core/normalize';
import { groupGraph } from './graph/grouping';
import { layoutGrouped } from './graph/layouts/grouped';
import { filterGroupingForState, toGroupedElements } from './graph/grouped-elements';
import { computeEdgePaths } from './graph/edge-paths';
import { initialState, type GraphState } from './state/graphReducer';

/**
 * Perf budget guard: the full Overview pipeline (group → filter → layout →
 * elements → edge routing) must stay within budget at ~4k tickets so a
 * routing/layout regression gets caught before it ships. Budgets are loose
 * (CI machines vary); the point is catching order-of-magnitude blowups.
 */
function pipeline(state: GraphState, graph: ReturnType<typeof normalizeIssues>) {
  const grouping = filterGroupingForState(groupGraph(graph, state.groupDepth), state);
  const { nodes, edges } = toGroupedElements(graph, grouping, layoutGrouped(grouping), state);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const absOf = (n: any): { x: number; y: number } => {
    let x = n.position.x, y = n.position.y, p = n.parentId ? byId.get(n.parentId) : undefined;
    while (p) { x += p.position.x; y += p.position.y; p = (p as any).parentId ? byId.get((p as any).parentId) : undefined; }
    return { x, y };
  };
  const obstacles = nodes.map((n) => {
    const p = absOf(n);
    return { id: n.id, rect: { x: p.x, y: p.y, width: (n as any).width ?? 200, height: (n as any).height ?? 80 } };
  });
  const topOf: Record<string, string> = {};
  const ancestorsOf: Record<string, string[]> = {};
  for (const n of nodes) {
    const chain: string[] = [];
    let p = (n as any).parentId ? byId.get((n as any).parentId) : undefined;
    while (p) { chain.push(p.id); p = (p as any).parentId ? byId.get((p as any).parentId) : undefined; }
    ancestorsOf[n.id] = chain;
    topOf[n.id] = chain.length ? chain[chain.length - 1] : n.id;
  }
  const paths = computeEdgePaths(edges as any, { obstacles, topOf, ancestorsOf });
  return { nodes: nodes.length, edges: edges.length, paths: Object.keys(paths).length };
}

const issues = generateIssues(); // ~4.3k tickets
const graph = normalizeIssues(issues, hugeCaps);

test(`huge fixture is actually huge (${issues.length} issues)`, () => {
  expect(graph.nodes.length).toBeGreaterThan(3000);
  expect(graph.edges.filter((e) => e.kind === 'link').length).toBeGreaterThan(50);
});

test('epic-level Overview pipeline at ~4k tickets stays under 1.5s', () => {
  const state = { ...initialState, groupDepth: 1 as const };
  const t0 = performance.now();
  const out = pipeline(state, graph);
  const ms = performance.now() - t0;
  // eslint-disable-next-line no-console
  console.log(`epic-level pipeline: ${Math.round(ms)}ms — ${out.nodes} nodes, ${out.edges} edges`);
  expect(ms).toBeLessThan(1500);
});

test('full-depth Overview pipeline at ~4k tickets stays under 8s', () => {
  const t0 = performance.now();
  const out = pipeline(initialState, graph);
  const ms = performance.now() - t0;
  // eslint-disable-next-line no-console
  console.log(`full-depth pipeline: ${Math.round(ms)}ms — ${out.nodes} nodes, ${out.edges} edges`);
  expect(ms).toBeLessThan(8000);
});
