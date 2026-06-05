# Jira Graph — Redesign, Theming & Edge Routing Design Spec

**Date:** 2026-06-05
**Status:** Approved design, pending implementation plan
**Builds on:** the MVP + view-modes work (both merged to `main`).

## 1. Goals

Make the app look modern and cohesive, clean up the cramped controls, and make
relationships unmistakably readable:

1. A **theme system** with a user-selectable **light / dark** toggle; default dark
   ("Dark Studio" look), persisted.
2. A **left sidebar** that holds all controls (modes, filters, legend, search, theme,
   dataset) so the canvas is uncluttered and full-width.
3. **Orthogonal edge routing** that strictly never draws a line under a ticket — lines
   route *around* tickets.
4. **Relationship-colored edges** with a **legend** in the sidebar.
5. A **click-a-line popup** showing both tickets and the relationship.

Hard constraint (unchanged): no new runtime dependencies — the A* router and theming
are hand-rolled. The data/provider/normalize layer is untouched.

## 2. Theme system

- A single token sheet `src/theme/tokens.css` defines CSS custom properties under
  `:root` (shared) and overrides under `[data-theme="dark"]` and `[data-theme="light"]`.
- Tokens (names illustrative): `--surface`, `--surface-2`, `--panel`, `--border`,
  `--ink`, `--ink-muted`, `--bg`, `--bg-grid`, `--accent`, plus issue-kind colors
  (`--kind-epic`, `--kind-story`, `--kind-task`, `--kind-subtask`, `--kind-bug`) and
  status colors. Relationship colors live in the palette module (§5) but are exposed as
  vars too so the legend and edges agree.
- **All existing components are migrated to read tokens** instead of hard-coded hex:
  `TicketNode`, `ContainerNode`, `TreeView`, `TimelineView`, the canvases, panels.
- **React Flow theming:** set React Flow's own CSS variables (`--xy-background-color`,
  controls/minimap/edge defaults) per theme so the canvas chrome matches; dark uses a
  dark dot-grid `Background`.
- **Theme state:** a small `useTheme` hook (`'light' | 'dark'`), initialized from
  `localStorage` (falling back to `prefers-color-scheme`, default dark), writes
  `data-theme` on `<html>` and persists on change. Kept OUT of `graphReducer` (it is app
  chrome, not graph state). A toggle control lives in the sidebar.
- Dark aesthetic specifics: slate background with subtle dot grid, glassy translucent
  panels (`backdrop-filter: blur`), node cards with soft borders and elevation, edges
  with a faint glow (`drop-shadow`) in their relationship color.

## 3. Sidebar shell

- New `src/components/Sidebar.tsx` replaces the top `Toolbar` as the primary control
  surface. App layout becomes: fixed-width sidebar (left) + full-height canvas (right).
- Sidebar sections, top to bottom: brand; **view-mode** nav (vertical list: Graph /
  Grouped / Tree / Timeline, active highlighted); **context controls** (depth slider in
  grouped & focus modes; layout picker in graph mode — shown contextually); **Filters**
  (issue types, status categories, relations — compact toggles); **Legend** (§5); a
  **search** input; **dataset** picker (v3 / v2 / v2-no-epic); **theme toggle**.
- The old `Toolbar`/`ViewModeSwitch` are folded into the sidebar; remove them once the
  sidebar covers their functions. `DetailPanel` stays as the right-side panel.
- Collapsible: the sidebar can collapse to an icon rail (nice-to-have; include a
  collapse toggle, but full content is the default).

## 4. Orthogonal A* edge routing

- New pure module `src/graph/routing.ts`:
  ```ts
  interface Rect { x: number; y: number; width: number; height: number }
  interface Pt { x: number; y: number }
  // Returns ordered waypoints (incl. endpoints) describing an orthogonal path from
  // `from` to `to` that avoids every obstacle rect. Falls back to a direct L/Z path
  // when the straight orthogonal route is already clear.
  function routeOrthogonal(from: Pt, to: Pt, obstacles: Rect[], opts?: { padding?: number; grid?: number }): Pt[]
  ```
- **Algorithm:** uniform-grid A*. Inflate each obstacle by `padding` (default ~12px).
  Quantize the routing area to a grid (`grid` default ~16px). Mark cells intersecting an
  inflated obstacle as blocked (the source/target's own rects are NOT blocked near their
  exit/entry points). A* with a Manhattan heuristic and a **turn penalty** (so paths
  prefer few bends). Snap `from`/`to` to the nearest border point of their owning node
  facing the other endpoint. If a straight one- or two-bend orthogonal path is
  obstacle-free, return it directly (skip A*). Deterministic.
- **Rendering:** a custom React Flow edge `src/components/RoutedEdge.tsx` turns waypoints
  into an SVG path with rounded corners, colored by relation (§5), faint glow in dark.
  Arrowhead at the target for directed relations.
- **Obstacle source:** the canvas computes the obstacle `Rect[]` from the laid-out nodes
  (absolute positions + known card/container sizes) and passes it to edges via edge
  `data` (or React Flow context). For grouped mode, route in absolute flow coordinates;
  containers are obstacles too (lines route around sibling containers, between them is
  fine).
