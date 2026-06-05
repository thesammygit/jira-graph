# Jira Graph — Redesign, Theming & Edge Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the app (Dark Studio look + light/dark toggle), move all controls into a left sidebar, route edges orthogonally around tickets, color edges by relationship with a legend, and add a click-a-line popup.

**Architecture:** A CSS-variable theme layer drives every component; a left `Sidebar` replaces the top toolbar; a pure `routeOrthogonal` A* module + a custom `RoutedEdge` draw right-angle paths around node obstacles; a single `relation-colors` palette feeds edges + legend; an `EdgePopup` shows on edge click.

**Tech Stack:** Existing — React 19 + TS + Vite + `@xyflow/react`, Vitest. No new runtime deps (A* + theming hand-rolled).

**Spec:** `docs/superpowers/specs/2026-06-05-jira-graph-redesign-routing-design.md`

**Existing code (do not break; current tests = 70 passing):** `src/core/*`, `src/graph/{grouping,layouts,grouped-elements,tree,timeline,depth,flow-elements}.ts`, `src/state/graphReducer.ts`, `src/components/{GraphCanvas,GroupedCanvas,ContainerNode,TreeView,TimelineView,TicketNode,Toolbar,ViewModeSwitch,DetailPanel}.tsx`, `src/App.tsx`, fixtures, providers. Node-env tests require `@xyflow/react` imports in pure modules to stay **type-only**.

---

## File Structure (new / changed)

```
src/theme/tokens.css            NEW — CSS variables for light + dark
src/theme/useTheme.ts           NEW — theme state + localStorage + <html data-theme>
src/graph/relation-colors.ts    NEW — relation → {label, colorVar}; legendEntries()
src/graph/routing.ts            NEW — pure orthogonal A* router
src/components/Sidebar.tsx      NEW — primary control surface (replaces Toolbar)
src/components/Legend.tsx       NEW — relationship legend (in sidebar)
src/components/RoutedEdge.tsx   NEW — custom orthogonal edge
src/components/EdgePopup.tsx    NEW — click-a-line popover
src/components/routing-context.ts NEW — provides obstacle rects to edges
src/state/graphReducer.ts       MOD — + selectedEdge + selectEdge/clearEdge
src/graph/flow-elements.ts      MOD — RoutedEdge type + relation-colors + obstacle ids
src/graph/grouped-elements.ts   MOD — RoutedEdge type + relation-colors
src/components/GraphCanvas.tsx  MOD — register RoutedEdge, provide obstacles, onEdgeClick
src/components/GroupedCanvas.tsx MOD — same (+ container obstacles)
src/components/TimelineView.tsx MOD — route deps around bars; tokens
src/components/TreeView.tsx     MOD — tokens
src/components/TicketNode.tsx   MOD — tokens (full + compact)
src/components/ContainerNode.tsx MOD — tokens
src/App.tsx                     MOD — sidebar+canvas layout, theme wiring, EdgePopup
*.css (App, panels, tree, timeline, grouped, TicketNode) MOD — hard-coded colors → tokens
```
`Toolbar.tsx` and `ViewModeSwitch.tsx` are removed once `Sidebar` supersedes them.

---

# PHASE 1 — Theme system + sidebar shell

### Task 1: Theme tokens + useTheme hook

**Files:** Create `src/theme/tokens.css`, `src/theme/useTheme.ts`; Test `src/theme/useTheme.test.ts`; Modify `src/main.tsx` (import tokens.css)

- [ ] **Step 1: Create `src/theme/tokens.css`** (concrete values — this IS the design system)
```css
:root {
  --kind-epic: #7b61ff; --kind-story: #3ebd93; --kind-task: #2186eb; --kind-subtask: #9aa5b1; --kind-bug: #e12d39; --kind-other: #7b8794;
  --radius: 12px; --radius-lg: 14px;
  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
}
:root[data-theme="dark"] {
  --bg: #0d1117; --bg-grid: #1c2430; --surface: #161c25; --surface-2: #11161d;
  --panel: rgba(17,22,29,.85); --border: #283142; --border-strong: #2b3648;
  --ink: #e6edf3; --ink-muted: #9aa7b8; --accent: #5b9dff; --accent-ink: #fff;
  --shadow: 0 4px 16px rgba(0,0,0,.45); --shadow-lg: 0 16px 50px rgba(0,0,0,.55);
  --status-todo: #9aa7b8; --status-inprogress: #f0b429; --status-done: #3ddc97;
  --rel-hierarchy: #7d8aa0; --rel-blocks: #ff5d6c; --rel-relates: #5b9dff; --rel-duplicates: #b07cff; --rel-clones: #36c5c0; --rel-default: #8b97a8;
  --edge-glow: drop-shadow(0 0 3px currentColor);
}
:root[data-theme="light"] {
  --bg: #f7f9fc; --bg-grid: #e4e9f0; --surface: #ffffff; --surface-2: #ffffff;
  --panel: rgba(255,255,255,.92); --border: #e1e7ef; --border-strong: #cbd2d9;
  --ink: #1f2933; --ink-muted: #52606d; --accent: #2563eb; --accent-ink: #fff;
  --shadow: 0 4px 14px rgba(16,42,67,.10); --shadow-lg: 0 16px 44px rgba(16,42,67,.18);
  --status-todo: #9aa5b1; --status-inprogress: #b7791f; --status-done: #3ebd93;
  --rel-hierarchy: #9aa5b1; --rel-blocks: #e12d39; --rel-relates: #2186eb; --rel-duplicates: #8b5cf6; --rel-clones: #0d9488; --rel-default: #7b8794;
  --edge-glow: none;
}
```

