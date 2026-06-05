# Jira Graph — Spotlight Mode + Two-View Simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the app to two views — **Overview** (the grouped container board) and **Spotlight** (a pure-DOM focus+context view) — delete the Graph/Tree/Timeline modes and their code, and fix the project-filter/arrow/minimap/tooltip bugs.

**Architecture:** A pure `spotlightModel(graph, key)` feeds a pure-DOM `SpotlightView`. The reducer is refactored to `viewMode: 'overview' | 'spotlight'` with a `focusHistory` breadcrumb. Overview reuses `GroupedCanvas`/`grouped-elements`/`routing`, fixed (filter containers, real obstacle sizes, built-in minimap).

**Tech Stack:** Existing — React 19 + TS + Vite + `@xyflow/react`, Vitest. No new deps.

**Spec:** `docs/superpowers/specs/2026-06-05-jira-graph-spotlight-redesign-design.md`

---

## Task 1: Spotlight model (pure)

**Files:** Create `src/graph/spotlight.ts`; Test `src/graph/spotlight.test.ts`

- [ ] **Step 1: Failing test** — `src/graph/spotlight.test.ts`
```ts
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
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/graph/spotlight.test.ts`

- [ ] **Step 3: Implement** — `src/graph/spotlight.ts`
```ts
import type { Graph, GraphNode } from '../core/model';

export interface SpotlightModel {
  hero: GraphNode;
  epic?: GraphNode;
  parent?: GraphNode;
  children: GraphNode[];
  blocks: GraphNode[];
  blockedBy: GraphNode[];
  relates: GraphNode[];
  other: { relation: string; label: string; node: GraphNode; outward: boolean }[];
}

const UNDIRECTED = new Set(['relates', 'relate', 'relates to']);

export function spotlightModel(graph: Graph, focusKey: string): SpotlightModel | null {
  const byKey = new Map(graph.nodes.map((n) => [n.key, n]));
  const hero = byKey.get(focusKey);
  if (!hero) return null;

  const used = new Set<string>([focusKey]);
  const take = (key: string | undefined): GraphNode | undefined => {
    if (!key || used.has(key)) return undefined;
    const node = byKey.get(key);
    if (!node) return undefined;
    used.add(key);
    return node;
  };

  // Epic (resolved ancestor) first, then direct hierarchy parent.
  const epic = hero.type.kind === 'epic' ? undefined : take(hero.epicKey);

  let parent: GraphNode | undefined;
  const children: GraphNode[] = [];
  const blocks: GraphNode[] = [];
  const blockedBy: GraphNode[] = [];
  const relates: GraphNode[] = [];
  const other: SpotlightModel['other'] = [];

  for (const e of graph.edges) {
    if (e.kind === 'hierarchy') {
      if (e.target === focusKey) { const p = take(e.source); if (p) parent = p; }
      else if (e.source === focusKey) { const c = take(e.target); if (c) children.push(c); }
      continue;
    }
    // link edges
    const outward = e.source === focusKey;
    const inward = e.target === focusKey;
    if (!outward && !inward) continue;
    const otherKey = outward ? e.target : e.source;
    const node = take(otherKey);
    if (!node) continue;
    const rel = e.relation.toLowerCase();
    if (rel === 'blocks') { (outward ? blocks : blockedBy).push(node); }
    else if (UNDIRECTED.has(rel)) { relates.push(node); }
    else { other.push({ relation: rel, label: e.label, node, outward }); }
  }

  return { hero, epic, parent, children, blocks, blockedBy, relates, other };
}
```

- [ ] **Step 4: Run → PASS** — `npx vitest run src/graph/spotlight.test.ts`; `npx tsc --noEmit`.

- [ ] **Step 5: Commit**
```bash
git add src/graph/spotlight.ts src/graph/spotlight.test.ts
git commit -m "feat: pure spotlight relationship model"
```

---

## Task 2: The refactor — reducer + delete old modes + wire two-view app

This is a single coordinated change (everything must compile together). Do it carefully; get to a green build with Overview working and a Spotlight STUB (full Spotlight is Task 3).

**Files:** Modify `src/state/graphReducer.ts` (+ rewrite its tests), `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/GroupedCanvas.tsx`, `src/components/TicketTypeahead.tsx`; Create stub `src/components/SpotlightView.tsx`; DELETE the modules listed below.