- **Scope:** graph, grouped, and timeline dependency arrows all use orthogonal routed
  paths around their obstacles (timeline obstacles = the bars).
- **Performance:** recompute routes only when node positions/sizes change (memoize on
  layout + viewport-independent inputs). Depth-limiting keeps node/edge counts small, so
  per-edge grid A* is cheap. If an edge has no obstacle-free route within budget, fall
  back to the direct orthogonal path (never crash, never an empty edge).

## 5. Relationship palette + legend

- New `src/graph/relation-colors.ts`: a single source of truth mapping relation →
  color + label. Covers `hierarchy` (gray), `blocks` (red), `relates` (blue),
  `duplicates` (violet), `clones` (teal), and a default for unknown relations. Colors
  defined as theme-aware tokens so they read on both backgrounds. Exposes
  `relationColor(relation)` and `legendEntries(graph)` (the relations actually present
  in the current graph, for the sidebar legend).
- `flow-elements.ts`, `grouped-elements.ts`, and the timeline/`RoutedEdge` all source
  edge color from this module (replacing the local `EDGE_COLOR` maps).
- `src/components/Legend.tsx` renders the present relations with swatches in the sidebar.

## 6. Click-a-line popup

- `src/components/EdgePopup.tsx`: shown when an edge is clicked. State: `selectedEdge`
  (edge id + click position) — held in `graphReducer` (`selectEdge` action) since it's
  graph-interaction state. Positioned at the click point (from React Flow's
  `onEdgeClick` event coordinates), clamped to the viewport.
- Contents: both ticket mini-cards (key, summary, status, assignee), the relationship as
  a color-matched badge with direction, the plain-English inward/outward phrasing
  ("A blocks B" / "B is blocked by A"), and **Focus** actions for each ticket. An
  "Open in Jira" link per ticket (uses `node.url`).
- Dismiss on outside click / Escape / canvas pan.

## 7. Components & files (new/changed)

```
src/theme/tokens.css            # NEW theme tokens (light/dark)
src/theme/useTheme.ts           # NEW theme state + persistence
src/components/Sidebar.tsx      # NEW primary control surface (replaces Toolbar)
src/components/Legend.tsx       # NEW relationship legend
src/components/ThemeToggle.tsx  # NEW (or inline in Sidebar)
src/components/EdgePopup.tsx    # NEW click-a-line popover
src/components/RoutedEdge.tsx   # NEW custom orthogonal edge
src/graph/routing.ts            # NEW pure A* orthogonal router
src/graph/relation-colors.ts    # NEW relation → color/label palette + legend data
src/graph/flow-elements.ts      # use relation-colors + RoutedEdge type; emit obstacles
src/graph/grouped-elements.ts   # use relation-colors + RoutedEdge; obstacles incl. containers
src/components/GraphCanvas.tsx  # register RoutedEdge, supply obstacle rects, onEdgeClick
src/components/GroupedCanvas.tsx# same
src/components/TimelineView.tsx # route dependency arrows around bars; theme tokens
src/components/TreeView.tsx     # theme tokens
src/components/TicketNode.tsx   # theme tokens (full + compact)
src/components/ContainerNode.tsx# theme tokens
src/state/graphReducer.ts       # + selectedEdge + selectEdge/clearEdge actions
src/App.tsx                     # sidebar+canvas layout, data-theme wiring, EdgePopup
src/App.css / panels.css / *.css# migrate hard-coded colors → tokens
```
The existing `Toolbar.tsx` / `ViewModeSwitch.tsx` are removed once the sidebar supersedes
them. No changes to providers, normalize, grouping, layouts, tree/timeline geometry
(except color sourcing).

## 8. Testing

Pure, unit-tested:
- `routing.ts`: path connects endpoints; every segment is axis-aligned; no segment
  intersects an obstacle rect (the core guarantee); returns a direct path when clear;
  deterministic; falls back without throwing when boxed in.
- `relation-colors.ts`: known relations map to stable colors/labels; `legendEntries`
  returns only relations present, de-duped.
- `graphReducer`: `selectEdge`/`clearEdge` transitions.

The React/visual layer (sidebar, theming, RoutedEdge rendering, popup, both themes) is
verified by running the app and screenshotting both themes across modes.

## 9. Phasing (each independently shippable)

1. **Theme system + sidebar shell** — tokens, `useTheme`, Sidebar, migrate all
   components/CSS to tokens, remove the top toolbar. (Biggest visual change.)
2. **Orthogonal routing + palette + legend** — `routing.ts`, `RoutedEdge`,
   `relation-colors.ts`, `Legend`, wire into graph/grouped/timeline.
3. **Edge popup** — reducer state + `EdgePopup` + canvas `onEdgeClick`.

## 10. Out of scope (YAGNI)

Editing tickets · real-time · saving theme/layout server-side · animated edge flow ·
multi-select on edges · routing optimization beyond per-edge A* (no global edge-bundling
or crossing-minimization) · sidebar drag-resize. Room left for all later.