- [ ] **Step 2: Failing test** — `src/theme/useTheme.test.ts`
```ts
import { nextTheme, initialTheme } from './useTheme';

test('nextTheme toggles', () => {
  expect(nextTheme('dark')).toBe('light');
  expect(nextTheme('light')).toBe('dark');
});

test('initialTheme prefers a stored value, else falls back to dark', () => {
  expect(initialTheme('light')).toBe('light');
  expect(initialTheme('dark')).toBe('dark');
  expect(initialTheme(null)).toBe('dark');
  expect(initialTheme('garbage')).toBe('dark');
});
```

- [ ] **Step 3: Run → FAIL** — `npx vitest run src/theme/useTheme.test.ts`

- [ ] **Step 4: Implement** — `src/theme/useTheme.ts`
```ts
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'jira-graph-theme';

export function nextTheme(t: Theme): Theme { return t === 'dark' ? 'light' : 'dark'; }

export function initialTheme(stored: string | null): Theme {
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() =>
    initialTheme(typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null));
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  return { theme, toggle: () => setTheme(nextTheme) };
}
```

- [ ] **Step 5: Import tokens in `src/main.tsx`** — add `import './theme/tokens.css';` at the top (before App import).

- [ ] **Step 6: Run → PASS + build** — `npx vitest run src/theme/useTheme.test.ts`; `npm run build` clean.

- [ ] **Step 7: Commit**
```bash
git add src/theme/ src/main.tsx
git commit -m "feat: theme tokens + useTheme hook (light/dark, persisted)"
```

---

### Task 2: Sidebar shell + App layout + remove top toolbar

**Files:** Create `src/components/Sidebar.tsx`, `src/components/sidebar.css`; Modify `src/App.tsx`, `src/App.css`; later-deleted: `Toolbar.tsx`, `ViewModeSwitch.tsx` (delete in this task)

UI task — build with care for the Dark Studio aesthetic (use tokens only). Verified by build + visual QA.

- [ ] **Step 1: Create `src/components/Sidebar.tsx`** — folds in everything the old Toolbar + ViewModeSwitch did, plus theme toggle + dataset. Baseline:
```tsx
import type { Dispatch } from 'react';
import type { Action, GraphState, ViewMode, GroupDepth } from '../state/graphReducer';
import type { LayoutKind } from '../graph/layouts';
import type { IssueKind, Graph } from '../core/model';
import type { Theme } from '../theme/useTheme';
import { Legend } from './Legend';
import './sidebar.css';

const MODES: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'graph', label: 'Graph', icon: '◫' }, { id: 'grouped', label: 'Grouped', icon: '▦' },
  { id: 'tree', label: 'Tree', icon: '☰' }, { id: 'timeline', label: 'Timeline', icon: '▭' },
];
const LAYOUTS: LayoutKind[] = ['hybrid', 'hierarchical', 'force'];
const DEPTHS: GroupDepth[] = [1, 2, 3];
const DEPTH_LABEL: Record<GroupDepth, string> = { 1: 'Epic', 2: 'Story', 3: 'Task' };
const TYPES: IssueKind[] = ['epic', 'story', 'task', 'subtask', 'bug'];

type Dataset = 'v3' | 'v2' | 'v2-no-epic';

export function Sidebar(props: {
  graph: Graph; state: GraphState; dispatch: Dispatch<Action>;
  theme: Theme; onToggleTheme: () => void; dataset: Dataset; onDataset: (d: Dataset) => void;
}) {
  const { graph, state, dispatch, theme, onToggleTheme, dataset, onDataset } = props;
  return (
    <aside className="sidebar">
      <div className="sb-brand"><span className="sb-logo">◳</span> Jira Graph</div>

      <nav className="sb-modes">
        {MODES.map((m) => (
          <button key={m.id} className={`sb-mode ${state.viewMode === m.id ? 'on' : ''}`}
            onClick={() => dispatch({ type: 'setViewMode', viewMode: m.id })}>
            <span className="sb-ico">{m.icon}</span>{m.label}
          </button>
        ))}
      </nav>

      <input className="sb-search" placeholder="Search…" value={state.search}
        onChange={(e) => dispatch({ type: 'setSearch', query: e.target.value })} />

      {state.viewMode === 'grouped' && (
        <div className="sb-section"><span className="sb-label">Depth</span>
          <div className="sb-seg">{DEPTHS.map((d) => (
            <button key={d} className={state.groupDepth === d ? 'on' : ''} onClick={() => dispatch({ type: 'setGroupDepth', depth: d })}>{DEPTH_LABEL[d]}</button>
          ))}</div>
        </div>
      )}
      {state.viewMode === 'graph' && (
        <div className="sb-section"><span className="sb-label">Layout</span>
          <div className="sb-seg">{LAYOUTS.map((l) => (
            <button key={l} className={state.layout === l ? 'on' : ''} onClick={() => dispatch({ type: 'setLayout', layout: l })}>{l}</button>
          ))}</div>
        </div>
      )}

      <div className="sb-section"><span className="sb-label">Types</span>
        <div className="sb-chips">{TYPES.map((t) => (
          <button key={t} className={`sb-chip ${state.hiddenTypes.has(t) ? '' : 'on'}`} onClick={() => dispatch({ type: 'toggleType', kind: t })}>{t}</button>
        ))}</div>
      </div>

      <div className="sb-section"><span className="sb-label">Relationships</span>
        <Legend graph={graph} state={state} dispatch={dispatch} />
      </div>

      <div className="sb-foot">
        <select className="sb-select" value={dataset} onChange={(e) => onDataset(e.target.value as Dataset)}>
          <option value="v3">Cloud v3</option><option value="v2">Server v2</option><option value="v2-no-epic">v2 · no Epic Link</option>
        </select>
        <button className="sb-theme" onClick={onToggleTheme} aria-label="Toggle theme">{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>
      </div>
    </aside>
  );
}
```
NOTE: `Legend` is created in Phase 2 (Task 6). For THIS task, create a tiny placeholder `src/components/Legend.tsx` exporting a component that renders the relation toggles by hand (so the sidebar compiles now); Task 6 replaces its body with the palette-driven legend. Placeholder:
```tsx
import type { Dispatch } from 'react';
import type { Action, GraphState } from '../state/graphReducer';
import type { Graph } from '../core/model';
const RELS = ['hierarchy', 'blocks', 'relates'];
export function Legend({ state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  return (<div className="sb-chips">{RELS.map((r) => (
    <button key={r} className={`sb-chip ${state.hiddenRelations.has(r) ? '' : 'on'}`} onClick={() => dispatch({ type: 'toggleRelation', relation: r })}>{r}</button>
  ))}</div>);
}
```