- [ ] **Step 1: Refactor `src/state/graphReducer.ts`** to exactly:
```ts
import type { IssueKind, StatusCategory } from '../core/model';

export type ViewMode = 'overview' | 'spotlight';
export type GroupDepth = 1 | 2 | 3 | 4;

export interface GraphState {
  viewMode: ViewMode;
  focusKey: string | null;
  focusHistory: string[];
  groupDepth: GroupDepth;
  collapsed: Set<string>;
  hiddenTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  hiddenProjects: Set<string>;
  hiddenAssignees: Set<string>;
  hiddenRelations: Set<string>;
  search: string;
  selectedKey: string | null;
  selectedEdge: { id: string; x: number; y: number; srcKey: string; tgtKey: string; relation: string; label: string } | null;
}

export const initialState: GraphState = {
  viewMode: 'overview', focusKey: null, focusHistory: [],
  groupDepth: 4, collapsed: new Set(),
  hiddenTypes: new Set(), hiddenStatuses: new Set(), hiddenProjects: new Set(), hiddenAssignees: new Set(), hiddenRelations: new Set(),
  search: '', selectedKey: null, selectedEdge: null,
};

export type Action =
  | { type: 'setViewMode'; viewMode: ViewMode }
  | { type: 'openSpotlight'; key: string }
  | { type: 'spotlightBack' }
  | { type: 'setGroupDepth'; depth: GroupDepth }
  | { type: 'toggleCollapsed'; key: string }
  | { type: 'toggleType'; kind: IssueKind }
  | { type: 'toggleStatus'; status: StatusCategory }
  | { type: 'toggleProject'; key: string }
  | { type: 'toggleAssignee'; name: string }
  | { type: 'toggleRelation'; relation: string }
  | { type: 'setSearch'; query: string }
  | { type: 'select'; key: string | null }
  | { type: 'selectEdge'; id: string; x: number; y: number; srcKey: string; tgtKey: string; relation: string; label: string }
  | { type: 'clearEdge' };

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

export function reducer(state: GraphState, action: Action): GraphState {
  switch (action.type) {
    case 'setViewMode': return { ...state, viewMode: action.viewMode };
    case 'openSpotlight': {
      const pushPrev = state.viewMode === 'spotlight' && !!state.focusKey && state.focusKey !== action.key;
      const focusHistory = pushPrev ? [...state.focusHistory, state.focusKey!] : state.focusHistory;
      return { ...state, viewMode: 'spotlight', focusKey: action.key, focusHistory, selectedKey: action.key, selectedEdge: null };
    }
    case 'spotlightBack': {
      if (state.focusHistory.length === 0) return { ...state, viewMode: 'overview' };
      const prev = state.focusHistory[state.focusHistory.length - 1];
      return { ...state, focusKey: prev, focusHistory: state.focusHistory.slice(0, -1), selectedKey: prev };
    }
    case 'setGroupDepth': return { ...state, groupDepth: action.depth };
    case 'toggleCollapsed': return { ...state, collapsed: toggle(state.collapsed, action.key) };
    case 'toggleType': return { ...state, hiddenTypes: toggle(state.hiddenTypes, action.kind) };
    case 'toggleStatus': return { ...state, hiddenStatuses: toggle(state.hiddenStatuses, action.status) };
    case 'toggleProject': return { ...state, hiddenProjects: toggle(state.hiddenProjects, action.key) };
    case 'toggleAssignee': return { ...state, hiddenAssignees: toggle(state.hiddenAssignees, action.name) };
    case 'toggleRelation': return { ...state, hiddenRelations: toggle(state.hiddenRelations, action.relation) };
    case 'setSearch': return { ...state, search: action.query };
    case 'select': return { ...state, selectedKey: action.key, selectedEdge: null };
    case 'selectEdge': return { ...state, selectedEdge: { id: action.id, x: action.x, y: action.y, srcKey: action.srcKey, tgtKey: action.tgtKey, relation: action.relation, label: action.label }, selectedKey: null };
    case 'clearEdge': return { ...state, selectedEdge: null };
    default: return state;
  }
}
```

