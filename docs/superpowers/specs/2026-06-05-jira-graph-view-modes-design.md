# Jira Graph — Legibility View Modes Design Spec

**Date:** 2026-06-05
**Status:** Approved design, pending implementation plan
**Builds on:** the MVP (`2026-06-04-jira-graph-design.md`), now merged to `main`.

## 1. Problem

The free-form node graph becomes unreadable past ~50 tickets. We need view modes
that let a human understand how tickets relate **even on big projects** — by grouping
detail into readable blocks and offering structure- and schedule-oriented views.

## 2. Overview

Add three new view modes alongside the existing graph, behind a toolbar **mode
switcher**: `graph | grouped | tree | timeline`. All four render from the **same
normalized `Graph`** the provider already produces. Only the Timeline mode needs new
data (a time dimension), added as optional fields to the normalized model.

```
DataProvider → normalized Graph ─┬─ GraphCanvas    (existing free graph)
                                 ├─ GroupedCanvas  (nested containers)   ← new
                                 ├─ TreeView       (collapsible outline)  ← new
                                 └─ TimelineView   (Gantt)                ← new (+ dates)
```

Each view is an isolated component selected by a `viewMode` value in state. They do
not know about each other. The provider and `normalize()` are unchanged except for the
additive date fields (§6).

The three new view components are built using the **frontend-design** skill for visual
quality (explicit user requirement).

## 3. State changes

Extend `GraphState` (src/state/graphReducer.ts):

```ts
type ViewMode = 'graph' | 'grouped' | 'tree' | 'timeline';
type GroupDepth = 1 | 2 | 3; // 1=Epic, 2=Epic▸Story, 3=Epic▸Story▸Task

interface GraphState {
  // ...existing...
  viewMode: ViewMode;        // default 'graph'
  groupDepth: GroupDepth;    // default 2 (Epic ▸ Story)
  collapsed: Set<string>;    // container keys collapsed in grouped/tree modes
}
```

New actions: `setViewMode`, `setGroupDepth`, `toggleCollapsed`. Existing filters/search
apply across modes where meaningful (a hidden type stays hidden in every mode).

## 4. Grouped mode (centerpiece) — nested containers

**Renderer:** reuse React Flow via its native **compound/parent nodes** (a node with
`parentId` children). A container is a parent node; tickets are child nodes;
**ticket-to-ticket cross-links are ordinary edges between child nodes**, routed by the
same engine. No second renderer.

**Containment** derives from the data we already normalize: `hierarchyLevel` plus the
`parent`/`epic`/`subtask` hierarchy edges. `groupDepth` chooses where the box
boundaries sit:
- depth 1 — Epic box holds all descendants as a flat set.
- depth 2 (default) — Epic box holds Story sub-boxes, each holding its tasks/subtasks.
- depth 3 — adds a Task level of nesting.

**Collapse/expand** per container (`collapsed` set). A collapsed container shows a
header + item count; cross-links whose endpoint is hidden inside a collapsed container
re-route to the container node so no edge dangles.

**Clean cross-links (user requirement — ticket-to-ticket, as clean as possible):**
- smoothstep/bezier routing;
- on hover/selection of a ticket, highlight only its edges and dim the rest;
- edge color by relation (gray hierarchy is implied by containment and not drawn inside
  a container; red `blocks`, blue `relates` for cross-links).

**Nested layout** (hand-rolled, pure, tested): pack child nodes in a grid within each
container; size each container to its contents; lay containers out in a wrapped row/grid.
Returns positions + container sizes. Determinism required.

## 5. Tree mode — collapsible outline

A compact indented outline: `▾ EPIC-1 ▸ ▾ STORY-10 ▸ TASK-20 …`, expand/collapse per
node (shares the `collapsed` set). Each row shows key, summary, type/status. Relationship
links render as small inline badges on the row (e.g. `⛔ blocked by BUG-50`,
`↔ relates EPIC-2`) that jump to / focus the linked ticket on click. Pure DOM component,
no React Flow. Densest mode; best for very large projects. The tree is built from the
hierarchy edges; tickets with no parent (orphans) sit at the root.

## 6. Timeline / Gantt mode + date model

**Model extension (additive, optional):** add to `GraphNode`:
```ts
startDate?: string;  // ISO date
dueDate?: string;    // ISO date
sprint?: string;     // sprint name, if present
```
`normalize()` populates them from Jira fields: `fields.duedate` (due), a start date if
present (`fields.customfield_*` start, or sprint start), and the **Sprint custom field**
(an array of sprint objects in Jira). The sprint/start field ids are **feature-detected
by name** (like Epic Link) via `capabilities`; absent → fields stay undefined.

**Fixtures:** synthesize believable `duedate`/start/sprint values into the v3 and v2
fixtures so the mode is demonstrable without a live instance.

**Rendering (custom lightweight SVG/DOM, no Gantt library):**
- horizontal bars on a date axis (x = time);
- **rows grouped by epic** (epic header row, then its issues);
- bars colored by issue kind/status;
- **`blocks` dependencies drawn as arrows** between bars;
- a ticket with no dates is shown in a "no date" lane (or omitted with a count);
- if the instance/dataset has no date data at all, the mode shows a friendly empty state
  rather than breaking (parallels Epic-Link graceful degradation).

## 7. Components & files (proposed)

```
src/state/graphReducer.ts        # + viewMode, groupDepth, collapsed + actions
src/core/model.ts                # + startDate/dueDate/sprint on GraphNode
src/core/normalize.ts            # + date/sprint normalization (feature-detected)
src/graph/grouping.ts            # containment grouping by depth (pure, tested)
src/graph/layouts/grouped.ts     # nested container layout (pure, tested)
src/graph/timeline.ts            # Gantt geometry: dates → bar x/width/rows (pure, tested)
src/components/ViewModeSwitch.tsx # toolbar mode + depth controls
src/components/GroupedCanvas.tsx  # React Flow compound-node view
src/components/TreeView.tsx       # collapsible outline
src/components/TimelineView.tsx   # Gantt
src/App.tsx                       # switch on viewMode
```

The existing GraphCanvas, providers, fixtures (plus date additions), and the pure core
are otherwise unchanged.

## 8. Testing

Pure, unit-tested: containment grouping (`grouping.ts`) across depths 1–3; nested layout
invariants (children inside parent bounds, no overlap, deterministic); date normalization
(v3 duedate/sprint, absence → undefined); timeline geometry (bar x/width from dates, row
grouping, empty-date handling); reducer transitions for the new actions. The React/visual
layer (the three new components) is verified by running the app and by the
frontend-design pass.

## 9. Phasing (each independently shippable)

1. **Mode switch + Grouped mode** (state, grouping, nested layout, GroupedCanvas, switcher).
2. **Tree mode** (TreeView, reuses grouping/collapsed).
3. **Timeline mode** (model + normalize dates, fixtures dates, timeline geometry, TimelineView).

## 10. Out of scope (YAGNI)

Editing/writing · real-time · virtualization for 10k+ nodes (depth + grouping already
tame scale) · per-mode saved layouts · critical-path computation in the Gantt · drag to
reschedule. The architecture leaves room for these later.