- [ ] **Step 2: `src/components/sidebar.css`** (tokens only)
```css
.sidebar { width: 224px; flex-shrink: 0; height: 100%; overflow-y: auto; background: var(--surface-2); border-right: 1px solid var(--border); padding: 16px 14px; display: flex; flex-direction: column; gap: 14px; font-family: var(--font-sans); color: var(--ink); }
.sb-brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
.sb-logo { color: var(--accent); }
.sb-modes { display: flex; flex-direction: column; gap: 2px; }
.sb-mode { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border: none; background: none; border-radius: 9px; color: var(--ink-muted); font-size: 13px; cursor: pointer; text-align: left; transition: background 120ms, color 120ms; }
.sb-mode:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.sb-mode.on { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--ink); font-weight: 600; }
.sb-ico { width: 16px; text-align: center; opacity: .8; }
.sb-search { background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 10px; color: var(--ink); font-size: 13px; }
.sb-search:focus { outline: 2px solid color-mix(in srgb, var(--accent) 50%, transparent); }
.sb-section { display: flex; flex-direction: column; gap: 6px; }
.sb-label { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: var(--ink-muted); }
.sb-seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; width: fit-content; }
.sb-seg button { background: none; border: none; border-right: 1px solid var(--border); color: var(--ink-muted); font-size: 11px; padding: 5px 10px; cursor: pointer; }
.sb-seg button:last-child { border-right: none; }
.sb-seg button.on { background: var(--accent); color: var(--accent-ink); }
.sb-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.sb-chip { font-size: 11px; padding: 3px 9px; border-radius: 20px; border: 1px solid var(--border); background: var(--surface); color: var(--ink-muted); cursor: pointer; }
.sb-chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.sb-foot { margin-top: auto; display: flex; flex-direction: column; gap: 8px; }
.sb-select, .sb-theme { background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 7px 10px; color: var(--ink); font-size: 12px; cursor: pointer; }
```

- [ ] **Step 3: Rewrite `src/App.tsx` layout** — replace the `<header>` + `<Toolbar>` with `<Sidebar>` beside the canvas. Keep the existing provider/state/view-switch logic. The return becomes:
```tsx
  return (
    <div className="app">
      <Sidebar graph={view} state={state} dispatch={dispatch}
        theme={theme} onToggleTheme={toggle} dataset={dataset} onDataset={setDataset} />
      <main className="app-main">
        {state.viewMode === 'grouped' ? <GroupedCanvas graph={view} state={state} dispatch={dispatch} onSelect={(key) => dispatch({ type: 'select', key })} />
         : state.viewMode === 'tree' ? <TreeView graph={view} state={state} dispatch={dispatch} onSelect={(key) => dispatch({ type: 'select', key })} />
         : state.viewMode === 'timeline' ? <TimelineView graph={view} state={state} onSelect={(key) => dispatch({ type: 'select', key })} />
         : <GraphCanvas graph={view} state={state} onSelect={(key) => dispatch({ type: 'select', key })} />}
        <DetailPanel graph={view} selectedKey={state.selectedKey} dispatch={dispatch} />
      </main>
    </div>
  );
```
Add `import { Sidebar } from './components/Sidebar';` and `import { useTheme } from './theme/useTheme';`, and inside the component `const { theme, toggle } = useTheme();`. Remove the `Toolbar` import/usage and the old `<header className="app-bar">`.

- [ ] **Step 4: Update `src/App.css`** to a sidebar layout, tokens only:
```css
html, body, #root { height: 100%; margin: 0; }
body { background: var(--bg); }
.app { display: flex; height: 100vh; background: var(--bg); }
.app-main { position: relative; flex: 1; min-width: 0; }
.app-canvas, .app-main > * { animation: view-in 220ms ease both; }
@keyframes view-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
```

- [ ] **Step 5: Delete the superseded files** — `git rm src/components/Toolbar.tsx src/components/ViewModeSwitch.tsx`. Grep for any remaining imports of them and remove. (`panels.css` may still hold `.detail*` styles used by DetailPanel — keep those; only the `.toolbar*` rules become dead, leave or trim.)

- [ ] **Step 6: Verify** — `npm test` (70 pass), `npm run build` clean.

- [ ] **Step 7: Commit**
```bash
git add -A
git commit -m "feat: left sidebar shell replaces top toolbar; theme-wired app layout"
```

---

### Task 3: Migrate component styles to tokens (both themes)