- [ ] **Step 2: Replace the reducer test suite.** DELETE `src/state/graphReducer.test.ts`, `graphReducer.viewmodes.test.ts`, `graphReducer.filters.test.ts`, `graphReducer.edge.test.ts`. Create one `src/state/graphReducer.test.ts`:
```ts
import { initialState, reducer } from './graphReducer';

test('defaults: overview, depth 4, empty history/filters', () => {
  expect(initialState.viewMode).toBe('overview');
  expect(initialState.groupDepth).toBe(4);
  expect(initialState.focusHistory).toEqual([]);
  expect(initialState.focusKey).toBeNull();
});

test('openSpotlight from overview enters spotlight without pushing history', () => {
  const s = reducer(initialState, { type: 'openSpotlight', key: 'A' });
  expect(s.viewMode).toBe('spotlight');
  expect(s.focusKey).toBe('A');
  expect(s.focusHistory).toEqual([]);
  expect(s.selectedKey).toBe('A');
});

test('openSpotlight while already spotlighting pushes the previous hero', () => {
  const a = reducer(initialState, { type: 'openSpotlight', key: 'A' });
  const b = reducer(a, { type: 'openSpotlight', key: 'B' });
  expect(b.focusKey).toBe('B');
  expect(b.focusHistory).toEqual(['A']);
});

test('spotlightBack pops to the previous hero, then to overview', () => {
  let s = reducer(initialState, { type: 'openSpotlight', key: 'A' });
  s = reducer(s, { type: 'openSpotlight', key: 'B' });
  s = reducer(s, { type: 'spotlightBack' });
  expect(s.focusKey).toBe('A');
  expect(s.focusHistory).toEqual([]);
  s = reducer(s, { type: 'spotlightBack' });
  expect(s.viewMode).toBe('overview');
});

test('setViewMode, group depth, filters, select, selectEdge', () => {
  expect(reducer(initialState, { type: 'setViewMode', viewMode: 'spotlight' }).viewMode).toBe('spotlight');
  expect(reducer(initialState, { type: 'setGroupDepth', depth: 2 }).groupDepth).toBe(2);
  expect(reducer(initialState, { type: 'toggleProject', key: 'CHK' }).hiddenProjects.has('CHK')).toBe(true);
  expect(reducer(initialState, { type: 'toggleAssignee', name: 'Sam' }).hiddenAssignees.has('Sam')).toBe(true);
  expect(reducer(initialState, { type: 'toggleType', kind: 'bug' }).hiddenTypes.has('bug')).toBe(true);
  expect(reducer(initialState, { type: 'toggleCollapsed', key: 'E' }).collapsed.has('E')).toBe(true);
  const e = reducer(initialState, { type: 'selectEdge', id: 'x', x: 1, y: 2, srcKey: 'A', tgtKey: 'B', relation: 'blocks', label: 'blocks' });
  expect(e.selectedEdge?.id).toBe('x');
  expect(reducer(e, { type: 'clearEdge' }).selectedEdge).toBeNull();
});
```

- [ ] **Step 3: DELETE these files** (git rm):
```
src/components/GraphCanvas.tsx
src/components/TreeView.tsx
src/components/TimelineView.tsx
src/components/NodePopup.tsx
src/components/CanvasChrome.tsx
src/components/node-popup.css
src/components/tree.css
src/components/timeline.css
src/graph/flow-elements.ts
src/graph/flow-elements.test.ts
src/graph/tree.ts
src/graph/tree.test.ts
src/graph/timeline.ts
src/graph/timeline.test.ts
src/graph/layouts/hierarchical.ts
src/graph/layouts/hierarchical.test.ts
src/graph/layouts/force.ts
src/graph/layouts/force.test.ts
src/graph/layouts/hybrid.ts
src/graph/layouts/hybrid.test.ts
src/graph/layouts/shared.ts
src/graph/layouts/index.ts
```
KEEP: `src/graph/layouts/grouped.ts`, `src/graph/layouts/types.ts`, `src/graph/routing.ts`, `src/components/RoutedEdge.tsx`, `src/graph/grouped-elements.ts`, `src/components/GroupedCanvas.tsx`, `src/components/EdgePopup.tsx`, `src/graph/node-dimensions.ts`, `src/graph/relation-colors.ts`, `src/graph/relationships.ts`, `src/graph/visible.ts`.

- [ ] **Step 4: Create stub `src/components/SpotlightView.tsx`** (full build in Task 3) so App compiles:
```tsx
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { spotlightModel } from '../graph/spotlight';

export function SpotlightView({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const model = state.focusKey ? spotlightModel(graph, state.focusKey) : null;
  if (!model) return <div style={{ padding: 24, color: 'var(--ink-muted)' }}>Click a ticket in Overview to spotlight it.</div>;
  return (
    <div style={{ padding: 24, color: 'var(--ink)' }}>
      <button onClick={() => dispatch({ type: 'spotlightBack' })}>← Back</button>
      <h2>{model.hero.key} · {model.hero.summary}</h2>
    </div>
  );
}
```

