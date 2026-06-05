# Jira Graph — Filtering, Focus Navigation, Deep Grouping & Large Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project/assignee/ticket filtering, a click-to-overview popup with focus navigation + back button, full hierarchy nesting in grouped mode, epic badges on cards, removal of connection handles, and a large multi-project test dataset.

**Architecture:** Additive `GraphNode` fields (project/description/epicKey); a shared `isNodeVisible` predicate used by every view; a `ticketRelationships` helper feeding a `NodePopup` overview; reducer gains filter sets + `nodePopup` + deeper `GroupDepth`; a generated large fixture.

**Tech Stack:** Existing — React 19 + TS + Vite + `@xyflow/react`, Vitest. No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-05-jira-graph-filtering-focus-design.md`

**Existing state shape** (`GraphState`, do not remove fields): `mode, focusKey, depth, layout, hiddenTypes, hiddenStatuses, hiddenRelations, search, selectedKey, viewMode, groupDepth, collapsed, selectedEdge`. Tests currently: 81 passing. Keep `@xyflow/react` imports type-only in `flow-elements.ts`/`grouped-elements.ts`/`visible.ts`/`relationships.ts`.

---

# PHASE 1 — Data model: project, description, epic resolution

### Task 1: GraphNode fields + normalize (project + description)

**Files:** Modify `src/core/model.ts`, `src/core/normalize.ts`; Test `src/core/normalize.project.test.ts`

- [ ] **Step 1: model.ts** — add to `GraphNode` interface:
```ts
  project: { key: string; name: string };
  description?: string;
  epicKey?: string;
  epicSummary?: string;
```

- [ ] **Step 2: Failing test** — `src/core/normalize.project.test.ts`
```ts
import { normalizeIssue } from './normalize';
import type { Capabilities } from './model';
const caps: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false };
const it = { name: 'Story', subtask: false };

test('reads project from fields.project', () => {
  const raw = { key: 'CHK-10', fields: { summary: 's', issuetype: it, status: {}, project: { key: 'CHK', name: 'Checkout' } } };
  expect(normalizeIssue(raw, caps).node.project).toEqual({ key: 'CHK', name: 'Checkout' });
});

test('falls back to the issue-key prefix when project is absent', () => {
  const raw = { key: 'CHK-10', fields: { summary: 's', issuetype: it, status: {} } };
  expect(normalizeIssue(raw, caps).node.project).toEqual({ key: 'CHK', name: 'CHK' });
});

test('flattens description via adfToText', () => {
  const raw = { key: 'CHK-10', fields: { summary: 's', issuetype: it, status: {}, description: 'plain text' } };
  expect(normalizeIssue(raw, caps).node.description).toBe('plain text');
});
```

- [ ] **Step 3: Run → FAIL** — `npx vitest run src/core/normalize.project.test.ts`

- [ ] **Step 4: Implement** — in `normalizeIssue` (src/core/normalize.ts), import `adfToText` from `./adf` and add to the constructed node object:
```ts
    project: f.project ? { key: f.project.key, name: f.project.name ?? f.project.key }
                       : { key: String(raw.key).split('-')[0], name: String(raw.key).split('-')[0] },
    description: adfToText(f.description),
```
(Leave `epicKey`/`epicSummary` undefined here — set in Task 2.)

- [ ] **Step 5: Run → PASS** — `npx vitest run src/core/normalize.project.test.ts`; `npx vitest run src/core/` (no regressions); `npx tsc --noEmit` may now error in fixtures lacking `project` — that's expected and fixed in Task 3/Phase 2 where fixtures gain projects. If `tsc` errors ONLY in existing fixtures/tests because `project` is required, make `project` required but ensure normalize always sets it (it does) — type errors would only be in hand-built test nodes; if any existing test constructs a GraphNode literal without `project`, add `project: { key: 'X', name: 'X' }` to those literals. Fix such literals minimally to keep tsc clean.

- [ ] **Step 6: Commit**
```bash
git add src/core/model.ts src/core/normalize.ts src/core/normalize.project.test.ts
git commit -m "feat: project + description fields on normalized node"
```

### Task 2: Epic resolution in normalizeIssues

**Files:** Modify `src/core/normalize.ts`; Test `src/core/normalize.epic.test.ts`

- [ ] **Step 1: Failing test** — `src/core/normalize.epic.test.ts`
```ts
import { normalizeIssues } from './normalize';
import type { Capabilities } from './model';
const caps: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false };
function iss(key: string, kind: string, parent?: string, parentKind?: string) {
  return { key, fields: { summary: key + ' sum', issuetype: { name: kind, subtask: kind === 'Sub-task' }, status: {},
    project: { key: 'P', name: 'P' },
    ...(parent ? { parent: { key: parent, fields: { issuetype: { name: parentKind, subtask: false } } } } : {}) } };
}