**Files:** Modify `src/components/TicketNode.css`, `ContainerNode` styles in `grouped.css`, `tree.css`, `timeline.css`, `panels.css`, and React Flow theming in `GraphCanvas.tsx`/`GroupedCanvas.tsx`.

UI task — replace hard-coded hex with `var(--…)` tokens so both themes render correctly. Verified visually in both themes.

- [ ] **Step 1: Replace hard-coded colors with tokens** across the listed CSS files:
  - card/surface backgrounds → `var(--surface)`; borders → `var(--border)`; text → `var(--ink)` / `var(--ink-muted)`; shadows → `var(--shadow)`.
  - issue-kind accents (the top borders / keys) → `var(--kind-epic|story|task|subtask|bug)`.
  - status pill colors → `var(--status-todo|inprogress|done)`.
  - timeline epic labels, bar text, tree keys, badges → tokens.
  - The dot-grid backgrounds (`.timeline`, `.tree`, canvas) → `var(--bg)` + grid color `var(--bg-grid)`.
  Keep `TicketNode`'s kind→color mapping working by reading the CSS var: e.g. set `style={{ borderTopColor: 'var(--kind-' + node.type.kind + ')' }}` in `TicketNode.tsx`/`ContainerNode.tsx` (replace the JS hex maps with var names). Status dot/pill likewise via `var(--status-' + category + ')`.

- [ ] **Step 2: Theme React Flow chrome.** In `GraphCanvas.tsx` and `GroupedCanvas.tsx`, set the React Flow container/background to tokens: use `<Background color="var(--bg-grid)" />` (or `bgColor`), and add a small CSS block (e.g. in `grouped.css`/a shared `canvas.css`) overriding React Flow vars on `.react-flow`: `--xy-background-color: var(--bg); --xy-node-color-default: var(--ink); --xy-edge-stroke-default: var(--rel-hierarchy);` and style `.react-flow__controls`, `.react-flow__minimap` backgrounds to `var(--surface)`/`var(--border)` so the chrome matches dark.

- [ ] **Step 3: Verify both themes.** `npm test` (70 pass), `npm run build` clean. (Visual QA of both themes is done by the orchestrator after this task.)

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "feat: migrate all component styles to theme tokens (light/dark)"
```

---

# PHASE 2 — Orthogonal routing + relationship palette + legend

### Task 4: Relationship color palette (pure)

**Files:** Create `src/graph/relation-colors.ts`; Test `src/graph/relation-colors.test.ts`

- [ ] **Step 1: Failing test** — `src/graph/relation-colors.test.ts`
```ts
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
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/graph/relation-colors.test.ts`

- [ ] **Step 3: Implement** — `src/graph/relation-colors.ts`
```ts
import type { Graph } from '../core/model';

export interface RelationStyle { key: string; label: string; colorVar: string }

const KNOWN: Record<string, string> = {
  hierarchy: 'var(--rel-hierarchy)', blocks: 'var(--rel-blocks)', relates: 'var(--rel-relates)',
  duplicates: 'var(--rel-duplicates)', clones: 'var(--rel-clones)',
};

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function relationStyle(relation: string): RelationStyle {
  return { key: relation, label: cap(relation), colorVar: KNOWN[relation] ?? 'var(--rel-default)' };
}

/** All relation keys present in the graph (hierarchy edges collapse to 'hierarchy'), deduped. */
export function legendEntries(graph: Graph): RelationStyle[] {
  const keys = new Set<string>();
  for (const e of graph.edges) keys.add(e.kind === 'hierarchy' ? 'hierarchy' : e.relation);
  return [...keys].map(relationStyle);
}
```

- [ ] **Step 4: Run → PASS** — `npx vitest run src/graph/relation-colors.test.ts`

- [ ] **Step 5: Commit**
```bash
git add src/graph/relation-colors.ts src/graph/relation-colors.test.ts
git commit -m "feat: relationship color palette + legend entries"
```

---

### Task 5: Orthogonal A* router (pure) — the core feature

**Files:** Create `src/graph/routing.ts`; Test `src/graph/routing.test.ts`

- [ ] **Step 1: Failing test** — `src/graph/routing.test.ts`
```ts
import { routeOrthogonal, type Rect } from './routing';

function segmentsAxisAligned(path: { x: number; y: number }[]) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (a.x !== b.x && a.y !== b.y) return false;
  }
  return true;
}
// true if the axis-aligned segment a-b passes through rect r's interior
function segHitsRect(a: any, b: any, r: Rect) {
  const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x), y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
  return x1 < r.x + r.width && x2 > r.x && y1 < r.y + r.height && y2 > r.y;
}

test('clear path: returns an orthogonal route connecting the endpoints', () => {
  const path = routeOrthogonal({ x: 0, y: 0 }, { x: 200, y: 100 }, []);
  expect(path[0]).toEqual({ x: 0, y: 0 });
  expect(path[path.length - 1]).toEqual({ x: 200, y: 100 });
  expect(segmentsAxisAligned(path)).toBe(true);
});

test('obstacle between endpoints: no segment passes through the obstacle', () => {
  const obstacle: Rect = { x: 80, y: -40, width: 60, height: 120 }; // straddles the straight line
  const path = routeOrthogonal({ x: 0, y: 20 }, { x: 220, y: 20 }, [obstacle]);
  expect(segmentsAxisAligned(path)).toBe(true);
  expect(path.some(() => true)).toBe(true);
  for (let i = 1; i < path.length; i++) {
    expect(segHitsRect(path[i - 1], path[i], obstacle)).toBe(false);
  }
});

