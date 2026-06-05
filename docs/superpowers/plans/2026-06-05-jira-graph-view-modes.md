# Jira Graph — Legibility View Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three switchable view modes — Grouped containers, Collapsible tree, and Timeline/Gantt — so big Jira projects stay legible, all rendering from the existing normalized graph.

**Architecture:** A `viewMode` in state selects one of four isolated view components. Grouped mode reuses React Flow via compound/parent nodes (containers are parent nodes; ticket-to-ticket cross-links are real edges). Tree and Timeline are lightweight DOM/SVG components. Only Timeline adds data: optional date fields on the normalized model. The three new view components are built with the **frontend-design** skill for visual quality.

**Tech Stack:** Existing — React 19 + TS + Vite + `@xyflow/react`, Vitest. No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-05-jira-graph-view-modes-design.md`

**Existing code this builds on (do not break):**
- `src/core/model.ts` — `GraphNode`, `GraphEdge`, `Graph`, `Capabilities`, `IssueKind`, `StatusCategory`.
- `src/core/normalize.ts` — `normalizeIssue(raw, caps)`, `normalizeIssues(raw[], caps)`.
- `src/state/graphReducer.ts` — `GraphState`, `initialState`, `Action`, `reducer`.
- `src/graph/flow-elements.ts` — `toFlowElements`. `src/graph/layouts/*` — `layouts` registry, `LayoutKind`.
- `src/components/*` — `GraphCanvas`, `TicketNode`, `Toolbar`, `DetailPanel`. `src/App.tsx`.
- `src/fixtures/v3.ts` (`v3Issues`,`v3Caps`), `src/fixtures/v2.ts` (`v2Issues`,`v2Caps`).
- Vitest test env is `node`; modules used in tests must keep `@xyflow/react` imports type-only.

---

## File Structure (new/changed)

```
src/state/graphReducer.ts          # + viewMode, groupDepth, collapsed + actions  (MODIFY)
src/core/model.ts                  # + startDate/dueDate/sprint on GraphNode; + caps date field ids (MODIFY)
src/core/normalize.ts              # + date/sprint normalization (MODIFY)
src/graph/grouping.ts              # NEW pure: containment grouping by depth
src/graph/layouts/grouped.ts       # NEW pure: nested container layout
src/graph/grouped-elements.ts      # NEW pure: grouping+layout -> React Flow compound nodes/edges
src/graph/tree.ts                  # NEW pure: graph -> tree rows + relationship badges
src/graph/timeline.ts              # NEW pure: dated nodes -> Gantt geometry
src/components/ViewModeSwitch.tsx  # NEW: mode + group-depth controls (used by Toolbar)
src/components/ContainerNode.tsx   # NEW: grouped container node (React Flow)
src/components/GroupedCanvas.tsx   # NEW: grouped view
src/components/TreeView.tsx        # NEW: collapsible outline
src/components/TimelineView.tsx    # NEW: Gantt
src/fixtures/v3.ts, v2.ts          # + dates/sprint (MODIFY)
src/App.tsx                        # switch on viewMode (MODIFY)
```

---

# PHASE A — Mode switch + Grouped mode

### Task 1: State — viewMode, groupDepth, collapsed

**Files:** Modify `src/state/graphReducer.ts`; Test `src/state/graphReducer.viewmodes.test.ts`

- [ ] **Step 1: Failing test** — `src/state/graphReducer.viewmodes.test.ts`
```ts
import { initialState, reducer } from './graphReducer';

test('defaults: graph mode, depth 2, nothing collapsed', () => {
  expect(initialState.viewMode).toBe('graph');
  expect(initialState.groupDepth).toBe(2);
  expect(initialState.collapsed.size).toBe(0);
});

test('setViewMode switches the active view', () => {
  expect(reducer(initialState, { type: 'setViewMode', viewMode: 'grouped' }).viewMode).toBe('grouped');
});

test('setGroupDepth sets the nesting depth', () => {
  expect(reducer(initialState, { type: 'setGroupDepth', depth: 3 }).groupDepth).toBe(3);
});

test('toggleCollapsed adds then removes a container key', () => {
  const a = reducer(initialState, { type: 'toggleCollapsed', key: 'EPIC-1' });
  expect(a.collapsed.has('EPIC-1')).toBe(true);
  const b = reducer(a, { type: 'toggleCollapsed', key: 'EPIC-1' });
  expect(b.collapsed.has('EPIC-1')).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/state/graphReducer.viewmodes.test.ts`

- [ ] **Step 3: Implement** — in `src/state/graphReducer.ts`:

Add near the top (after existing imports):
```ts
export type ViewMode = 'graph' | 'grouped' | 'tree' | 'timeline';
export type GroupDepth = 1 | 2 | 3;
```
Add to the `GraphState` interface:
```ts
  viewMode: ViewMode;
  groupDepth: GroupDepth;
  collapsed: Set<string>;
```
Add to `initialState`:
```ts
  viewMode: 'graph',
  groupDepth: 2,
  collapsed: new Set(),
```
Add to the `Action` union:
```ts
  | { type: 'setViewMode'; viewMode: ViewMode }
  | { type: 'setGroupDepth'; depth: GroupDepth }
  | { type: 'toggleCollapsed'; key: string }
```
Add cases to `reducer` (reuse the existing `toggle` helper for the set):
```ts
    case 'setViewMode': return { ...state, viewMode: action.viewMode };
    case 'setGroupDepth': return { ...state, groupDepth: action.depth };
    case 'toggleCollapsed': return { ...state, collapsed: toggle(state.collapsed, action.key) };
```

- [ ] **Step 4: Run → PASS** — `npx vitest run src/state/graphReducer.viewmodes.test.ts`; also `npx vitest run src/state/` (existing reducer tests still pass).

- [ ] **Step 5: Commit**
```bash
git add src/state/graphReducer.ts src/state/graphReducer.viewmodes.test.ts
git commit -m "feat: viewMode, groupDepth, collapsed state for view modes"
```

---

### Task 2: Containment grouping (pure)

**Files:** Create `src/graph/grouping.ts`; Test `src/graph/grouping.test.ts`

- [ ] **Step 1: Failing test** — `src/graph/grouping.test.ts`
```ts
import { groupGraph } from './grouping';
import type { Graph } from '../core/model';

function n(key: string, level: number): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }

// EPIC-1 → STORY-10 → {TASK-20, SUB-30}; EPIC-1 → TASK-99 (direct); plus an orphan BUG-1
const graph: Graph = {
  nodes: [n('EPIC-1', 2), n('STORY-10', 1), n('TASK-20', 1), n('SUB-30', 0), n('TASK-99', 1), n('BUG-1', 1)],
  edges: [h('EPIC-1', 'STORY-10'), h('STORY-10', 'TASK-20'), h('STORY-10', 'SUB-30'), h('EPIC-1', 'TASK-99')],
};

test('depth 1: epic container holds ALL descendants flat, no sub-containers', () => {
  const g = groupGraph(graph, 1);
  const epic = g.containers.find((c) => c.key === 'EPIC-1')!;
  expect(epic.subContainers).toHaveLength(0);
  expect(epic.members.map((m) => m.key).sort()).toEqual(['STORY-10', 'SUB-30', 'TASK-20', 'TASK-99']);
});

test('depth 2: epic holds STORY-10 as a sub-container (with its members) + TASK-99 as a direct member', () => {
  const g = groupGraph(graph, 2);
  const epic = g.containers.find((c) => c.key === 'EPIC-1')!;
  expect(epic.subContainers.map((s) => s.key)).toEqual(['STORY-10']);
  expect(epic.subContainers[0].members.map((m) => m.key).sort()).toEqual(['SUB-30', 'TASK-20']);
  expect(epic.members.map((m) => m.key)).toEqual(['TASK-99']);
});

test('orphans with no parent and no children go in a synthetic Ungrouped container', () => {
  const g = groupGraph(graph, 2);
  const ung = g.containers.find((c) => c.key === '__ungrouped__');
  expect(ung?.members.map((m) => m.key)).toEqual(['BUG-1']);
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/graph/grouping.test.ts`

- [ ] **Step 3: Implement** — `src/graph/grouping.ts`
```ts
import type { Graph, GraphNode } from '../core/model';

export interface GroupContainer {
  key: string;                   // heading ticket key, or '__ungrouped__'
  node: GraphNode | null;        // heading ticket (null for the synthetic Ungrouped bucket)
  subContainers: GroupContainer[];
  members: GraphNode[];          // leaf tickets shown as chips
}
export interface Grouping { containers: GroupContainer[] }

export function groupGraph(graph: Graph, depth: number): Grouping {
  const nodeMap = new Map(graph.nodes.map((n) => [n.key, n]));
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind !== 'hierarchy') continue;
    const arr = childrenOf.get(e.source) ?? [];
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, arr);
    arr.push(e.target);
    hasParent.add(e.target);
  }

  const descendantsFlat = (key: string): GraphNode[] => {
    const out: GraphNode[] = [];
    for (const c of childrenOf.get(key) ?? []) {
      const cn = nodeMap.get(c);
      if (cn) out.push(cn);
      out.push(...descendantsFlat(c));
    }
    return out;
  };

  const build = (key: string, level: number): GroupContainer => {
    const node = nodeMap.get(key) ?? null;
    const subContainers: GroupContainer[] = [];
    const members: GraphNode[] = [];
    for (const childKey of childrenOf.get(key) ?? []) {
      const childHasChildren = (childrenOf.get(childKey) ?? []).length > 0;
      if (level + 1 < depth && childHasChildren) {
        subContainers.push(build(childKey, level + 1));
      } else {
        const cn = nodeMap.get(childKey);
        if (cn) members.push(cn);
        members.push(...descendantsFlat(childKey)); // flatten anything below the depth boundary
      }
    }
    return { key, node, subContainers, members };
  };

  // Top-level containers = hierarchy roots that have children (e.g. epics).
  const roots = graph.nodes.filter((n) => !hasParent.has(n.key) && (childrenOf.get(n.key) ?? []).length > 0);
  const containers = roots.map((r) => build(r.key, 0));

  // Orphans: roots with no children and no parent.
  const orphans = graph.nodes.filter((n) => !hasParent.has(n.key) && (childrenOf.get(n.key) ?? []).length === 0);
  if (orphans.length) {
    containers.push({ key: '__ungrouped__', node: null, subContainers: [], members: orphans });
  }
  return { containers };
}
```

- [ ] **Step 4: Run → PASS** — `npx vitest run src/graph/grouping.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/graph/grouping.ts src/graph/grouping.test.ts
git commit -m "feat: containment grouping by configurable depth"
```

---

### Task 3: Nested container layout (pure)

**Files:** Create `src/graph/layouts/grouped.ts`; Test `src/graph/layouts/grouped.test.ts`

Layout model: every container and member gets a position **relative to its parent** (React Flow child coordinates). Containers are sized to fit their contents. Members are packed in a grid.

- [ ] **Step 1: Failing test** — `src/graph/layouts/grouped.test.ts`
```ts
import { layoutGrouped, GROUP } from './grouped';
import type { Grouping } from '../grouping';

function leaf(key: string): any { return { key, summary: key, type: { kind: 'task' } }; }
const grouping: Grouping = {
  containers: [
    { key: 'EPIC-1', node: leaf('EPIC-1'), members: [leaf('TASK-99')], subContainers: [
      { key: 'STORY-10', node: leaf('STORY-10'), members: [leaf('TASK-20'), leaf('SUB-30')], subContainers: [] },
    ] },
  ],
};

test('every container gets a positive size and a depth', () => {
  const lay = layoutGrouped(grouping);
  const epic = lay.containers.find((c) => c.key === 'EPIC-1')!;
  expect(epic.width).toBeGreaterThan(0);
  expect(epic.height).toBeGreaterThan(0);
  expect(epic.depth).toBe(0);
  expect(lay.containers.find((c) => c.key === 'STORY-10')!.parentKey).toBe('EPIC-1');
});

test('members are positioned and reference their parent container', () => {
  const lay = layoutGrouped(grouping);
  const t20 = lay.members.find((m) => m.key === 'TASK-20')!;
  expect(t20.parentKey).toBe('STORY-10');
  expect(Number.isFinite(t20.x)).toBe(true);
  expect(Number.isFinite(t20.y)).toBe(true);
});

test('a sub-container fits within its parent width', () => {
  const lay = layoutGrouped(grouping);
  const epic = lay.containers.find((c) => c.key === 'EPIC-1')!;
  const story = lay.containers.find((c) => c.key === 'STORY-10')!;
  expect(story.x + story.width).toBeLessThanOrEqual(epic.width + 0.01);
});

test('is deterministic', () => {
  expect(layoutGrouped(grouping)).toEqual(layoutGrouped(grouping));
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/graph/layouts/grouped.test.ts`

- [ ] **Step 3: Implement** — `src/graph/layouts/grouped.ts`
```ts
import type { Grouping, GroupContainer } from '../grouping';

export const GROUP = {
  CHIP_W: 150, CHIP_H: 56, GAP: 12, PAD: 14, HEADER_H: 34, COLS: 3, CONTAINER_GAP: 28,
};

export interface PlacedContainer { key: string; x: number; y: number; width: number; height: number; parentKey?: string; depth: number }
export interface PlacedMember { key: string; x: number; y: number; parentKey: string }
export interface GroupedLayout { containers: PlacedContainer[]; members: PlacedMember[] }

// Pack n cells in a grid of COLS columns; return grid pixel size.
function gridSize(n: number): { w: number; h: number } {
  if (n === 0) return { w: 0, h: 0 };
  const cols = Math.min(GROUP.COLS, n);
  const rows = Math.ceil(n / cols);
  return { w: cols * GROUP.CHIP_W + (cols - 1) * GROUP.GAP, h: rows * GROUP.CHIP_H + (rows - 1) * GROUP.GAP };
}

export function layoutGrouped(grouping: Grouping): GroupedLayout {
  const containers: PlacedContainer[] = [];
  const members: PlacedMember[] = [];

  // Recursively measure a container's intrinsic size (bottom-up), placing its
  // sub-containers and members relative to the container's own top-left.
  function measure(c: GroupContainer, depth: number): { width: number; height: number } {
    let cursorY = GROUP.HEADER_H + GROUP.PAD;
    let maxRowRight = GROUP.PAD;

    // sub-containers stacked vertically (each full-width row)
    const subSizes = c.subContainers.map((s) => measure(s, depth + 1));
    c.subContainers.forEach((s, i) => {
      const size = subSizes[i];
      containers.push({ key: s.key, x: GROUP.PAD, y: cursorY, width: size.width, height: size.height, parentKey: c.key, depth: depth + 1 });
      cursorY += size.height + GROUP.GAP;
      maxRowRight = Math.max(maxRowRight, GROUP.PAD + size.width);
    });

    // members packed in a grid below the sub-containers
    const grid = gridSize(c.members.length);
    c.members.forEach((m, i) => {
      const col = i % GROUP.COLS, row = Math.floor(i / GROUP.COLS);
      members.push({ key: m.key, parentKey: c.key, x: GROUP.PAD + col * (GROUP.CHIP_W + GROUP.GAP), y: cursorY + row * (GROUP.CHIP_H + GROUP.GAP) });
    });
    if (c.members.length) { cursorY += grid.h + GROUP.GAP; maxRowRight = Math.max(maxRowRight, GROUP.PAD + grid.w); }

    const width = Math.max(maxRowRight + GROUP.PAD, 200);
    const height = cursorY + GROUP.PAD;
    return { width, height };
  }

  // Place top-level containers in a wrapped row.
  let x = 0, y = 0, rowH = 0;
  const MAXW = 1600;
  for (const c of grouping.containers) {
    const size = measure(c, 0);
    if (x > 0 && x + size.width > MAXW) { x = 0; y += rowH + GROUP.CONTAINER_GAP; rowH = 0; }
    containers.push({ key: c.key, x, y, width: size.width, height: size.height, depth: 0 });
    x += size.width + GROUP.CONTAINER_GAP;
    rowH = Math.max(rowH, size.height);
  }
  return { containers, members };
}
```
Note: `measure` pushes child containers/members during measurement; top-level containers are pushed after with their absolute (row-packed) origin. Child coordinates are relative to their parent (React Flow semantics).

- [ ] **Step 4: Run → PASS** — `npx vitest run src/graph/layouts/grouped.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/graph/layouts/grouped.ts src/graph/layouts/grouped.test.ts
git commit -m "feat: nested container layout for grouped mode"
```

---

### Task 4: Grouped → React Flow compound elements (pure)

**Files:** Create `src/graph/grouped-elements.ts`; Test `src/graph/grouped-elements.test.ts`

Produces React Flow nodes (container nodes type `'container'`; member nodes type `'ticket'` with `parentId`) and edges (only `link` edges between visible members; hierarchy is implied by containment so not drawn). Collapsed containers hide their descendants and re-route a member-edge endpoint up to the nearest visible container.

Keep `@xyflow/react` imports **type-only** (node test env).

- [ ] **Step 1: Failing test** — `src/graph/grouped-elements.test.ts`
```ts
import { toGroupedElements } from './grouped-elements';
import { groupGraph } from './grouping';
import { layoutGrouped } from './layouts/grouped';
import type { Graph } from '../core/model';
import { initialState } from '../state/graphReducer';

function n(key: string, kind: any, level: number): any { return { id: key, key, summary: key, type: { name: kind, kind }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }
function l(s: string, t: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} }; }

const graph: Graph = {
  nodes: [n('EPIC-1', 'epic', 2), n('STORY-10', 'story', 1), n('TASK-20', 'task', 1), n('EPIC-2', 'epic', 2), n('STORY-30', 'story', 1)],
  edges: [h('EPIC-1', 'STORY-10'), h('STORY-10', 'TASK-20'), h('EPIC-2', 'STORY-30'), l('TASK-20', 'STORY-30')],
};
function build(state: typeof initialState) {
  const grouping = groupGraph(graph, state.groupDepth);
  return toGroupedElements(graph, grouping, layoutGrouped(grouping), state);
}

test('emits container nodes and member nodes with parentId', () => {
  const { nodes } = build(initialState);
  const epic = nodes.find((x) => x.id === 'EPIC-1')!;
  expect(epic.type).toBe('container');
  const task = nodes.find((x) => x.id === 'TASK-20');
  expect(task?.type).toBe('ticket');
  expect((task as any)?.parentId).toBeDefined();
});

test('cross-container link is a ticket-to-ticket edge when both endpoints visible', () => {
  const { edges } = build(initialState);
  expect(edges.some((e) => e.source === 'TASK-20' && e.target === 'STORY-30')).toBe(true);
});

test('collapsing a container hides its members and reroutes the edge to the container', () => {
  const collapsed = { ...initialState, collapsed: new Set(['EPIC-1']) };
  const { nodes, edges } = build(collapsed);
  expect(nodes.some((x) => x.id === 'TASK-20')).toBe(false);   // member hidden
  expect(nodes.some((x) => x.id === 'EPIC-1')).toBe(true);     // container still shown
  // edge endpoint TASK-20 rerouted up to EPIC-1
  expect(edges.some((e) => e.source === 'EPIC-1' && e.target === 'STORY-30')).toBe(true);
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/graph/grouped-elements.test.ts`

- [ ] **Step 3: Implement** — `src/graph/grouped-elements.ts`
```ts
import type { Edge, Node } from '@xyflow/react';
import type { Graph } from '../core/model';
import type { Grouping, GroupContainer } from './grouping';
import type { GroupedLayout } from './layouts/grouped';
import type { GraphState } from '../state/graphReducer';

const EDGE_COLOR: Record<string, string> = { blocks: '#e12d39', relates: '#2186eb' };

export function toGroupedElements(graph: Graph, grouping: Grouping, layout: GroupedLayout, state: GraphState): { nodes: Node[]; edges: Edge[] } {
  // Map each ticket to the container that owns it, and whether it is currently visible.
  const ownerContainer = new Map<string, string>();   // ticket key -> nearest container key
  const ancestorChain = new Map<string, string[]>();  // container key -> [self, parent, ...] container chain
  const visibleMembers = new Set<string>();
  const visibleContainers = new Set<string>();

  // Walk grouping to record ownership + ancestor chains.
  const walk = (c: GroupContainer, chain: string[]) => {
    const here = [c.key, ...chain];
    ancestorChain.set(c.key, here);
    visibleContainers.add(c.key);
    for (const m of c.members) ownerContainer.set(m.key, c.key);
    for (const s of c.subContainers) walk(s, here);
  };
  grouping.containers.forEach((c) => walk(c, []));

  // A container is "hidden under collapse" if any ancestor (incl. self's parent) is collapsed.
  const isUnderCollapse = (containerKey: string): boolean => {
    const chain = ancestorChain.get(containerKey) ?? [containerKey];
    // chain[0] is self; an ancestor strictly above self being collapsed hides it
    return chain.slice(1).some((a) => state.collapsed.has(a));
  };

  const filteredOut = (kind: string, cat: string) => state.hiddenTypes.has(kind as any) || state.hiddenStatuses.has(cat as any);

  // Build nodes.
  const nodes: Node[] = [];
  const nodeByKey = new Map(graph.nodes.map((n) => [n.key, n]));
  for (const pc of layout.containers) {
    if (isUnderCollapse(pc.key)) continue; // a sub-container inside a collapsed ancestor is not shown
    visibleContainers.add(pc.key);
    const header = pc.key === '__ungrouped__' ? { key: '__ungrouped__', summary: 'Ungrouped' } : nodeByKey.get(pc.key);
    nodes.push({
      id: pc.key, type: 'container', position: { x: pc.x, y: pc.y },
      ...(pc.parentKey ? { parentId: pc.parentKey, extent: 'parent' as const } : {}),
      data: { node: header, depth: pc.depth, collapsed: state.collapsed.has(pc.key), width: pc.width, height: pc.height },
      style: { width: pc.width, height: pc.height },
    });
  }
  for (const pm of layout.members) {
    const ownerCollapsed = state.collapsed.has(pm.parentKey) || isUnderCollapse(pm.parentKey);
    if (ownerCollapsed) continue;
    const node = nodeByKey.get(pm.key); if (!node) continue;
    if (filteredOut(node.type.kind, node.status.category)) continue;
    visibleMembers.add(pm.key);
    nodes.push({
      id: pm.key, type: 'ticket', parentId: pm.parentKey, extent: 'parent',
      position: { x: pm.x, y: pm.y },
      data: { node, selected: state.selectedKey === pm.key, search: state.search },
    });
  }

  // Resolve an endpoint to what is actually drawn: the ticket if visible, else its
  // nearest visible ancestor container.
  const resolveEndpoint = (key: string): string | null => {
    if (visibleMembers.has(key)) return key;
    let container = ownerContainer.get(key);
    while (container) {
      if (visibleContainers.has(container) && !isUnderCollapse(container)) {
        // climb until the container itself is the visible (collapsed) box
        if (state.collapsed.has(container) || !ownerContainerHasVisibleParentCollapse(container)) return container;
      }
      const chain = ancestorChain.get(container) ?? [];
      container = chain[1]; // parent container
    }
    return null;
  };
  // Helper: is there a collapsed ancestor that should absorb this container?
  function ownerContainerHasVisibleParentCollapse(containerKey: string): boolean {
    const chain = ancestorChain.get(containerKey) ?? [containerKey];
    return chain.slice(1).some((a) => state.collapsed.has(a));
  }

  // Build edges: only link edges (hierarchy is implied by containment).
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const ge of graph.edges) {
    if (ge.kind !== 'link') continue;
    const relKey = ge.relation;
    if (state.hiddenRelations.has(relKey)) continue;
    const s = resolveEndpoint(ge.source), t = resolveEndpoint(ge.target);
    if (!s || !t || s === t) continue;
    const id = `${s}->${t}:${relKey}`;
    if (seen.has(id)) continue; seen.add(id);
    const color = EDGE_COLOR[ge.relation] ?? '#7b8794';
    edges.push({
      id, source: s, target: t, label: ge.label, type: 'smoothstep',
      style: { stroke: color, strokeWidth: 1.6, strokeDasharray: ge.directed ? undefined : '5 4' },
      markerEnd: ge.directed ? ({ type: 'arrowclosed', color } as Edge['markerEnd']) : undefined,
    });
  }
  return { nodes, edges };
}
```
Note on `resolveEndpoint`: when a ticket is hidden because its owning container is collapsed, the endpoint climbs to the nearest **visible** container (the collapsed box itself, since a collapsed container is still rendered). The test `collapsing a container ... reroutes the edge to the container` exercises this.

- [ ] **Step 4: Run → PASS** — `npx vitest run src/graph/grouped-elements.test.ts`. If the reroute test fails, simplify `resolveEndpoint` to: if member visible → its key; else walk `ownerContainer`/ancestor chain to the **outermost collapsed** container that is itself visible, return that. Keep iterating until the three tests pass.

- [ ] **Step 5: Commit**
```bash
git add src/graph/grouped-elements.ts src/graph/grouped-elements.test.ts
git commit -m "feat: grouped-mode compound elements with collapse rerouting"
```

---

### Task 5: ViewModeSwitch control

**Files:** Create `src/components/ViewModeSwitch.tsx`; Modify `src/components/Toolbar.tsx`

UI task — verified by build + visually. Build with the **frontend-design** skill for a polished control (segmented control feel; depth selector only visible in grouped mode).

- [ ] **Step 1: Invoke frontend-design** for a segmented mode switch (`Graph | Grouped | Tree | Timeline`) plus a depth selector (`1 / 2 / 3` shown only when `viewMode === 'grouped'`). Baseline to start from:

`src/components/ViewModeSwitch.tsx`:
```tsx
import type { Dispatch } from 'react';
import type { Action, GraphState, ViewMode, GroupDepth } from '../state/graphReducer';

const MODES: ViewMode[] = ['graph', 'grouped', 'tree', 'timeline'];
const DEPTHS: GroupDepth[] = [1, 2, 3];
const DEPTH_LABEL: Record<GroupDepth, string> = { 1: 'Epic', 2: 'Epic▸Story', 3: '▸Task' };

export function ViewModeSwitch({ state, dispatch }: { state: GraphState; dispatch: Dispatch<Action> }) {
  return (
    <div className="tb-group">
      <span className="tb-label">View</span>
      {MODES.map((m) => (
        <button key={m} className={state.viewMode === m ? 'on' : ''} onClick={() => dispatch({ type: 'setViewMode', viewMode: m })}>{m}</button>
      ))}
      {state.viewMode === 'grouped' && (
        <>
          <span className="tb-label" style={{ marginLeft: 8 }}>Depth</span>
          {DEPTHS.map((d) => (
            <button key={d} className={state.groupDepth === d ? 'on' : ''} onClick={() => dispatch({ type: 'setGroupDepth', depth: d })}>{DEPTH_LABEL[d]}</button>
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `Toolbar.tsx`** — import and render `<ViewModeSwitch state={state} dispatch={dispatch} />` as the first `.tb-group` after the search input. (The existing layout/filter groups stay; in later tasks they may be conditionally relevant per mode, but leaving them visible is fine.)

- [ ] **Step 3: Verify build** — `npm run build` clean.

- [ ] **Step 4: Commit**
```bash
git add src/components/ViewModeSwitch.tsx src/components/Toolbar.tsx
git commit -m "feat: view-mode + group-depth toolbar switch"
```

---

### Task 6: ContainerNode + GroupedCanvas

**Files:** Create `src/components/ContainerNode.tsx`, `src/components/GroupedCanvas.tsx`, `src/components/grouped.css`

UI task — verified by build + visually. Build the **visual layer with the frontend-design skill** (container header with key/summary/count, collapse caret, depth-tinted border; member chips reuse the look of `TicketNode` but compact). Behaviors required: collapse caret dispatches `toggleCollapsed`; clicking a member calls `onSelect`; hovering a member highlights only its edges (dim others).

- [ ] **Step 1: Invoke frontend-design** for ContainerNode + the member chip styling. Baseline:

`src/components/ContainerNode.tsx`:
```tsx
import { Handle, Position } from '@xyflow/react';
import './grouped.css';

const TINT = ['#7b61ff', '#3ebd93', '#2186eb']; // depth 0,1,2 accent

export function ContainerNode({ data }: { data: { node: { key: string; summary: string } | null; depth: number; collapsed: boolean; onToggle?: (key: string) => void } }) {
  const { node, depth, collapsed, onToggle } = data;
  const accent = TINT[Math.min(depth, TINT.length - 1)];
  return (
    <div className={`container-node depth-${depth}`} style={{ borderColor: accent }}>
      <Handle type="target" position={Position.Top} />
      <div className="container-head" style={{ color: accent }}>
        <button className="caret" onClick={(e) => { e.stopPropagation(); node && onToggle?.(node.key); }}>{collapsed ? '▸' : '▾'}</button>
        <span className="ck">{node?.key}</span>
        <span className="cs">{node?.summary}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

`src/components/GroupedCanvas.tsx`:
```tsx
import { useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow, type Node, type NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { groupGraph } from '../graph/grouping';
import { layoutGrouped } from '../graph/layouts/grouped';
import { toGroupedElements } from '../graph/grouped-elements';
import { TicketNode } from './TicketNode';
import { ContainerNode } from './ContainerNode';

function Canvas({ graph, state, dispatch, onSelect }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const grouping = groupGraph(graph, state.groupDepth);
    const { nodes, edges } = toGroupedElements(graph, grouping, layoutGrouped(grouping), state);
    // inject the collapse handler into container node data
    const wired = nodes.map((n) => n.type === 'container'
      ? { ...n, data: { ...n.data, onToggle: (k: string) => dispatch({ type: 'toggleCollapsed', key: k }) } } : n);
    return { nodes: wired, edges };
  }, [graph, state.groupDepth, state.collapsed, state.hiddenTypes, state.hiddenStatuses, state.hiddenRelations, state.selectedKey, state.search, dispatch]);

  const nodeTypes = useMemo(() => ({ ticket: TicketNode, container: ContainerNode } as unknown as NodeTypes), []);
  const { fitView } = useReactFlow();
  useEffect(() => { const id = requestAnimationFrame(() => fitView({ duration: 300, padding: 0.15 })); return () => cancelAnimationFrame(id); }, [graph, state.groupDepth, fitView]);

  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView
      onNodeClick={(_, n: Node) => n.type === 'ticket' && onSelect(n.id)} proOptions={{ hideAttribution: true }}>
      <Background /><Controls /><MiniMap pannable zoomable />
    </ReactFlow>
  );
}

export function GroupedCanvas(props: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void }) {
  return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>;
}
```

`src/components/grouped.css` (baseline; frontend-design refines):
```css
.container-node { background: rgba(255,255,255,.6); border: 1.5px solid #ccc; border-radius: 14px; box-shadow: 0 2px 10px rgba(16,42,67,.06); }
.container-head { display: flex; align-items: center; gap: 6px; padding: 7px 10px; font-family: ui-sans-serif, system-ui; }
.container-head .caret { border: none; background: none; cursor: pointer; font-size: 12px; color: inherit; }
.container-head .ck { font: 700 11px ui-monospace, monospace; }
.container-head .cs { font-size: 12px; font-weight: 600; color: #3e4c59; }
.container-node.depth-1 { background: rgba(255,255,255,.45); }
```

- [ ] **Step 2: Verify build** — `npm run build` clean.

- [ ] **Step 3: Commit**
```bash
git add src/components/ContainerNode.tsx src/components/GroupedCanvas.tsx src/components/grouped.css
git commit -m "feat: GroupedCanvas with nested containers (visual via frontend-design)"
```

---

### Task 7: Wire Grouped mode into App + run verify

**Files:** Modify `src/App.tsx`

- [ ] **Step 1: Render by viewMode.** In `App.tsx`, where `<GraphCanvas .../>` is rendered, switch on `state.viewMode`:
```tsx
{state.viewMode === 'grouped'
  ? <GroupedCanvas graph={view} state={state} dispatch={dispatch} onSelect={(key) => dispatch({ type: 'select', key })} />
  : <GraphCanvas graph={view} state={state} onSelect={(key) => dispatch({ type: 'select', key })} />}
```
Import `GroupedCanvas`. (Tree/Timeline are added in later phases; until then any non-grouped, non-graph value falls through to GraphCanvas — acceptable because the switch only offers grouped+graph behaviors so far. The ViewModeSwitch still lists tree/timeline; selecting them shows the graph until Phases B/C land. That is an acceptable interim state per the phasing.)

- [ ] **Step 2: Run & verify.** `npm test` (all pass), `npm run build` (clean). Then `npm run dev`, open the app, switch **View → grouped**: confirm epic containers render with nested story boxes and task chips, collapse carets work, cross-epic `blocks`/`relates` edges draw between tickets, and depth `1/2/3` changes nesting. No console errors.

- [ ] **Step 3: Commit**
```bash
git add src/App.tsx
git commit -m "feat: render grouped mode via viewMode switch"
```

---

# PHASE B — Tree mode

### Task 8: Tree builder (pure)

**Files:** Create `src/graph/tree.ts`; Test `src/graph/tree.test.ts`

- [ ] **Step 1: Failing test** — `src/graph/tree.test.ts`
```ts
import { buildTree } from './tree';
import type { Graph } from '../core/model';

function n(key: string, level: number): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }
function l(s: string, t: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} }; }

const graph: Graph = {
  nodes: [n('EPIC-1', 2), n('STORY-10', 1), n('TASK-20', 1), n('BUG-1', 1)],
  edges: [h('EPIC-1', 'STORY-10'), h('STORY-10', 'TASK-20'), l('BUG-1', 'STORY-10')],
};

test('roots are nodes with no hierarchy parent; children nest by hierarchy', () => {
  const rows = buildTree(graph);
  const epic = rows.find((r) => r.key === 'EPIC-1')!;
  expect(epic.depth).toBe(0);
  expect(epic.children.map((c) => c.key)).toEqual(['STORY-10']);
  expect(epic.children[0].children.map((c) => c.key)).toEqual(['TASK-20']);
});

test('link relationships attach to the row as badges', () => {
  const rows = buildTree(graph);
  const story = rows.find((r) => r.key === 'EPIC-1')!.children[0];
  // STORY-10 is blocked by BUG-1 (inward) → badge present referencing BUG-1
  expect(story.links.some((b) => b.otherKey === 'BUG-1')).toBe(true);
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/graph/tree.test.ts`

- [ ] **Step 3: Implement** — `src/graph/tree.ts`
```ts
import type { Graph, GraphNode } from '../core/model';

export interface TreeBadge { relation: string; label: string; otherKey: string; direction: 'out' | 'in' }
export interface TreeRow { key: string; node: GraphNode; depth: number; children: TreeRow[]; links: TreeBadge[] }

export function buildTree(graph: Graph): TreeRow[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.key, n]));
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  const links = new Map<string, TreeBadge[]>();

  for (const e of graph.edges) {
    if (e.kind === 'hierarchy') {
      const arr = childrenOf.get(e.source) ?? [];
      if (!childrenOf.has(e.source)) childrenOf.set(e.source, arr);
      arr.push(e.target);
      hasParent.add(e.target);
    } else {
      const sArr = links.get(e.source) ?? []; if (!links.has(e.source)) links.set(e.source, sArr);
      sArr.push({ relation: e.relation, label: e.label, otherKey: e.target, direction: 'out' });
      const tArr = links.get(e.target) ?? []; if (!links.has(e.target)) links.set(e.target, tArr);
      tArr.push({ relation: e.relation, label: e.label, otherKey: e.source, direction: 'in' });
    }
  }

  const build = (key: string, depth: number): TreeRow => ({
    key, node: nodeMap.get(key)!, depth,
    children: (childrenOf.get(key) ?? []).map((c) => build(c, depth + 1)),
    links: links.get(key) ?? [],
  });

  return graph.nodes.filter((n) => !hasParent.has(n.key)).map((r) => build(r.key, 0));
}
```

- [ ] **Step 4: Run → PASS** — `npx vitest run src/graph/tree.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/graph/tree.ts src/graph/tree.test.ts
git commit -m "feat: tree builder with relationship badges"
```

---

### Task 9: TreeView component

**Files:** Create `src/components/TreeView.tsx`, `src/components/tree.css`

UI task — build with **frontend-design** (clean indented rows, type-colored key, status pill, collapse caret, relationship badges; a badge click focuses the linked ticket). Behaviors: caret dispatches `toggleCollapsed`; row click calls `onSelect`; badge click dispatches `setFocus` (mode stays whatever; selecting suffices). Baseline:

`src/components/TreeView.tsx`:
```tsx
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { buildTree, type TreeRow } from '../graph/tree';
import './tree.css';

const KIND_COLOR: Record<string, string> = { epic: '#7b61ff', story: '#3ebd93', task: '#2186eb', subtask: '#a0aec0', bug: '#e12d39', other: '#7b8794' };

function Row({ row, state, dispatch, onSelect }: { row: TreeRow; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void }) {
  if (state.hiddenTypes.has(row.node.type.kind) || state.hiddenStatuses.has(row.node.status.category)) return null;
  const collapsed = state.collapsed.has(row.key);
  const hasChildren = row.children.length > 0;
  return (
    <div className="tree-branch">
      <div className={`tree-row ${state.selectedKey === row.key ? 'sel' : ''}`} style={{ paddingLeft: row.depth * 20 + 8 }} onClick={() => onSelect(row.key)}>
        <button className="tcaret" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'toggleCollapsed', key: row.key }); }}>{hasChildren ? (collapsed ? '▸' : '▾') : '·'}</button>
        <span className="tk" style={{ color: KIND_COLOR[row.node.type.kind] }}>{row.key}</span>
        <span className="ts">{row.node.summary}</span>
        {row.links.map((b, i) => (
          <button key={i} className="tbadge" title={`${b.label} ${b.otherKey}`} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'setFocus', key: b.otherKey }); dispatch({ type: 'select', key: b.otherKey }); }}>
            {b.relation === 'blocks' ? '⛔' : '↔'} {b.otherKey}
          </button>
        ))}
      </div>
      {!collapsed && row.children.map((c) => <Row key={c.key} row={c} state={state} dispatch={dispatch} onSelect={onSelect} />)}
    </div>
  );
}

export function TreeView({ graph, state, dispatch, onSelect }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action>; onSelect: (k: string) => void }) {
  const rows = buildTree(graph);
  return <div className="tree">{rows.map((r) => <Row key={r.key} row={r} state={state} dispatch={dispatch} onSelect={onSelect} />)}</div>;
}
```

`src/components/tree.css` (baseline; frontend-design refines):
```css
.tree { height: 100%; overflow: auto; padding: 10px 14px; font-family: ui-sans-serif, system-ui; background: #fff; }
.tree-row { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 7px; cursor: pointer; }
.tree-row:hover { background: #f5f7fa; }
.tree-row.sel { background: #e8f1fd; }
.tcaret { border: none; background: none; cursor: pointer; color: #7b8794; width: 16px; }
.tk { font: 700 11px ui-monospace, monospace; }
.ts { font-size: 13px; color: #1f2933; }
.tbadge { margin-left: 6px; font-size: 10px; border: 1px solid #e1e7ef; background: #fff; border-radius: 12px; padding: 1px 7px; cursor: pointer; color: #52606d; }
```

- [ ] **Step 2: Verify build** — `npm run build` clean.
- [ ] **Step 3: Commit**
```bash
git add src/components/TreeView.tsx src/components/tree.css
git commit -m "feat: collapsible TreeView (visual via frontend-design)"
```

---

### Task 10: Wire Tree mode into App + run verify

**Files:** Modify `src/App.tsx`

- [ ] **Step 1:** Extend the viewMode switch:
```tsx
{state.viewMode === 'grouped' ? <GroupedCanvas .../>
 : state.viewMode === 'tree' ? <TreeView graph={view} state={state} dispatch={dispatch} onSelect={(key) => dispatch({ type: 'select', key })} />
 : <GraphCanvas .../>}
```
Import `TreeView`. (TreeView ignores depth/layout; it uses the full hierarchy. It renders `view` so focus/depth still narrows it in focus mode.)

- [ ] **Step 2: Run & verify.** `npm test` + `npm run build`. `npm run dev`: switch **View → tree**, confirm the outline renders, carets collapse/expand, badges jump, filters hide rows. No console errors.

- [ ] **Step 3: Commit**
```bash
git add src/App.tsx
git commit -m "feat: render tree mode via viewMode switch"
```

---

# PHASE C — Timeline / Gantt mode

### Task 11: Date fields on the model + normalization

**Files:** Modify `src/core/model.ts`, `src/core/normalize.ts`; Test `src/core/normalize.dates.test.ts`

- [ ] **Step 1:** Extend types in `src/core/model.ts`:
- Add to `GraphNode`:
```ts
  startDate?: string;
  dueDate?: string;
  sprint?: string;
```
- Add to `Capabilities`:
```ts
  startDateFieldId?: string;
  sprintFieldId?: string;
```

- [ ] **Step 2: Failing test** — `src/core/normalize.dates.test.ts`
```ts
import { normalizeIssue } from './normalize';
import type { Capabilities } from './model';

const caps: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false, startDateFieldId: 'customfield_10015', sprintFieldId: 'customfield_10020' };
const issuetype = { name: 'Story', subtask: false };

test('reads dueDate from fields.duedate and start from the configured field', () => {
  const raw = { key: 'S-1', fields: { summary: 's', issuetype, status: {}, duedate: '2026-07-10', customfield_10015: '2026-07-01' } };
  const { node } = normalizeIssue(raw, caps);
  expect(node.dueDate).toBe('2026-07-10');
  expect(node.startDate).toBe('2026-07-01');
});

test('reads sprint name from the sprint custom field array (last sprint)', () => {
  const raw = { key: 'S-2', fields: { summary: 's', issuetype, status: {}, customfield_10020: [{ name: 'Sprint 4' }, { name: 'Sprint 5' }] } };
  expect(normalizeIssue(raw, caps).node.sprint).toBe('Sprint 5');
});

test('dates are undefined when fields/caps are absent', () => {
  const { node } = normalizeIssue({ key: 'S-3', fields: { summary: 's', issuetype, status: {} } }, { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false });
  expect(node.dueDate).toBeUndefined();
  expect(node.startDate).toBeUndefined();
  expect(node.sprint).toBeUndefined();
});
```

- [ ] **Step 3: Run → FAIL** — `npx vitest run src/core/normalize.dates.test.ts`

- [ ] **Step 4: Implement** — in `normalizeIssue` (src/core/normalize.ts), add to the constructed `node` object (alongside existing fields):
```ts
    startDate: caps.startDateFieldId ? f[caps.startDateFieldId] : undefined,
    dueDate: f.duedate ?? undefined,
    sprint: caps.sprintFieldId && Array.isArray(f[caps.sprintFieldId]) && f[caps.sprintFieldId].length
      ? f[caps.sprintFieldId][f[caps.sprintFieldId].length - 1]?.name
      : undefined,
```

- [ ] **Step 5: Run → PASS** — `npx vitest run src/core/normalize.dates.test.ts`; rerun `npx vitest run src/core/` (no regressions).

- [ ] **Step 6: Commit**
```bash
git add src/core/model.ts src/core/normalize.ts src/core/normalize.dates.test.ts
git commit -m "feat: normalize start/due/sprint date fields (feature-detected)"
```

---

### Task 12: Add dates to fixtures

**Files:** Modify `src/fixtures/v3.ts`, `src/fixtures/v2.ts`; Test `src/fixtures/dates.test.ts`

- [ ] **Step 1: Failing test** — `src/fixtures/dates.test.ts`
```ts
import { v3Issues, v3Caps } from './v3';
import { normalizeIssues } from '../core/normalize';

test('v3 caps expose start/sprint field ids and most issues have a dueDate', () => {
  expect(v3Caps.startDateFieldId).toBeTruthy();
  expect(v3Caps.sprintFieldId).toBeTruthy();
  const g = normalizeIssues(v3Issues, v3Caps);
  const dated = g.nodes.filter((n) => n.dueDate).length;
  expect(dated).toBeGreaterThanOrEqual(10);
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/fixtures/dates.test.ts`

- [ ] **Step 3: Implement.** In `src/fixtures/v3.ts`: add `startDateFieldId: 'customfield_10015'` and `sprintFieldId: 'customfield_10020'` to `v3Caps`. Add believable `duedate` (ISO `YYYY-MM-DD`), `customfield_10015` (start), and `customfield_10020: [{ name: 'Sprint N' }]` to most issues — staggered across ~Jun–Aug 2026 so bars spread along the axis and the `blocks` chain (TASK-20→TASK-22→TASK-24) reads left-to-right (each due date after the previous). At least 10 issues must have a `dueDate`. In `src/fixtures/v2.ts`: add the same two cap field ids and dates to several issues (keep it smaller). Ensure existing fixture tests still pass.

- [ ] **Step 4: Run → PASS** — `npx vitest run src/fixtures/` (dates + existing fixtures tests pass).

- [ ] **Step 5: Commit**
```bash
git add src/fixtures/v3.ts src/fixtures/v2.ts src/fixtures/dates.test.ts
git commit -m "feat: add start/due/sprint dates to mock fixtures"
```

---

### Task 13: Timeline geometry (pure)

**Files:** Create `src/graph/timeline.ts`; Test `src/graph/timeline.test.ts`

- [ ] **Step 1: Failing test** — `src/graph/timeline.test.ts`
```ts
import { buildTimeline } from './timeline';
import type { Graph } from '../core/model';

function n(key: string, kind: any, start?: string, due?: string): any { return { id: key, key, summary: key, type: { name: kind, kind }, status: { name: 's', category: 'todo' }, hierarchyLevel: kind === 'epic' ? 2 : 1, url: '', raw: {}, startDate: start, dueDate: due }; }
function h(p: string, c: string): any { return { id: `h-${p}-${c}`, source: p, target: c, kind: 'hierarchy', relation: 'epic', label: 'epic', directed: true, raw: {} }; }
function blk(s: string, t: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} }; }

const graph: Graph = {
  nodes: [n('EPIC-1', 'epic'), n('A', 'task', '2026-07-01', '2026-07-05'), n('B', 'task', '2026-07-06', '2026-07-10'), n('C', 'task')],
  edges: [h('EPIC-1', 'A'), h('EPIC-1', 'B'), h('EPIC-1', 'C'), blk('A', 'B')],
};

test('dated issues become bars; later due date sits further right', () => {
  const tl = buildTimeline(graph, 800);
  const a = tl.rows.flatMap((r) => r.bars).find((b) => b.key === 'A')!;
  const b = tl.rows.flatMap((r) => r.bars).find((b) => b.key === 'B')!;
  expect(b.x).toBeGreaterThan(a.x);
  expect(a.width).toBeGreaterThan(0);
});

test('rows are grouped by epic', () => {
  const tl = buildTimeline(graph, 800);
  expect(tl.rows.some((r) => r.epicKey === 'EPIC-1')).toBe(true);
});

test('undated issues are collected separately, not placed as bars', () => {
  const tl = buildTimeline(graph, 800);
  expect(tl.undated.map((u) => u.key)).toContain('C');
});

test('blocks dependencies are reported between dated bars', () => {
  const tl = buildTimeline(graph, 800);
  expect(tl.dependencies).toContainEqual({ fromKey: 'A', toKey: 'B' });
});

test('empty when no node has dates', () => {
  const none: Graph = { nodes: [n('X', 'task')], edges: [] };
  expect(buildTimeline(none, 800).rows.every((r) => r.bars.length === 0)).toBe(true);
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/graph/timeline.test.ts`

- [ ] **Step 3: Implement** — `src/graph/timeline.ts`
```ts
import type { Graph, GraphNode } from '../core/model';

export interface TimelineBar { key: string; node: GraphNode; x: number; width: number }
export interface TimelineRow { epicKey: string; label: string; bars: TimelineBar[] }
export interface TimelineModel {
  rows: TimelineRow[];
  undated: GraphNode[];
  dependencies: Array<{ fromKey: string; toKey: string }>;
  minMs: number; maxMs: number;
}

const DAY = 86_400_000;
const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN);

export function buildTimeline(graph: Graph, pixelWidth: number): TimelineModel {
  const dated = graph.nodes.filter((n) => n.dueDate || n.startDate);
  const undated = graph.nodes.filter((n) => !n.dueDate && !n.startDate);

  // time span across all start/due values
  let minMs = Infinity, maxMs = -Infinity;
  for (const n of dated) {
    const s = ms(n.startDate), d = ms(n.dueDate);
    for (const v of [s, d]) if (!Number.isNaN(v)) { minMs = Math.min(minMs, v); maxMs = Math.max(maxMs, v); }
  }
  if (!Number.isFinite(minMs)) { minMs = 0; maxMs = DAY; }
  if (maxMs === minMs) maxMs = minMs + DAY;
  const scale = pixelWidth / (maxMs - minMs);
  const xOf = (v: number) => (v - minMs) * scale;

  const bar = (n: GraphNode): TimelineBar => {
    const s = Number.isNaN(ms(n.startDate)) ? ms(n.dueDate) : ms(n.startDate);
    const e = Number.isNaN(ms(n.dueDate)) ? ms(n.startDate) : ms(n.dueDate);
    const x = xOf(Math.min(s, e));
    const width = Math.max(6, xOf(Math.max(s, e)) - x);
    return { key: n.key, node: n, x, width };
  };

  // group dated issues by their epic (via hierarchy edges); fall back to '__no_epic__'
  const epicOf = new Map<string, string>();
  for (const e of graph.edges) if (e.kind === 'hierarchy') epicOf.set(e.target, e.source);
  const rowMap = new Map<string, TimelineRow>();
  const nodeMap = new Map(graph.nodes.map((n) => [n.key, n]));
  for (const n of dated) {
    if (n.type.kind === 'epic') continue; // epics are row headers, not bars
    let epicKey = epicOf.get(n.key) ?? '__no_epic__';
    // climb to the epic level if the immediate parent is a story/task
    let guard = 0;
    while (epicKey !== '__no_epic__' && nodeMap.get(epicKey)?.type.kind !== 'epic' && guard++ < 10) {
      epicKey = epicOf.get(epicKey) ?? '__no_epic__';
    }
    const label = epicKey === '__no_epic__' ? 'No epic' : (nodeMap.get(epicKey)?.summary ?? epicKey);
    const row = rowMap.get(epicKey) ?? { epicKey, label, bars: [] };
    if (!rowMap.has(epicKey)) rowMap.set(epicKey, row);
    row.bars.push(bar(n));
  }

  const datedKeys = new Set(dated.map((n) => n.key));
  const dependencies = graph.edges
    .filter((e) => e.kind === 'link' && e.relation === 'blocks' && datedKeys.has(e.source) && datedKeys.has(e.target))
    .map((e) => ({ fromKey: e.source, toKey: e.target }));

  return { rows: [...rowMap.values()], undated, dependencies, minMs, maxMs };
}
```
Note: `Date.parse` of an ISO date is allowed here (this is application code, not a workflow script).

- [ ] **Step 4: Run → PASS** — `npx vitest run src/graph/timeline.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/graph/timeline.ts src/graph/timeline.test.ts
git commit -m "feat: timeline/Gantt geometry from issue dates"
```

---

### Task 14: TimelineView component

**Files:** Create `src/components/TimelineView.tsx`, `src/components/timeline.css`

UI task — build with **frontend-design** (date-axis ticks/month labels, epic header rows, bars colored by kind/status with the key+summary inside, `blocks` arrows between bars, an "undated" footer chip list, and a friendly empty state when there are no dated issues). Behaviors: bar click calls `onSelect`; filters hide bars. Baseline:

`src/components/TimelineView.tsx`:
```tsx
import { useMemo, useRef, useState, useEffect } from 'react';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import { buildTimeline } from '../graph/timeline';
import './timeline.css';

const KIND_COLOR: Record<string, string> = { epic: '#7b61ff', story: '#3ebd93', task: '#2186eb', subtask: '#a0aec0', bug: '#e12d39', other: '#7b8794' };
const ROW_H = 38, BAR_H = 22;

export function TimelineView({ graph, state, onSelect }: { graph: Graph; state: GraphState; onSelect: (k: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => { if (ref.current) setWidth(Math.max(600, ref.current.clientWidth - 220)); }, []);

  const tl = useMemo(() => buildTimeline(graph, width), [graph, width]);
  const visible = (kind: string, cat: string) => !state.hiddenTypes.has(kind as any) && !state.hiddenStatuses.has(cat as any);
  const hasBars = tl.rows.some((r) => r.bars.length);

  if (!hasBars) {
    return <div className="timeline-empty" ref={ref}>No scheduled issues. This dataset has no start/due dates — try the Cloud v3 sample, or pick a different mode.</div>;
  }

  let y = 0;
  return (
    <div className="timeline" ref={ref}>
      <svg width={width + 240} height={tl.rows.reduce((s, r) => s + ROW_H * (r.bars.length + 1), 0) + 40}>
        {tl.rows.map((row) => {
          const headerY = y; y += ROW_H;
          const header = (
            <text key={`h-${row.epicKey}`} x={8} y={headerY + 22} className="tl-epic">{row.label}</text>
          );
          const bars = row.bars.filter((b) => visible(b.node.type.kind, b.node.status.category)).map((b) => {
            const by = y; y += ROW_H;
            return (
              <g key={b.key} className="tl-bar" onClick={() => onSelect(b.key)}>
                <rect x={220 + b.x} y={by + (ROW_H - BAR_H) / 2} width={b.width} height={BAR_H} rx={5} fill={KIND_COLOR[b.node.type.kind]} opacity={0.9} />
                <text x={8} y={by + 24} className="tl-key">{b.key}</text>
                <text x={220 + b.x + 6} y={by + 24} className="tl-sum">{b.node.summary}</text>
              </g>
            );
          });
          return <g key={row.epicKey}>{header}{bars}</g>;
        })}
      </svg>
      {tl.undated.length > 0 && (
        <div className="tl-undated"><span className="label">No dates</span> {tl.undated.map((u) => <button key={u.key} onClick={() => onSelect(u.key)}>{u.key}</button>)}</div>
      )}
    </div>
  );
}
```
`blocks` arrows between bars: in the frontend-design pass, draw an SVG path from each `dependencies` entry's `from` bar right-edge to its `to` bar left-edge (look up bar positions by key). The baseline omits arrows; add them during the frontend-design step.

`src/components/timeline.css` (baseline; frontend-design refines):
```css
.timeline { height: 100%; overflow: auto; background: #fff; font-family: ui-sans-serif, system-ui; }
.timeline-empty { padding: 40px; color: #7b8794; font-family: ui-sans-serif, system-ui; }
.tl-epic { font: 700 12px ui-sans-serif; fill: #5a45c7; }
.tl-key { font: 700 10px ui-monospace, monospace; fill: #52606d; }
.tl-sum { font: 600 11px ui-sans-serif; fill: #fff; }
.tl-bar { cursor: pointer; }
.tl-undated { padding: 10px 14px; border-top: 1px solid #e1e7ef; }
.tl-undated button { margin: 0 4px; font: 700 10px ui-monospace, monospace; border: 1px solid #e1e7ef; border-radius: 10px; background: #f5f7fa; padding: 2px 7px; cursor: pointer; }
```

- [ ] **Step 2: Verify build** — `npm run build` clean.
- [ ] **Step 3: Commit**
```bash
git add src/components/TimelineView.tsx src/components/timeline.css
git commit -m "feat: TimelineView Gantt (visual via frontend-design)"
```

---

### Task 15: Wire Timeline mode + final run verify

**Files:** Modify `src/App.tsx`

- [ ] **Step 1:** Complete the viewMode switch:
```tsx
{state.viewMode === 'grouped' ? <GroupedCanvas .../>
 : state.viewMode === 'tree' ? <TreeView .../>
 : state.viewMode === 'timeline' ? <TimelineView graph={view} state={state} onSelect={(key) => dispatch({ type: 'select', key })} />
 : <GraphCanvas .../>}
```
Import `TimelineView`.

- [ ] **Step 2: Final verify.** `npm test` (all pass), `npm run build` (clean). `npm run dev`: cycle all four modes on the **Cloud v3** dataset — graph, grouped (depths 1/2/3 + collapse), tree (carets + badges), timeline (bars grouped by epic, undated chips). Switch to **v2 — Epic Link absent** and confirm grouped/tree degrade sensibly and timeline still works (or shows the empty state if its dataset lacks dates). No console errors in any mode.

- [ ] **Step 3: Commit**
```bash
git add src/App.tsx
git commit -m "feat: render timeline mode; all four view modes live"
```

---

# PHASE D — Docs

### Task 16: Update README + screenshots

**Files:** Modify `README.md`; add `docs/screenshot-grouped.png`, `docs/screenshot-timeline.png`

- [ ] **Step 1:** Add a **View modes** section to README describing the four modes (graph, grouped + depth control, tree, timeline) and the date model (normalized from Jira `duedate`/sprint, feature-detected, synthesized in fixtures). Note timeline degrades gracefully when no dates exist. Capture screenshots of grouped and timeline modes (run the app) and embed them.
- [ ] **Step 2:** Verify `npm run build` clean.
- [ ] **Step 3: Commit**
```bash
git add README.md docs/screenshot-grouped.png docs/screenshot-timeline.png
git commit -m "docs: document the four view modes with screenshots"
```

---

## Self-Review notes (reconciled)

- **Spec coverage:** mode switcher (T5), shared `viewMode` (T1); grouped containers + depth + collapse + clean ticket-to-ticket edges (T2–T7); tree + badges (T8–T10); timeline + date model + fixtures + graceful empty (T11–T15); frontend-design used for all three new view components (T5/T6/T9/T14); docs (T16).
- **Out of scope** (editing, real-time, virtualization, saved layouts, critical path, drag-reschedule) intentionally omitted.
- **Type consistency:** `ViewMode`/`GroupDepth`, `groupGraph`→`Grouping`/`GroupContainer`, `layoutGrouped`→`GroupedLayout`, `toGroupedElements`, `buildTree`→`TreeRow`/`TreeBadge`, `buildTimeline`→`TimelineModel`, and the new `Capabilities`/`GraphNode` date fields are used consistently across tasks. Tests keep `@xyflow/react` imports type-only for the node env.
- **Interim states:** selecting tree/timeline before Phases B/C land falls through to the graph view (documented in T7); resolved by T10/T15.