test('descendants get epicKey + epicSummary from their epic ancestor', () => {
  const g = normalizeIssues([
    iss('EPIC-1', 'Epic'),
    iss('STORY-1', 'Story', 'EPIC-1', 'Epic'),
    iss('TASK-1', 'Task', 'STORY-1', 'Story'),
    iss('SUB-1', 'Sub-task', 'TASK-1', 'Task'),
  ], caps);
  const byKey = Object.fromEntries(g.nodes.map((n) => [n.key, n]));
  expect(byKey['TASK-1'].epicKey).toBe('EPIC-1');
  expect(byKey['SUB-1'].epicKey).toBe('EPIC-1');
  expect(byKey['STORY-1'].epicSummary).toBe('EPIC-1 sum');
  expect(byKey['EPIC-1'].epicKey).toBeUndefined(); // an epic has no epic
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/core/normalize.epic.test.ts`

- [ ] **Step 3: Implement** — in `normalizeIssues` (src/core/normalize.ts), after the `nodes`/`edges` are assembled and before returning, add epic resolution:
```ts
  // Resolve each non-epic node's epic ancestor from hierarchy edges.
  const parentOf = new Map<string, string>();
  for (const e of edges) if (e.kind === 'hierarchy') parentOf.set(e.target, e.source);
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  for (const node of nodes) {
    if (node.type.kind === 'epic') continue;
    let cur: string | undefined = parentOf.get(node.key);
    let guard = 0;
    while (cur && guard++ < 20) {
      const p = byKey.get(cur);
      if (p && p.type.kind === 'epic') { node.epicKey = p.key; node.epicSummary = p.summary; break; }
      cur = parentOf.get(cur);
    }
  }
```
(Place this in `normalizeIssues` which already returns `{ nodes, edges }`; the dangling-edge filter must run BEFORE or the parentOf map should be built from the filtered edges — build from the final `edges` array used in the return.)

- [ ] **Step 4: Run → PASS** — `npx vitest run src/core/normalize.epic.test.ts`; rerun `npx vitest run src/core/`.

- [ ] **Step 5: Commit**
```bash
git add src/core/normalize.ts src/core/normalize.epic.test.ts
git commit -m "feat: resolve epic ancestor (epicKey/epicSummary) for descendants"
```

---

# PHASE 2 — Large multi-project test data

### Task 3: Large fixture generator + register dataset

**Files:** Create `src/fixtures/large.ts`; Test `src/fixtures/large.test.ts`; Modify `src/App.tsx` (dataset option) + update existing fixtures to include `project` if their tsc broke

- [ ] **Step 1: Failing test** — `src/fixtures/large.test.ts`
```ts
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
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/fixtures/large.test.ts`

- [ ] **Step 3: Implement `src/fixtures/large.ts`** — a DETERMINISTIC generator (no `Math.random`; derive everything from indices). Structure:
  - `export const largeCaps: Capabilities = { apiVersion: 3, baseUrl: 'https://acme.atlassian.net', hasEpicLink: false, storyPointsFieldId: 'customfield_10016', startDateFieldId: 'customfield_10015', sprintFieldId: 'customfield_10020' }`.
  - Projects: `[{ key:'CHK', name:'Checkout Platform' }, { key:'SRCH', name:'Search & Discovery' }, { key:'MOB', name:'Mobile App' }]`.
  - Assignee pool (~10 names) e.g. `['Sam Brown','Ada Chen','Ravi Patel','Mia Torres','Leo Kim','Nora Singh','Omar Diaz','Priya Rao','Tom Lee','Eve Walsh']`; assign by `pool[idx % pool.length]`, leaving ~every 7th issue unassigned.
  - Statuses cycle `['To Do'/'new','In Progress'/'indeterminate','Done'/'done']`; priorities cycle `['High','Medium','Low']`; story points cycle `[1,2,3,5,8]`; dates staggered across Jun–Sep 2026 by a running counter; sprint `Sprint {1..6}`.
  - For EACH project: build 2–3 **epics**; under each epic 3–4 **stories** (`parent` = epic, parentKind Epic); under each story 2–3 **tasks** (`parent` = story); under ~half the tasks 1–2 **subtasks** (`parent` = task); plus a couple **bugs** per project parented to a story. Use per-project key prefixes (`CHK-1`, `CHK-2`, …) with a single incrementing counter per project. Total should land ~100–140.
  - **Links:** within each project make a `Blocks` chain across a few tasks (outwardIssue), and a `Relates` between two stories. Add at least one **cross-project** `Relates` and one cross-project `Blocks` (e.g. a SRCH task relates to a CHK story). Every referenced key MUST exist.
  - Each issue is raw-API shaped: `{ key, fields: { summary, issuetype:{name,subtask}, status:{name,statusCategory:{key}}, priority:{name}, assignee?:{displayName}, project:{key,name}, customfield_10016?, customfield_10015?, customfield_10020?:[{name}], parent?, issuelinks?:[] , description } }`. Descriptions can be a short ADF doc or plain string.
  - Export `largeIssues: any[]` (the generated array) and `largeCaps`.
  - Keep it deterministic and typed loosely (`any[]`).

- [ ] **Step 4: Register dataset in `src/App.tsx`** — extend the `Dataset` union with `'large'`, add a `providerFor('large')` branch `new MockProvider(largeIssues, largeCaps)`, and add `<option value="large">Large demo (3 projects)</option>` to the dataset `<select>` (in the Sidebar, where the dataset picker now lives). Default the app to `'large'` so the user immediately sees the big project.

- [ ] **Step 5: Run → PASS** — `npx vitest run src/fixtures/large.test.ts`; `npm test`; `npm run build`.

- [ ] **Step 6: Commit**
```bash
git add src/fixtures/large.ts src/fixtures/large.test.ts src/App.tsx
git commit -m "feat: large multi-project demo dataset (generator) + dataset option"
```

---

# PHASE 3 — Shared visibility predicate, relationships helper, reducer

### Task 4: isNodeVisible + relationships helpers (pure)

**Files:** Create `src/graph/visible.ts`, `src/graph/relationships.ts`; Test `src/graph/visible.test.ts`, `src/graph/relationships.test.ts`

NOTE: `visible.ts` imports `GraphState` (a type) from the reducer — type-only import. The reducer fields used (`hiddenProjects`, `hiddenAssignees`) are added in Task 5; to avoid a chicken/egg, define `isNodeVisible` against a STRUCTURAL type it declares itself (only the sets it needs), so it doesn't depend on Task 5 ordering:

- [ ] **Step 1: visible.ts test** — `src/graph/visible.test.ts`
```ts
import { isNodeVisible } from './visible';
function node(over: any = {}): any { return { key: 'K', type: { kind: 'task' }, status: { category: 'todo' }, project: { key: 'CHK', name: 'C' }, assignee: { displayName: 'Sam' }, ...over }; }
const base = { hiddenTypes: new Set(), hiddenStatuses: new Set(), hiddenProjects: new Set(), hiddenAssignees: new Set() };

test('visible by default', () => { expect(isNodeVisible(node(), base as any)).toBe(true); });
test('hidden by type/status/project/assignee', () => {
  expect(isNodeVisible(node(), { ...base, hiddenTypes: new Set(['task']) } as any)).toBe(false);
  expect(isNodeVisible(node(), { ...base, hiddenStatuses: new Set(['todo']) } as any)).toBe(false);
  expect(isNodeVisible(node(), { ...base, hiddenProjects: new Set(['CHK']) } as any)).toBe(false);
  expect(isNodeVisible(node(), { ...base, hiddenAssignees: new Set(['Sam']) } as any)).toBe(false);
});
test('unassigned matches the __unassigned__ key', () => {
  expect(isNodeVisible(node({ assignee: undefined }), { ...base, hiddenAssignees: new Set(['__unassigned__']) } as any)).toBe(false);
});
```

- [ ] **Step 2: Run → FAIL**, then implement `src/graph/visible.ts`:
```ts
import type { GraphNode, IssueKind, StatusCategory } from '../core/model';

export interface VisibilityFilters {
  hiddenTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  hiddenProjects: Set<string>;
  hiddenAssignees: Set<string>;
}

export function isNodeVisible(node: GraphNode, f: VisibilityFilters): boolean {
  if (f.hiddenTypes.has(node.type.kind)) return false;
  if (f.hiddenStatuses.has(node.status.category)) return false;
  if (f.hiddenProjects.has(node.project.key)) return false;
  const a = node.assignee?.displayName ?? '__unassigned__';
  if (f.hiddenAssignees.has(a)) return false;
  return true;
}
```
`GraphState` will structurally satisfy `VisibilityFilters` (it has all four sets after Task 5), so callers pass `state` directly.

- [ ] **Step 3: relationships.ts test** — `src/graph/relationships.test.ts`
```ts
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
```

- [ ] **Step 4: Run → FAIL**, then implement `src/graph/relationships.ts`:
```ts
import type { Graph } from '../core/model';

export interface RelRow { kind: 'hierarchy' | 'link'; relation: string; label: string; otherKey: string; outward: boolean }

export function ticketRelationships(graph: Graph, key: string): RelRow[] {
  const rows: RelRow[] = [];
  for (const e of graph.edges) {
    if (e.source === key) rows.push({ kind: e.kind, relation: e.relation, label: e.label, otherKey: e.target, outward: true });
    else if (e.target === key) rows.push({ kind: e.kind, relation: e.relation, label: e.label, otherKey: e.source, outward: false });
  }
  return rows;
}
```

- [ ] **Step 5: Run → PASS** both; commit:
```bash
git add src/graph/visible.ts src/graph/visible.test.ts src/graph/relationships.ts src/graph/relationships.test.ts
git commit -m "feat: shared isNodeVisible predicate + ticketRelationships helper"
```

### Task 5: Reducer — filters, nodePopup, GroupDepth 4

**Files:** Modify `src/state/graphReducer.ts`, `src/state/graphReducer.viewmodes.test.ts`; Test `src/state/graphReducer.filters.test.ts`

- [ ] **Step 1: Failing test** — `src/state/graphReducer.filters.test.ts`
```ts
import { initialState, reducer } from './graphReducer';

test('default groupDepth is 4 (full nesting), filters empty', () => {
  expect(initialState.groupDepth).toBe(4);
  expect(initialState.hiddenProjects.size).toBe(0);
  expect(initialState.hiddenAssignees.size).toBe(0);
  expect(initialState.nodePopup).toBeNull();
});
test('toggleProject / toggleAssignee', () => {
  const a = reducer(initialState, { type: 'toggleProject', key: 'CHK' });
  expect(a.hiddenProjects.has('CHK')).toBe(true);
  expect(reducer(a, { type: 'toggleProject', key: 'CHK' }).hiddenProjects.has('CHK')).toBe(false);
  const b = reducer(initialState, { type: 'toggleAssignee', name: 'Sam' });
  expect(b.hiddenAssignees.has('Sam')).toBe(true);
});
test('openNode sets popup; closeNode + setFocus clear it', () => {
  const o = reducer(initialState, { type: 'openNode', key: 'CHK-1', x: 10, y: 20 });
  expect(o.nodePopup).toEqual({ key: 'CHK-1', x: 10, y: 20 });
  expect(reducer(o, { type: 'closeNode' }).nodePopup).toBeNull();
  expect(reducer(o, { type: 'setFocus', key: 'CHK-1' }).nodePopup).toBeNull();
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Implement** — in `graphReducer.ts`:
  - Change `export type GroupDepth = 1 | 2 | 3;` → `1 | 2 | 3 | 4;`.
  - Add to `GraphState`: `hiddenProjects: Set<string>; hiddenAssignees: Set<string>; nodePopup: { key: string; x: number; y: number } | null;`.
  - In `initialState`: change `groupDepth: 2` → `groupDepth: 4`; add `hiddenProjects: new Set(), hiddenAssignees: new Set(), nodePopup: null,`.
  - Add to `Action`: `| { type: 'toggleProject'; key: string } | { type: 'toggleAssignee'; name: string } | { type: 'openNode'; key: string; x: number; y: number } | { type: 'closeNode' }`.
  - Add cases: `toggleProject` → `{ ...state, hiddenProjects: toggle(state.hiddenProjects, action.key) }`; `toggleAssignee` → `{ ...state, hiddenAssignees: toggle(state.hiddenAssignees, action.name) }`; `openNode` → `{ ...state, nodePopup: { key: action.key, x: action.x, y: action.y }, selectedKey: action.key }`; `closeNode` → `{ ...state, nodePopup: null }`.
  - In existing `setFocus` case add `nodePopup: null`; in `setMode` 'map' optionally keep. In `selectEdge` add `nodePopup: null`.

- [ ] **Step 4: Update `graphReducer.viewmodes.test.ts`** — the assertion `expect(initialState.groupDepth).toBe(2)` must change to `toBe(4)`.

- [ ] **Step 5: Run → PASS** — `npx vitest run src/state/`; `npx tsc --noEmit`.

- [ ] **Step 6: Commit**
```bash
git add src/state/graphReducer.ts src/state/graphReducer.filters.test.ts src/state/graphReducer.viewmodes.test.ts
git commit -m "feat: project/assignee filters, node popup state, full-depth grouping default"
```

---

# PHASE 4 — Wire shared visibility into all views

### Task 6: Use isNodeVisible everywhere (replace inline filters)

**Files:** Modify `src/graph/flow-elements.ts`, `src/graph/grouped-elements.ts`, `src/components/TreeView.tsx`, `src/components/TimelineView.tsx`

UI/integration — verified by build + the existing tests (which check filtering) + browser QA.

- [ ] **Step 1:** In `flow-elements.ts` and `grouped-elements.ts`, replace the inline `state.hiddenTypes.has(...) || state.hiddenStatuses.has(...)` checks with `!isNodeVisible(node, state)` (import `isNodeVisible` from `../graph/visible`). The edge-visibility logic (relation filter + both endpoints visible) is unchanged — but "endpoint visible" must now also honor project/assignee; since it's computed from the same node-visible set, this falls out automatically if you build the visible-node set via `isNodeVisible`.
- [ ] **Step 2:** In `TreeView.tsx` and `TimelineView.tsx`, replace their inline `hiddenTypes/hiddenStatuses` row/bar checks with `isNodeVisible(node, state)`.
- [ ] **Step 3:** The existing `flow-elements`/`grouped-elements` tests pass `state` (initialState now has the new sets), so they keep working. Run `npm test` — all green. `npm run build` clean.
- [ ] **Step 4: Commit**
```bash
git add src/graph/flow-elements.ts src/graph/grouped-elements.ts src/components/TreeView.tsx src/components/TimelineView.tsx
git commit -m "refactor: all views filter via shared isNodeVisible (adds project/assignee)"
```

---

# PHASE 5 — Node popup overview, focus nav, focal highlight, no handles, epic badge

### Task 7: NodePopup + remove handles + epic badge + focal highlight + click→openNode + BackButton

**Files:** Create `src/components/NodePopup.tsx`, `src/components/node-popup.css`, `src/components/BackButton.tsx`; Modify `src/components/TicketNode.tsx`/`.css`, `src/components/ContainerNode.tsx`, `src/components/GraphCanvas.tsx`, `src/components/GroupedCanvas.tsx`, `src/components/TreeView.tsx`, `src/components/TimelineView.tsx`, `src/App.tsx`; remove `DetailPanel` from `App.tsx`.

UI task — build with care (tokens; dark+light). Verified by build + browser QA.

- [ ] **Step 1: NodePopup** `src/components/NodePopup.tsx`:
```tsx
import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { ticketRelationships } from '../graph/relationships';
import { relationStyle } from '../graph/relation-colors';
import './node-popup.css';

export function NodePopup({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const sel = state.nodePopup;
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'closeNode' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, dispatch]);
  if (!sel) return null;
  const node = graph.nodes.find((n) => n.key === sel.key);
  if (!node) return null;
  const rels = ticketRelationships(graph, node.key);
  return (
    <>
      <div className="np-scrim" onClick={() => dispatch({ type: 'closeNode' })} />
      <div className="np-pop" style={{ left: sel.x, top: sel.y }} role="dialog">
        <div className="np-head">
          <span className="np-k" style={{ color: `var(--kind-${node.type.kind})` }}>{node.key}</span>
          <span className="np-type">{node.type.name}{node.priority ? ` · ${node.priority}` : ''}</span>
          <button className="np-x" onClick={() => dispatch({ type: 'closeNode' })}>×</button>
        </div>
        <h3 className="np-title">{node.summary}</h3>
        <div className="np-meta">
          <span className="np-pill" style={{ color: `var(--status-${node.status.category})` }}>{node.status.name}</span>
          {node.epicKey && node.type.kind !== 'epic' && <span className="np-epic" title={node.epicSummary}>▣ {node.epicKey}</span>}
          {node.storyPoints != null && <span className="np-pts">{node.storyPoints} pts</span>}
          {node.assignee && <span className="np-av" title={node.assignee.displayName}>{node.assignee.initials}</span>}
        </div>
        {node.description && <p className="np-desc">{node.description}</p>}
        <div className="np-rels">
          <span className="np-label">Relationships ({rels.length})</span>
          <ul>
            {rels.map((r, i) => {
              const c = relationStyle(r.kind === 'hierarchy' ? 'hierarchy' : r.relation).colorVar;
              const arrow = r.kind === 'hierarchy' ? '▸' : r.outward ? '→' : '←';
              const verb = r.outward ? r.label : `${r.label} (in)`;
              return (
                <li key={i}>
                  <button onClick={() => dispatch({ type: 'openNode', key: r.otherKey, x: sel.x, y: sel.y })}>
                    <span className="np-swatch" style={{ background: c }} /> {verb} {arrow} <b>{r.otherKey}</b>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="np-actions">
          <button className="np-focus" onClick={() => dispatch({ type: 'setFocus', key: node.key })}>Focus this ticket</button>
          <a className="np-open" href={node.url} target="_blank" rel="noreferrer">Open in Jira ↗</a>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: `src/components/node-popup.css`** (tokens, glassy, `position: fixed`):
```css
.np-scrim { position: fixed; inset: 0; z-index: 9; }
.np-pop { position: fixed; z-index: 10; width: 300px; max-height: 70vh; overflow: auto; transform: translate(-50%, 12px);
  background: var(--panel); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  backdrop-filter: blur(10px); padding: 14px; color: var(--ink); font-family: var(--font-sans); animation: np-in 140ms ease both; }
@keyframes np-in { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 12px); } }
.np-head { display: flex; align-items: center; gap: 8px; }
.np-k { font: 700 12px var(--font-mono); }
.np-type { font-size: 10px; color: var(--ink-muted); }
.np-x { margin-left: auto; border: none; background: none; color: var(--ink-muted); font-size: 16px; cursor: pointer; }
.np-title { margin: 8px 0 8px; font-size: 15px; }
.np-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.np-pill { font-size: 10px; font-weight: 700; }
.np-epic { font-size: 10px; font-weight: 700; color: var(--kind-epic); background: color-mix(in srgb, var(--kind-epic) 16%, transparent); padding: 2px 7px; border-radius: 6px; }
.np-pts { font-size: 10px; font-weight: 700; color: var(--ink-muted); background: color-mix(in srgb, var(--ink-muted) 14%, transparent); padding: 2px 7px; border-radius: 6px; }
.np-av { margin-left: auto; width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.np-desc { font-size: 12px; color: var(--ink-muted); line-height: 1.45; margin: 10px 0; max-height: 120px; overflow: auto; white-space: pre-wrap; }
.np-rels { margin-top: 6px; }
.np-label { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: var(--ink-muted); }
.np-rels ul { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 2px; }
.np-rels button { width: 100%; text-align: left; background: none; border: none; color: var(--ink); font-size: 12px; padding: 4px 6px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 7px; }
.np-rels button:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.np-swatch { width: 10px; height: 4px; border-radius: 2px; flex-shrink: 0; }
.np-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.np-focus { flex: 1; font-size: 12px; padding: 7px; border-radius: 8px; background: var(--accent); color: var(--accent-ink); border: none; cursor: pointer; font-weight: 600; }
.np-open { font-size: 11px; color: var(--accent); }
```

- [ ] **Step 3: BackButton** `src/components/BackButton.tsx`:
```tsx
import type { Dispatch } from 'react';
import type { Action, GraphState } from '../state/graphReducer';

export function BackButton({ state, dispatch }: { state: GraphState; dispatch: Dispatch<Action> }) {
  if (state.mode !== 'focus') return null;
  return (
    <button className="back-btn" onClick={() => dispatch({ type: 'setMode', mode: 'map' })}>
      ← Back to all{state.focusKey ? ` · ${state.focusKey}` : ''}
    </button>
  );
}
```
Add to `App.css`:
```css
.back-btn { position: absolute; top: 14px; left: 14px; z-index: 6; background: var(--panel); border: 1px solid var(--border-strong); color: var(--ink); border-radius: 9px; padding: 7px 12px; font-size: 12px; font-weight: 600; cursor: pointer; backdrop-filter: blur(8px); box-shadow: var(--shadow); }
.back-btn:hover { border-color: var(--accent); }
```

- [ ] **Step 4: TicketNode — epic badge, focal ring, invisible handles.** In `TicketNode.tsx`: add to the full card (and a compact equivalent) an epic badge when `data.node.epicKey && kind !== 'epic'`:
```tsx
{node.epicKey && node.type.kind !== 'epic' && (
  <span className="ticket-epic" title={node.epicSummary}>▣ {node.epicKey}</span>
)}
```
Add focal ring: include `data.focal` (set by mappers when `node.key === focusKey`) → add class `focal`. Keep `<Handle>` but pass `isConnectable={false}` to each. In `TicketNode.css` add:
```css
.ticket-epic { font: 700 9px var(--font-mono); color: var(--kind-epic); background: color-mix(in srgb, var(--kind-epic) 16%, transparent); padding: 1px 6px; border-radius: 5px; }
.ticket.focal { box-shadow: 0 0 0 3px var(--accent), var(--shadow); }
/* hide connection handles — visualization only */
.react-flow__handle { opacity: 0 !important; pointer-events: none !important; width: 1px; height: 1px; min-width: 0; min-height: 0; border: none; }
```
(Place the `.react-flow__handle` rule somewhere global like `App.css` so it applies to ContainerNode too.) Mappers (`flow-elements.ts`/`grouped-elements.ts`) set `data.focal = state.focusKey === node.key` and `compact` already exists.

- [ ] **Step 5: ContainerNode** — pass `isConnectable={false}` to its Handles; optionally `focal` ring if its key === focusKey.

- [ ] **Step 6: Canvases — disable connection + node click → openNode.** In `GraphCanvas.tsx` and `GroupedCanvas.tsx`: add `nodesConnectable={false}` to `<ReactFlow>`. Change the node click handler to open the popup with coords: `onNodeClick={(e, n) => n.type !== 'container' && onNodeOpen?.(n.id, e.clientX, e.clientY)}` (grouped: only ticket nodes, not containers). Add an `onNodeOpen?: (id: string, x: number, y: number) => void` prop (replacing/augmenting the old `onSelect`). Keep container collapse working in grouped.

- [ ] **Step 7: Tree + Timeline click → openNode.** In `TreeView.tsx` the row `onClick` → `onNodeOpen?.(row.key, e.clientX, e.clientY)`; in `TimelineView.tsx` the bar `onClick` → `onNodeOpen?.(b.key, e.clientX, e.clientY)`. Add the `onNodeOpen` prop to both. Mark the focal row/bar (`state.focusKey`) with a highlight class.

- [ ] **Step 8: App wiring.** In `App.tsx`: remove `DetailPanel` import + render. Pass `onNodeOpen={(id, x, y) => dispatch({ type: 'openNode', key: id, x, y })}` to all four views. Render `<NodePopup graph={view} state={state} dispatch={dispatch} />` and `<BackButton state={state} dispatch={dispatch} />` inside `.app-main`.

- [ ] **Step 9: Verify** — `npm test` (all pass), `npm run build` clean.

- [ ] **Step 10: Commit**
```bash
git add -A
git commit -m "feat: ticket overview popup, focus nav + back button, epic badges, focal highlight, no connection handles"
```

---

# PHASE 6 — Sidebar: projects, assignees, ticket typeahead, depth labels

### Task 8: Sidebar filter sections + TicketTypeahead

**Files:** Create `src/components/TicketTypeahead.tsx`; Modify `src/components/Sidebar.tsx`, `src/components/sidebar.css`

- [ ] **Step 1: TicketTypeahead** `src/components/TicketTypeahead.tsx` — focuses a ticket by key/summary over the FULL graph:
```tsx
import { useState } from 'react';
import type { Dispatch } from 'react';
import type { Graph } from '../core/model';
import type { Action } from '../state/graphReducer';

export function TicketTypeahead({ graph, dispatch }: { graph: Graph; dispatch: Dispatch<Action> }) {
  const [q, setQ] = useState('');
  const matches = q.trim()
    ? graph.nodes.filter((n) => n.key.toLowerCase().includes(q.toLowerCase()) || n.summary.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : [];
  const focus = (key: string) => { dispatch({ type: 'setFocus', key }); setQ(''); };
  return (
    <div className="tt">
      <input className="sb-search" placeholder="Focus a ticket…" value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) focus(matches[0].key); }} />
      {matches.length > 0 && (
        <ul className="tt-list">
          {matches.map((n) => (
            <li key={n.key}><button onClick={() => focus(n.key)}><b>{n.key}</b> {n.summary}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Sidebar** — add, near the top (after mode nav), `<TicketTypeahead graph={graph} dispatch={dispatch} />`. Add a **Projects** section and an **Assignees** section, listing entries present in the FULL graph (pass the full graph to the Sidebar — App should pass `full` not `view` for these lists; the Sidebar already receives a `graph` prop — pass the unfiltered `full` graph):
```tsx
const projects = Array.from(new Map(graph.nodes.map((n) => [n.project.key, n.project])).values());
const assignees = Array.from(new Set(graph.nodes.map((n) => n.assignee?.displayName ?? '__unassigned__')));
```
Render Project chips (toggle `hiddenProjects` via `toggleProject`) and Assignee chips (toggle `hiddenAssignees` via `toggleAssignee`; show `Unassigned` label for `__unassigned__`). Reuse `.sb-chip`/`.sb-section`/`.sb-label` styles. Change the depth labels to `{ 1: 'Epic', 2: 'Story', 3: 'Task', 4: 'Subtask' }` and `DEPTHS = [1,2,3,4]`.

- [ ] **Step 3: App** — pass the FULL graph to the Sidebar (so filter lists/typeahead see everything), while the canvas still gets `view`. e.g. `<Sidebar graph={full} ... />`.

- [ ] **Step 4: sidebar.css** — add:
```css
.tt { position: relative; }
.tt-list { list-style: none; margin: 4px 0 0; padding: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; box-shadow: var(--shadow); }
.tt-list button { width: 100%; text-align: left; background: none; border: none; color: var(--ink); font-size: 12px; padding: 5px 7px; border-radius: 6px; cursor: pointer; }
.tt-list button:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.tt-list b { font-family: var(--font-mono); font-size: 11px; }
```

- [ ] **Step 5: Verify** — `npm test`, `npm run build` clean.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "feat: sidebar project + assignee filters, ticket typeahead, depth-4 labels"
```

---

# PHASE 7 — Docs

### Task 9: README update + large-data screenshots

**Files:** Modify `README.md`; add `docs/screenshot-large.png`, `docs/screenshot-popup.png`

- [ ] **Step 1:** Add to README: project/assignee/ticket filtering, click→overview popup, focus + back navigation, deep grouping (epic▸story▸task▸subtask), epic badges, the "Large demo" dataset, and that connection handles are removed (viz-only). Update the test count to the new total.
- [ ] **Step 2:** Capture a large-dataset screenshot and a node-popup screenshot (run the app), embed them.
- [ ] **Step 3:** `npm run build` clean.
- [ ] **Step 4: Commit**
```bash
git add README.md docs/screenshot-large.png docs/screenshot-popup.png
git commit -m "docs: filtering, focus nav, deep grouping, epic badges, large dataset"
```

---

## Self-Review notes (reconciled)

- **Spec coverage:** project field + filter (T1, T5, T6, T8); assignee filter (T5, T6, T8); ticket focus via typeahead + click→popup→Focus (T7, T8); click→overview popup with title/description/relationships (T1 description, T4 relationships, T7 NodePopup); back button (T7); remove handles (T7); deep grouping epic▸story▸task▸subtask (T5 GroupDepth 4 default, grouping already recurses); epic badge (T1/T2 epicKey, T7 badge); large multi-project data (T3); description field (T1). DetailPanel removed (T7).
- **No placeholders.** Every code step has real code; the large generator (T3) is described structurally with exact shape + invariants enforced by its test.
- **Type consistency:** `project`/`description`/`epicKey`/`epicSummary` on GraphNode; `isNodeVisible(node, VisibilityFilters)` (GraphState structurally satisfies it); `ticketRelationships`→`RelRow`; reducer `hiddenProjects`/`hiddenAssignees`/`nodePopup` + `toggleProject`/`toggleAssignee`/`openNode`/`closeNode`; `GroupDepth = 1|2|3|4` default 4 (viewmodes test updated); `onNodeOpen(id,x,y)` used across canvases/tree/timeline; `largeIssues`/`largeCaps` + dataset `'large'`.
- **Test fallout:** changing `groupDepth` default 2→4 breaks the existing viewmodes assertion — explicitly updated in T5. Adding required `project` may break GraphNode literals in existing tests — fixed minimally in T1.