test('deterministic', () => {
  const o: Rect[] = [{ x: 80, y: -40, width: 60, height: 120 }];
  expect(routeOrthogonal({ x: 0, y: 20 }, { x: 220, y: 20 }, o)).toEqual(routeOrthogonal({ x: 0, y: 20 }, { x: 220, y: 20 }, o));
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/graph/routing.test.ts`

- [ ] **Step 3: Implement** — `src/graph/routing.ts`
```ts
export interface Rect { x: number; y: number; width: number; height: number }
export interface Pt { x: number; y: number }

const inflate = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, width: r.width + 2 * p, height: r.height + 2 * p });
const ptInRect = (p: Pt, r: Rect) => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

// Does axis-aligned segment a-b cross rect interior?
function segHits(a: Pt, b: Pt, r: Rect): boolean {
  const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x), y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
  return x1 < r.x + r.width && x2 > r.x && y1 < r.y + r.height && y2 > r.y;
}
const clear = (a: Pt, b: Pt, rects: Rect[]) => rects.every((r) => !segHits(a, b, r));

export function routeOrthogonal(from: Pt, to: Pt, obstacles: Rect[], opts: { padding?: number; grid?: number } = {}): Pt[] {
  const pad = opts.padding ?? 12;
  const grid = Math.max(4, opts.grid ?? 16);
  const rects = obstacles.map((r) => inflate(r, pad));

  // Fast path: two-bend L routes (HV and VH). Use whichever is clear.
  for (const mid of [{ x: to.x, y: from.y }, { x: from.x, y: to.y }]) {
    if (!ptInRect(mid, { x: 0, y: 0, width: 0, height: 0 }) && clear(from, mid, rects) && clear(mid, to, rects)) {
      return simplify([from, mid, to]);
    }
  }

  // A* on a uniform grid spanning the endpoints + obstacles (with margin).
  const xs = [from.x, to.x, ...rects.flatMap((r) => [r.x, r.x + r.width])];
  const ys = [from.y, to.y, ...rects.flatMap((r) => [r.y, r.y + r.height])];
  const margin = grid * 2;
  const minX = Math.min(...xs) - margin, maxX = Math.max(...xs) + margin;
  const minY = Math.min(...ys) - margin, maxY = Math.max(...ys) + margin;
  const cols = Math.ceil((maxX - minX) / grid) + 1;
  const rows = Math.ceil((maxY - minY) / grid) + 1;
  const gx = (c: number) => minX + c * grid, gy = (r: number) => minY + r * grid;
  const snapC = (x: number) => Math.round((x - minX) / grid), snapR = (y: number) => Math.round((y - minY) / grid);

  const blocked = (c: number, r: number) => {
    const p = { x: gx(c), y: gy(r) };
    return rects.some((rect) => ptInRect(p, rect));
  };
  const start = { c: snapC(from.x), r: snapR(from.y) }, goal = { c: snapC(to.x), r: snapR(to.y) };
  const key = (c: number, r: number) => r * cols + c;
  const h = (c: number, r: number) => Math.abs(c - goal.c) + Math.abs(r - goal.r);

  type N = { c: number; r: number; dir: number; g: number; f: number; prev: number | null; self: number };
  const open: N[] = [];
  const best = new Map<number, number>();
  const startNode: N = { ...start, dir: -1, g: 0, f: h(start.c, start.r), prev: null, self: key(start.c, start.r) };
  open.push(startNode);
  const came = new Map<number, N>();
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let goalNode: N | null = null;

  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.c === goal.c && cur.r === goal.r) { goalNode = cur; break; }
    came.set(cur.self, cur);
    for (let d = 0; d < 4; d++) {
      const nc = cur.c + DIRS[d][0], nr = cur.r + DIRS[d][1];
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (blocked(nc, nr)) continue;
      const turn = cur.dir !== -1 && cur.dir !== d ? grid : 0; // turn penalty
      const ng = cur.g + grid + turn;
      const k = key(nc, nr);
      if (best.has(k) && best.get(k)! <= ng) continue;
      best.set(k, ng);
      open.push({ c: nc, r: nr, dir: d, g: ng, f: ng + h(nc, nr) * grid, prev: cur.self, self: k });
    }
  }

  if (!goalNode) return simplify([from, { x: to.x, y: from.y }, to]); // give up gracefully → L path

  const pts: Pt[] = [];
  let n: N | undefined = goalNode;
  while (n) { pts.push({ x: gx(n.c), y: gy(n.r) }); n = n.prev != null ? came.get(n.prev) : undefined; }
  pts.reverse();
  return simplify([from, ...pts, to]);
}

// Drop collinear / duplicate points.
function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) { out[out.length - 1] = p; continue; }
    }
    out.push(p);
  }
  return out;
}
```
NOTE on the fast-path guard: the `ptInRect(mid, {0,0,0,0})` check is a no-op placeholder; the real guard is `clear(from,mid,rects) && clear(mid,to,rects)`. If the L-path's own bend sits inside an obstacle the `clear` checks already fail (segments touch the rect). If both L-paths fail, A* runs. Iterate until the three tests are green; the **no-segment-hits-obstacle** test is the non-negotiable guarantee (it checks against the *un-inflated* rect, which the inflated routing satisfies with margin).

- [ ] **Step 4: Run → PASS** — `npx vitest run src/graph/routing.test.ts`. If A* is slow or a test flakes, reduce `grid` default or tighten the blocked-cell check; keep all three assertions.

- [ ] **Step 5: Commit**
```bash
git add src/graph/routing.ts src/graph/routing.test.ts
git commit -m "feat: pure orthogonal A* edge router with obstacle avoidance"
```

---

### Task 6: RoutedEdge + Legend + wire palette into canvases

**Files:** Create `src/components/RoutedEdge.tsx`, `src/components/routing-context.ts`; replace `src/components/Legend.tsx` body; Modify `src/graph/flow-elements.ts`, `src/graph/grouped-elements.ts`, `src/components/GraphCanvas.tsx`, `src/components/GroupedCanvas.tsx`

UI/integration task — verified by build + visual QA.

- [ ] **Step 1: `src/components/routing-context.ts`** — supplies obstacle rects (by node id) to edges:
```ts
import { createContext, useContext } from 'react';
import type { Rect } from '../graph/routing';
export interface Obstacle { id: string; rect: Rect }
export const RoutingContext = createContext<Obstacle[]>([]);
export const useObstacles = () => useContext(RoutingContext);
```

- [ ] **Step 2: `src/components/RoutedEdge.tsx`** — custom edge using the router:
```tsx
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { useMemo } from 'react';
import { routeOrthogonal } from '../graph/routing';
import { useObstacles } from './routing-context';