- [ ] **Step 5: `src/components/GroupedCanvas.tsx` updates:**
  - Apply the filter BEFORE layout: `const grouping = filterGroupingForState(groupGraph(graph, state.groupDepth), state);` then `layoutGrouped(grouping)` + `toGroupedElements(graph, grouping, layout, state)`. Import `filterGroupingForState` from `../graph/grouped-elements`. (This fixes empty boxes on project/assignee untoggle.)
  - Replace the custom `CanvasChrome` with React Flow's built-in chrome: `import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react'` and render `<Background color="var(--bg-grid)" /><Controls /><MiniMap pannable zoomable style={{ background: 'var(--surface)' }} />` inside `<ReactFlow>`. Remove the `CanvasChrome` import/usage and the `locked` state if it only existed for the custom chrome (keep it simple — built-in Controls suffices).
  - Node click → spotlight: `onNodeClick={(_, n) => n.type === 'ticket' && onNodeOpen?.(n.id)}` where `onNodeOpen?: (id: string) => void`. (Drop the x/y coords — Spotlight doesn't need a popover position.)
  - Keep `onEdgeClick` → `onEdgeClick` prop (EdgePopup). Keep `nodesConnectable={false}` and the obstacle-rect memo (containers `data.width/height`, members `GROUP.CHIP_W/H`).

- [ ] **Step 6: `src/components/Sidebar.tsx` updates:**
  - Mode nav: two buttons, **Overview** (`setViewMode('overview')`, active when `viewMode==='overview'`) and **Spotlight** (active when `viewMode==='spotlight'`; on click, if `state.focusKey` set → `setViewMode('spotlight')`, else no-op/disabled with title "Click a ticket to spotlight it"). Give both `title` tooltips.
  - REMOVE the layout switcher (LATOUT segmented) and the focus-mode depth slider section. REMOVE any `setLayout`/`setMode`/`setDepth`/`setFocus` dispatches and the `LayoutKind` import.
  - KEEP the group-depth control (Epic/Story/Task/Subtask → `setGroupDepth`), Search, Projects/Assignees/Types filters, Relationships legend, dataset picker, theme toggle, and the Focus-a-ticket typeahead.

- [ ] **Step 7: `src/components/TicketTypeahead.tsx`** — change the selection dispatch from `setFocus` to `openSpotlight`.

- [ ] **Step 8: `src/App.tsx` updates:**
  - Remove imports/renders of `GraphCanvas`, `TreeView`, `TimelineView`, `NodePopup`, `BackButton` (if BackButton only served focus mode — Spotlight has its own back; you may keep BackButton out). Keep `EdgePopup`.
  - Render by viewMode: `state.viewMode === 'spotlight' ? <SpotlightView graph={view} state={state} dispatch={dispatch} /> : <GroupedCanvas graph={view} state={state} dispatch={dispatch} onNodeOpen={(id) => dispatch({ type: 'openSpotlight', key: id })} onEdgeClick={(p) => dispatch({ type: 'selectEdge', ...p })} />`.
  - Keep `<EdgePopup graph={view} state={state} dispatch={dispatch} />` in `.app-main` (overview edge clicks).
  - The `Sidebar` still receives `graph={full}` (filter lists need the full graph). Spotlight should use the FULL graph too (so related tickets aren't hidden by filters) — pass `graph={full}` to `SpotlightView`. (Overview uses the filtered `view`.)
  - Dataset default stays `'large'`.

- [ ] **Step 9: Verify** — `npm test` (the deleted tests are gone; remaining + new reducer + spotlight tests pass), `npx tsc --noEmit` clean, `npm run build` clean. Grep to confirm no dangling imports of deleted modules: `grep -rn "GraphCanvas\|TreeView\|TimelineView\|NodePopup\|CanvasChrome\|flow-elements\|graph/tree\|graph/timeline\|layouts/hierarchical\|layouts/force\|layouts/hybrid\|layouts/shared\|layouts/index\|LayoutKind\|setLayout\|setFocus\|openNode\|nodePopup\|state.mode\|state.depth\|state.layout" src/` → only expected (none in live code).

- [ ] **Step 10: Commit**
```bash
git add -A
git commit -m "refactor: two-view app (overview + spotlight stub); delete graph/tree/timeline modes; fix overview filter + minimap"
```

---

## Task 3: SpotlightView (full) — frontend-design

**Files:** Rewrite `src/components/SpotlightView.tsx`; Create `src/components/spotlight.css`

UI task — build with the **frontend-design** skill for a calm, beautiful, ultra-readable result in dark + light. Verified by running the app.

- [ ] **Step 1: Invoke frontend-design** for the Spotlight layout. Requirements:
  - **Breadcrumb bar** (top): the `focusHistory` keys + current `focusKey` as a clickable trail (clicking a crumb dispatches `openSpotlight` for that key); a **← Back** button (`spotlightBack`); an **Overview** button (`setViewMode('overview')`).
  - **Hero card** (center, prominent): key (kind-colored, mono), summary (large), type · priority, status pill, assignee, story points, epic badge (▣ epicKey), and the `description` (scroll if long). "Open in Jira ↗".
  - **Lanes** around the hero (omit empty ones), each a labeled column of compact related cards:
    - **▲ Epic / Parent** (above): `model.epic` then `model.parent`.
    - **◄ Blocked by** (left): `model.blockedBy`.
    - **► Blocks** (right): `model.blocks`.
    - **▼ Subtasks / Children** (below): `model.children`.
    - **↔ Relates** + **Other** (a row beneath): `model.relates` and `model.other`.
  - Use a CSS grid (e.g. 3×3 with hero centered; relates/other span the bottom). Lane labels color-matched to the relationship (use `relationStyle(...).colorVar` for blocks/relates; `--kind-epic` for epic). Each related card click → `dispatch({ type: 'openSpotlight', key })`. Thin decorative connector accents from hero to each lane (CSS borders or a light SVG) — purely cosmetic, no routing.
  - All theme tokens; smooth but minimal motion (fade on focus change). Responsive; lanes scroll independently.
  - Empty/edge cases: hero with no relations shows just the hero centered with a note "No linked tickets."

  Baseline structure to start from (frontend-design refines the visuals):
```tsx
import type { Dispatch } from 'react';
import type { Graph, GraphNode } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { spotlightModel } from '../graph/spotlight';
import { relationStyle } from '../graph/relation-colors';
import './spotlight.css';