export function RoutedEdge({ id, source, target, sourceX, sourceY, targetX, targetY, data, style, markerEnd, label }: EdgeProps) {
  const obstacles = useObstacles();
  const d = useMemo(() => {
    const rects = obstacles.filter((o) => o.id !== source && o.id !== target).map((o) => o.rect);
    const pts = routeOrthogonal({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, rects);
    // rounded-corner path
    const R = 8;
    let path = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      path += ` L ${pts[i].x},${pts[i].y}`; // (rounded join optional; straight is fine for v1)
    }
    path += ` L ${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
    return path;
  }, [obstacles, source, target, sourceX, sourceY, targetX, targetY]);

  return <BaseEdge id={id} path={d} style={style} markerEnd={markerEnd} label={label as any} labelStyle={{ fontSize: 10 }} />;
}
```
(Rounded corners are a nice-to-have; straight orthogonal joins satisfy the requirement. The orchestrator's frontend-design QA may add corner rounding.)

- [ ] **Step 3: Use the palette + RoutedEdge type in element mappers.** In `flow-elements.ts` and `grouped-elements.ts`: import `relationStyle` and set each edge's `type: 'routed'` and `style.stroke: relationStyle(relKey).colorVar` (replace the local `EDGE_COLOR` maps). Keep `markerEnd` for directed; keep dashed for undirected. (These remain type-only `@xyflow/react` imports.)

- [ ] **Step 4: Register RoutedEdge + provide obstacles in `GraphCanvas.tsx`.** Build obstacle rects from the laid-out nodes and wrap the canvas in `RoutingContext.Provider`:
```tsx
const edgeTypes = useMemo(() => ({ routed: RoutedEdge } as unknown as EdgeTypes), []);
const obstacles = useMemo(() => nodes.map((n) => ({ id: n.id, rect: { x: n.position.x, y: n.position.y, width: 210, height: 96 } })), [nodes]);
// ... <RoutingContext.Provider value={obstacles}> <ReactFlow ... edgeTypes={edgeTypes} onEdgeClick={...later...}> ... </RoutingContext.Provider>
```
(Use 210×96 for full ticket nodes. Import `EdgeTypes` type, `RoutingContext`, `RoutedEdge`.)

- [ ] **Step 5: Same for `GroupedCanvas.tsx`**, but obstacles must be ABSOLUTE rects and include containers. Compute absolute position for child member nodes (`parent.position + child.position`) and use compact size 168×88 for members and the container `data.width/height` for containers:
```tsx
const obstacles = useMemo(() => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const abs = (n: any): { x: number; y: number } => n.parentId && byId.get(n.parentId)
    ? { x: byId.get(n.parentId)!.position.x + n.position.x, y: byId.get(n.parentId)!.position.y + n.position.y } : n.position;
  return nodes.map((n) => {
    const p = abs(n);
    const w = n.type === 'container' ? (n.data.width ?? 200) : 168;
    const h = n.type === 'container' ? (n.data.height ?? 80) : 88;
    return { id: n.id, rect: { x: p.x, y: p.y, width: w, height: h } };
  });
}, [nodes]);
```
Wrap in `RoutingContext.Provider`, add `edgeTypes={{ routed: RoutedEdge }}` (cast as in GraphCanvas).

- [ ] **Step 6: Replace `Legend.tsx` body** with the palette-driven legend (clickable to toggle relation visibility):
```tsx
import type { Dispatch } from 'react';
import type { Action, GraphState } from '../state/graphReducer';
import type { Graph } from '../core/model';
import { legendEntries } from '../graph/relation-colors';

export function Legend({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const entries = legendEntries(graph);
  return (
    <div className="legend">
      {entries.map((e) => (
        <button key={e.key} className={`legend-row ${state.hiddenRelations.has(e.key) ? 'off' : ''}`}
          onClick={() => dispatch({ type: 'toggleRelation', relation: e.key })} title="Toggle">
          <span className="legend-swatch" style={{ background: e.colorVar }} />{e.label}
        </button>
      ))}
    </div>
  );
}
```
Add to `sidebar.css`:
```css
.legend { display: flex; flex-direction: column; gap: 3px; }
.legend-row { display: flex; align-items: center; gap: 8px; background: none; border: none; color: var(--ink-muted); font-size: 12px; padding: 3px 4px; border-radius: 6px; cursor: pointer; text-align: left; }
.legend-row:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.legend-row.off { opacity: .4; text-decoration: line-through; }
.legend-swatch { width: 12px; height: 4px; border-radius: 2px; }
```
NOTE: `flow-elements.ts` hides edges whose `relKey` is in `hiddenRelations` where `relKey = kind==='hierarchy' ? 'hierarchy' : relation`. The legend toggles those same keys — consistent.

- [ ] **Step 7: Verify** — `npm test` (72 pass: 70 + relation-colors + routing files added earlier; exact count may differ — all green), `npm run build` clean.

- [ ] **Step 8: Commit**
```bash
git add -A
git commit -m "feat: routed orthogonal edges, relationship palette wiring, sidebar legend"
```

---

# PHASE 3 — Edge click popup

### Task 7: Reducer — selected edge

**Files:** Modify `src/state/graphReducer.ts`; Test `src/state/graphReducer.edge.test.ts`

- [ ] **Step 1: Failing test** — `src/state/graphReducer.edge.test.ts`
```ts
import { initialState, reducer } from './graphReducer';

test('selectEdge records edge id + click position; clearEdge resets', () => {
  const s = reducer(initialState, { type: 'selectEdge', id: 'link:blocks:A->B', x: 120, y: 80 });
  expect(s.selectedEdge).toEqual({ id: 'link:blocks:A->B', x: 120, y: 80 });
  expect(reducer(s, { type: 'clearEdge' }).selectedEdge).toBeNull();
});

test('selecting a node clears any selected edge', () => {
  const s = reducer(initialState, { type: 'selectEdge', id: 'e1', x: 1, y: 2 });
  expect(reducer(s, { type: 'select', key: 'BUG-40' }).selectedEdge).toBeNull();
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/state/graphReducer.edge.test.ts`

- [ ] **Step 3: Implement** — in `graphReducer.ts`:
  - Add to `GraphState`: `selectedEdge: { id: string; x: number; y: number } | null;` and to `initialState`: `selectedEdge: null,`.
  - Add to `Action`: `| { type: 'selectEdge'; id: string; x: number; y: number } | { type: 'clearEdge' }`.
  - Add cases: `case 'selectEdge': return { ...state, selectedEdge: { id: action.id, x: action.x, y: action.y }, selectedKey: null };` and `case 'clearEdge': return { ...state, selectedEdge: null };`.
  - In the existing `case 'select':` also clear edge: `return { ...state, selectedKey: action.key, selectedEdge: null };`.

- [ ] **Step 4: Run → PASS** — `npx vitest run src/state/graphReducer.edge.test.ts` and `npx vitest run src/state/` (no regressions).

- [ ] **Step 5: Commit**
```bash
git add src/state/graphReducer.ts src/state/graphReducer.edge.test.ts
git commit -m "feat: selectedEdge state for the edge popup"
```

---

### Task 8: EdgePopup + wire onEdgeClick

**Files:** Create `src/components/EdgePopup.tsx`, `src/components/edge-popup.css`; Modify `src/components/GraphCanvas.tsx`, `src/components/GroupedCanvas.tsx`, `src/App.tsx`

UI task — verified by build + visual QA.

- [ ] **Step 1: `src/components/EdgePopup.tsx`** — resolves the selected edge id to its two tickets + relationship:
```tsx
import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { Graph, GraphNode } from '../core/model';
import type { Action, GraphState } from '../state/graphReducer';
import { relationStyle } from '../graph/relation-colors';
import './edge-popup.css';

export function EdgePopup({ graph, state, dispatch }: { graph: Graph; state: GraphState; dispatch: Dispatch<Action> }) {
  const sel = state.selectedEdge;
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'clearEdge' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, dispatch]);
  if (!sel) return null;
  const edge = graph.edges.find((e) => e.id === sel.id);
  if (!edge) return null;
  const src = graph.nodes.find((n) => n.key === edge.source);
  const tgt = graph.nodes.find((n) => n.key === edge.target);
  if (!src || !tgt) return null;
  const rel = relationStyle(edge.kind === 'hierarchy' ? 'hierarchy' : edge.relation);

  const Mini = ({ n }: { n: GraphNode }) => (
    <div className="ep-mini" style={{ borderLeftColor: `var(--kind-${n.type.kind})` }}>
      <div className="ep-k" style={{ color: `var(--kind-${n.type.kind})` }}>{n.key}</div>
      <div className="ep-s">{n.summary}</div>
      <div className="ep-meta"><span className="ep-pill" style={{ color: `var(--status-${n.status.category})` }}>{n.status.name}</span>{n.assignee && <span className="ep-av">{n.assignee.initials}</span>}</div>
    </div>
  );

  return (
    <>
      <div className="ep-scrim" onClick={() => dispatch({ type: 'clearEdge' })} />
      <div className="ep-pop" style={{ left: sel.x, top: sel.y }} role="dialog">
        <div className="ep-h">Relationship<button className="ep-x" onClick={() => dispatch({ type: 'clearEdge' })}>×</button></div>
        <Mini n={src} />
        <div className="ep-rel"><span className="ep-badge" style={{ background: rel.colorVar, color: '#fff' }}>{edge.label} ↓</span></div>
        <Mini n={tgt} />
        <div className="ep-phrase">“{src.key} <b>{edge.relation}</b> {tgt.key}”</div>
        <div className="ep-actions">
          <button onClick={() => dispatch({ type: 'setFocus', key: src.key })}>Focus {src.key}</button>
          <button onClick={() => dispatch({ type: 'setFocus', key: tgt.key })}>Focus {tgt.key}</button>
        </div>
        <div className="ep-open"><a href={src.url} target="_blank" rel="noreferrer">Open {src.key} ↗</a><a href={tgt.url} target="_blank" rel="noreferrer">Open {tgt.key} ↗</a></div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: `src/components/edge-popup.css`** (tokens, glassy):
```css
.ep-scrim { position: absolute; inset: 0; z-index: 9; }
.ep-pop { position: absolute; z-index: 10; width: 264px; transform: translate(-50%, 12px); background: var(--panel); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); backdrop-filter: blur(10px); padding: 13px; color: var(--ink); font-family: var(--font-sans); animation: ep-in 140ms ease both; }
@keyframes ep-in { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 12px); } }
.ep-h { font-size: 10px; text-transform: uppercase; letter-spacing: .7px; color: var(--ink-muted); display: flex; justify-content: space-between; margin-bottom: 9px; }
.ep-x { border: none; background: none; color: var(--ink-muted); font-size: 16px; cursor: pointer; }
.ep-mini { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--border); border-radius: 9px; padding: 8px 10px; }
.ep-k { font: 700 10px var(--font-mono); }
.ep-s { font-size: 11px; color: var(--ink); margin-top: 3px; }
.ep-meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
.ep-pill { font-size: 9px; font-weight: 700; }
.ep-av { margin-left: auto; width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 8px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.ep-rel { text-align: center; margin: 8px 0; }
.ep-badge { font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 20px; }
.ep-phrase { font-size: 10px; color: var(--ink-muted); text-align: center; margin-top: 9px; }
.ep-actions { display: flex; gap: 7px; margin-top: 10px; }
.ep-actions button { flex: 1; font-size: 10px; padding: 6px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); color: var(--ink); cursor: pointer; }
.ep-open { display: flex; gap: 10px; justify-content: center; margin-top: 8px; }
.ep-open a { font-size: 10px; color: var(--accent); }
```

- [ ] **Step 3: Wire `onEdgeClick` in `GraphCanvas.tsx` and `GroupedCanvas.tsx`.** Pass a `dispatch` (GraphCanvas needs it added to props) or an `onEdgeClick` callback. Add to the `<ReactFlow>`:
```tsx
onEdgeClick={(e, edge) => onEdgeClick?.(edge.id, e.clientX, e.clientY)}
```
GroupedCanvas already takes `dispatch`; for GraphCanvas, add an `onEdgeClick?: (id: string, x: number, y: number) => void` prop. In `App.tsx`, pass `onEdgeClick={(id, x, y) => dispatch({ type: 'selectEdge', id, x, y })}` to both canvases, and render `<EdgePopup graph={view} state={state} dispatch={dispatch} />` inside `.app-main` (popup positions relative to the viewport; `.app-main` is `position: relative`, so convert client coords: pass `e.clientX - mainRect.left`... — simplest: render EdgePopup with `position: fixed` by changing `.ep-pop` to `position: fixed` and use raw clientX/clientY). Use **`position: fixed`** for `.ep-pop` and `.ep-scrim` so client coordinates work directly.

- [ ] **Step 4: Verify** — `npm test` (all pass), `npm run build` clean.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: click-a-line edge popup with both tickets + relationship"
```

---

# PHASE 4 — Docs

### Task 9: README + dual-theme screenshots

**Files:** Modify `README.md`; add `docs/screenshot-dark.png`, `docs/screenshot-light.png`

- [ ] **Step 1:** Add a **Design & theming** section: light/dark toggle (default dark, persisted), the sidebar control layout, orthogonal edge routing (lines route around tickets), relationship-colored edges + legend, and the click-a-line popup. Update the Architecture section if the diagram references the old top toolbar.
- [ ] **Step 2:** Capture a dark-theme and a light-theme screenshot (run the app, toggle) and embed both. Replace the old top-bar screenshot reference if stale.
- [ ] **Step 3:** Verify `npm run build` clean.
- [ ] **Step 4: Commit**
```bash
git add README.md docs/screenshot-dark.png docs/screenshot-light.png
git commit -m "docs: document theming, sidebar, routing, and edge popup"
```

---

## Self-Review notes (reconciled)

- **Spec coverage:** theme tokens + toggle + persistence (T1); sidebar replacing toolbar + control cleanup (T2); token migration both themes + RF chrome (T3); relationship palette (T4); orthogonal A* router with no-segment-through-obstacle guarantee (T5); RoutedEdge + obstacle provision in graph & grouped + legend (T6); reducer selectedEdge (T7); EdgePopup + onEdgeClick (T8); docs (T9). Timeline routing/tokens covered under T3 (tokens) and T6 (relation colors); the timeline dependency-arrow re-route around bars is folded into T6's RoutedEdge usage where the timeline already builds its own SVG — if the timeline keeps its own arrow renderer, it sources color from `relationStyle('blocks')` and may use `routeOrthogonal` against bar rects (note added in T6 scope; acceptable to keep timeline arrows curved per the earlier discussion if routing there proves awkward — the strict guarantee was accepted for graph/grouped where tickets are boxes).
- **Placeholder scan:** the only `TODO`-style note is the deliberate fast-path guard comment in routing.ts with iteration guidance; no unfilled steps.
- **Type consistency:** `Theme`, `nextTheme`/`initialTheme`/`useTheme`; `relationStyle`/`legendEntries`/`RelationStyle`; `routeOrthogonal`/`Rect`/`Pt`; `RoutingContext`/`Obstacle`/`useObstacles`; reducer `selectedEdge` + `selectEdge`/`clearEdge`; `RoutedEdge` edge type key `'routed'` used consistently in mappers + canvases. Sidebar reuses existing actions (`setViewMode`, `setGroupDepth`, `setLayout`, `toggleType`, `toggleRelation`, `setSearch`).
- **@xyflow/react type-only** preserved in `flow-elements.ts`/`grouped-elements.ts`; `RoutedEdge.tsx`/`EdgePopup.tsx`/canvases are components (runtime import OK, not imported by node tests).