function MiniCard({ node, accent, onOpen }: { node: GraphNode; accent: string; onOpen: (k: string) => void }) {
  return (
    <button className="sp-card" style={{ borderLeftColor: accent }} onClick={() => onOpen(node.key)}>
      <span className="sp-card-k" style={{ color: `var(--kind-${node.type.kind})` }}>{node.key}</span>
      <span className="sp-card-s">{node.summary}</span>
      <span className="sp-card-dot" style={{ background: `var(--status-${node.status.category})` }} />
    </button>
  );
}

export function SpotlightView({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const model = state.focusKey ? spotlightModel(graph, state.focusKey) : null;
  const open = (k: string) => dispatch({ type: 'openSpotlight', key: k });
  if (!model) return <div className="sp-empty">Click a ticket in Overview to spotlight it.</div>;
  const h = model.hero;
  const trail = [...state.focusHistory, h.key];
  const Lane = ({ label, accent, nodes }: { label: string; accent: string; nodes: GraphNode[] }) =>
    nodes.length ? (
      <div className="sp-lane">
        <div className="sp-lane-label" style={{ color: accent }}>{label}</div>
        {nodes.map((node) => <MiniCard key={node.key} node={node} accent={accent} onOpen={open} />)}
      </div>
    ) : null;
  return (
    <div className="spotlight">
      <div className="sp-crumbs">
        <button onClick={() => dispatch({ type: 'spotlightBack' })}>← Back</button>
        <button onClick={() => dispatch({ type: 'setViewMode', viewMode: 'overview' })}>Overview</button>
        <span className="sp-trail">{trail.map((k, i) => <button key={k + i} className={k === h.key ? 'on' : ''} onClick={() => open(k)}>{k}</button>)}</span>
      </div>
      <div className="sp-grid">
        <div className="sp-top">
          <Lane label="▲ Epic / Parent" accent="var(--kind-epic)" nodes={[model.epic, model.parent].filter(Boolean) as GraphNode[]} />
        </div>
        <div className="sp-left"><Lane label="◄ Blocked by" accent={relationStyle('blocks').colorVar} nodes={model.blockedBy} /></div>
        <div className="sp-hero">
          <div className="sp-hero-card" style={{ borderTopColor: `var(--kind-${h.type.kind})` }}>
            <div className="sp-hero-head"><span className="sp-hero-k" style={{ color: `var(--kind-${h.type.kind})` }}>{h.key}</span>{h.epicKey && h.type.kind !== 'epic' && <span className="sp-epic">▣ {h.epicKey}</span>}</div>
            <h2 className="sp-hero-title">{h.summary}</h2>
            <div className="sp-hero-meta"><span className="sp-pill" style={{ color: `var(--status-${h.status.category})` }}>{h.status.name}</span><span>{h.type.name}{h.priority ? ` · ${h.priority}` : ''}</span>{h.storyPoints != null && <span>{h.storyPoints} pts</span>}{h.assignee && <span className="sp-av">{h.assignee.initials}</span>}</div>
            {h.description && <p className="sp-hero-desc">{h.description}</p>}
            <a className="sp-open" href={h.url} target="_blank" rel="noreferrer">Open in Jira ↗</a>
          </div>
        </div>
        <div className="sp-right"><Lane label="Blocks ►" accent={relationStyle('blocks').colorVar} nodes={model.blocks} /></div>
        <div className="sp-bottom"><Lane label="▼ Subtasks" accent="var(--kind-subtask)" nodes={model.children} /></div>
        <div className="sp-extra">
          <Lane label="↔ Relates" accent={relationStyle('relates').colorVar} nodes={model.relates} />
          {model.other.length > 0 && <Lane label="Other" accent="var(--rel-default)" nodes={model.other.map((o) => o.node)} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `spotlight.css`** — grid placement (`.sp-grid` a 3-col × rows grid: `.sp-top` top-center, `.sp-left` left-middle, `.sp-hero` center, `.sp-right` right-middle, `.sp-bottom` bottom-center, `.sp-extra` full-width below), hero card styling, lane labels, mini-cards, breadcrumb bar — all tokens, dark+light. frontend-design owns the polish (spacing, depth, motion, connector accents).

- [ ] **Step 3: Verify** — `npm run build` clean; `npm test` green.

- [ ] **Step 4: Commit**
```bash
git add src/components/SpotlightView.tsx src/components/spotlight.css
git commit -m "feat: full Spotlight view (frontend-design)"
```

---

## Task 4: QA pass + polish

- [ ] **Step 1: Run the app** (`npm run dev`) and verify in BOTH themes:
  - Overview is the default; epics as boxes with nested story▸task▸subtask + cross-epic links.
  - Untoggling a project REMOVES its containers entirely (no empty boxes).
  - Cross-epic link arrows route around cards (no clipping); built-in minimap drag tracks the cursor correctly.
  - Clicking a ticket → Spotlight; lanes correct; clicking a related ticket re-centers; breadcrumb + Back + Overview work.
  - Mode buttons have tooltips. Theme toggle reskins both views.
- [ ] **Step 2:** Fix any issues found (commit each fix). Apply a light frontend-design touch-up to the Overview cards if needed for cohesion with Spotlight.

---

## Task 5: Docs

- [ ] **Step 1:** Update `README.md`: the app is now **Overview + Spotlight** (remove Graph/Tree/Timeline from features, view-modes, architecture diagram, and file tree); document Spotlight (focus+context, breadcrumbs) and that Overview is the grouped board. Update the test count. Replace stale screenshots with an Overview + a Spotlight screenshot (capture from the running app).
- [ ] **Step 2:** `npm run build` clean.
- [ ] **Step 3: Commit**
```bash
git add README.md docs/*.png
git commit -m "docs: two-view app (Overview + Spotlight)"
```

---

## Self-Review notes (reconciled)

- **Spec coverage:** Spotlight model (T1) + view (T3); reducer two-view + history (T2); delete graph/tree/timeline + their code (T2 Step 3); Overview kept + filter-container fix + built-in minimap + obstacle sizes + node-click→spotlight (T2 Steps 5–8); Sidebar simplified + tooltips + typeahead→spotlight (T2 Steps 6–7); EdgePopup kept; bug QA (T4); docs (T5).
- **Removed-test fallout:** the four reducer test files are replaced by one (T2 Step 2); the deleted modules' tests are removed (T2 Step 3). Net test count drops then rises with spotlight/reducer tests — expected.
- **Type consistency:** `ViewMode = 'overview'|'spotlight'`, `focusHistory`, `openSpotlight`/`spotlightBack`; `spotlightModel`→`SpotlightModel`; `onNodeOpen(id)` (no coords) on GroupedCanvas; `filterGroupingForState` applied before `layoutGrouped`. No references to removed `mode`/`depth`/`layout`/`nodePopup`/`LayoutKind` remain.
