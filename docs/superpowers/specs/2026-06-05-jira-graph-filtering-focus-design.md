# Jira Graph — Filtering, Focus Navigation, Deep Grouping & Large Test Data — Design Spec

**Date:** 2026-06-05
**Status:** Approved (standing approval — implement autonomously, merge to main).
**Builds on:** MVP + view-modes + redesign/routing (all on `main`).

## Goals

1. **More ways to filter:** by **project**, by **assignee**, and by a single **ticket** (focus).
2. **Click-to-focus everywhere:** clicking a ticket in any view filters to that ticket + everything related to it, with the ticket **highlighted**; a **back button** returns to the full view. A sidebar **ticket typeahead** does the same by key/title.
3. **Not an editor:** remove the connection-handle dots so users can't drag to create links — this is a visualization only.
4. **Deeper grouping:** in grouped mode, nest the full hierarchy (epic ▸ story ▸ task ▸ subtask), not just epic ▸ story.
5. **Epic badge on cards:** when a ticket belongs to an epic, show a small purple chip with the epic's key (the main work use case has Epic Link).
6. **Extensive large-project test data:** a new dataset with multiple projects, deep hierarchy, many assignees, and cross-links, to verify all of the above at scale.

No new runtime dependencies. Data/provider seam unchanged in spirit (normalize gains additive fields).

## 1. Data model additions (`src/core/model.ts`)

Add to `GraphNode`:
```ts
project: { key: string; name: string };   // from fields.project
description?: string;   // flattened plain text (ADF for v3, string for v2) for the overview popup
epicKey?: string;       // resolved epic ancestor key (for the badge + epic grouping)
epicSummary?: string;   // epic's summary if known
```
`assignee` already exists (`{ displayName, initials, avatarUrl? }`).

## 2. Normalization (`src/core/normalize.ts`)

- Read `fields.project` → `node.project` (fallback `{ key: keyPrefix(issueKey), name: keyPrefix }` when absent, deriving the prefix before the `-` in the issue key).
- Set `node.description = adfToText(fields.description)` (already-built `adf.ts` handles v3 ADF + v2 string; empty string when absent).
- **Epic resolution (post-process in `normalizeIssues`):** after all nodes/edges are built, build a child→parent map from hierarchy edges; for each non-epic node, climb to the nearest ancestor whose `type.kind === 'epic'` and stamp `epicKey` (+ `epicSummary` from that epic node). Works for both v3 `parent` and v2 Epic Link, because both produce `epic`/`parent` hierarchy edges. Nodes with no epic ancestor get no `epicKey` (no badge — e.g. v2-no-epic dataset).

## 3. State (`src/state/graphReducer.ts`)

Add:
```ts
hiddenProjects: Set<string>;    // project keys hidden
hiddenAssignees: Set<string>;   // assignee displayNames hidden ('__unassigned__' for none)
```
Actions: `toggleProject`, `toggleAssignee`. (Existing `setFocus`/`setMode`/`setDepth`/`select` reused.) Defaults: empty sets.

## 4. Shared filter predicate (`src/graph/visible.ts` — new, pure, tested)

DRY the per-view filtering into one predicate:
```ts
export function isNodeVisible(node: GraphNode, state: GraphState): boolean;
// hidden if: hiddenTypes has kind, hiddenStatuses has status.category,
// hiddenProjects has project.key, or hiddenAssignees has (assignee?.displayName ?? '__unassigned__')
```
`flow-elements.ts`, `grouped-elements.ts`, `TreeView`, and `TimelineView` all use this (replacing their inline type/status checks). Edge visibility unchanged (relation filter + both endpoints visible).

### 5a. Click a ticket → quick overview popup (`NodePopup`)

Clicking a ticket in ANY view opens a quick **overview popover** (glassy, like the edge popup) at the click point showing:
- **Title:** key + summary, with type/priority, status pill, assignee, story points, and the epic badge (§8).
- **Description:** the flattened `node.description` text (truncated with scroll).
- **Relationships:** EVERY edge touching the ticket, grouped and human-readable — e.g. `blocks → SRCH-12`, `is blocked by ← CHK-9`, `relates ↔ MOB-3`, `epic ▸ CHK-1`, `parent of ▸ CHK-44`. Each row is clickable to open THAT ticket's popup (peek around). Color-coded by relationship.
- **Actions:** **"Focus this ticket"** (→ enters the focus-filter view, §5b) and **"Open in Jira ↗"**.

State: add `nodePopup: { key: string; x: number; y: number } | null` to `GraphState` with `openNode(key,x,y)` / `closeNode` actions. Node click dispatches `openNode` + `select(key)`. Dismiss on scrim click / Escape / opening another. This **replaces** the old side `DetailPanel` (remove it from the app render). A pure helper `ticketRelationships(graph, key)` (new, tested) returns the grouped relationship rows the popup renders.

### 5b. Focus-filter view + highlight + back

- **Focus** is entered by the popup's "Focus this ticket" button and by the sidebar **ticket typeahead** — both dispatch `setFocus(key)` (and `setMode('focus')`). The app already renders `view = neighborhood(focusKey, depth)`, so it filters to the ticket + related neighborhood. From the popup of any ticket you can drill into focus.
- **Focal highlight:** the focused ticket (`node.key === state.focusKey`) renders with a distinct ring/glow in every view (`TicketNode`/`ContainerNode`/tree row/timeline bar via a `focusKey`/`data.focal` flag).
- **Back button:** a floating **"← Back to all"** control on the canvas (top-left), shown only in focus mode, dispatching `setMode('map')`. The sidebar also keeps its "Exit focus" + depth slider (already present).
- **Ticket typeahead (sidebar):** a "Focus a ticket" input with a typeahead over the FULL graph (matches by key/summary). Selecting dispatches `setFocus(key)`; exact key + Enter also focuses.
- The free-text **search** stays as a highlight/dim affordance within the current view (distinct from the typeahead, which focuses).
- Focus respects the **depth** slider (already in the sidebar in focus mode).

## 6. Remove connection handles (`TicketNode`, `ContainerNode`, canvases)

- Keep React Flow `<Handle>` components (edges need anchor points) but render them **invisible and non-interactive**: `isConnectable={false}` on each Handle, and CSS `.react-flow__handle { opacity: 0; pointer-events: none; width: 1px; height: 1px; }`.
- Set `nodesConnectable={false}` on every `<ReactFlow>` (graph + grouped). Keep pan/zoom. (Node dragging may stay enabled; only link-creation is removed.)

## 7. Deeper grouping (`graphReducer`, `grouping.ts` already supports depth)

- Extend `GroupDepth` to `1 | 2 | 3 | 4` (default **4** = full nesting). Sidebar depth labels: `Epic / Story / Task / Subtask`.
- `groupGraph(graph, depth)` already nests via `level + 1 < depth`; depth 4 yields epic ▸ story ▸ task containers with subtasks as member chips inside tasks. No grouping-logic change beyond allowing depth 4.
- The nested-layout sizing already handles arbitrary depth.

## 8. Epic badge on cards (`TicketNode` full + compact)

- When `node.epicKey` is set and `node.type.kind !== 'epic'`, render a small chip: a purple square/icon (epics are `--kind-epic`) + the epic key (e.g. `CHK-1`). Tooltip shows `epicSummary` when present.
- Placed compactly in the card header/footer; works in both full and compact variants.
- In grouped mode, since the epic is usually the container, the badge is most useful in graph/tree/timeline; it still renders harmlessly in grouped.

## 9. Extensive large-project test data (`src/fixtures/large.ts` — new)

A deterministic generator (no `Math.random`; index-seeded) producing **~120 issues across 3 projects** in v3 API shape:
- Projects: `CHK` (Checkout Platform), `SRCH` (Search & Discovery), `MOB` (Mobile App). Each: 2–3 epics → 3–4 stories each → 2–3 tasks each → 0–2 subtasks; plus several bugs.
- **Assignees:** a pool of ~10 people, distributed across issues (some unassigned).
- **Hierarchy:** full `parent` chain (epic→story→task→subtask) so deep grouping + epic badges populate.
- **Cross-links:** `blocks` chains within a project and a few cross-project `relates`/`blocks`.
- **Dates:** staggered `duedate`/start/sprint for the timeline.
- Exposed as `largeIssues` + `largeCaps` (apiVersion 3, hasEpicLink false but parent-based epics; startDate/sprint field ids set). Registered as a new dataset option **"Large demo"** in the dataset picker (kept alongside v3/v2/v2-no-epic). The generator is unit-tested for counts + structural invariants (multiple projects, multiple assignees, ≥1 four-level chain).

## 10. Sidebar additions (`Sidebar.tsx`)

- **Focus-ticket typeahead** near the top.
- **Projects** section: toggle chips for each project present (from the full graph).
- **Assignees** section: toggle chips per assignee present (+ "Unassigned").
- Existing sections (modes, depth/layout, types, relationships legend, search, dataset, theme) stay. Filter sections list entries present in the **full** graph so you can re-enable.

## 11. Files (new / changed)

```
src/core/model.ts            MOD  + project/epicKey/epicSummary on GraphNode
src/core/normalize.ts        MOD  read fields.project; resolve epicKey in normalizeIssues
src/graph/visible.ts         NEW  isNodeVisible(node, state) shared predicate (tested)
src/graph/relationships.ts   NEW  ticketRelationships(graph, key) → grouped rows for the popup (tested)
src/state/graphReducer.ts    MOD  + hiddenProjects/hiddenAssignees + toggleProject/toggleAssignee; + nodePopup + openNode/closeNode; GroupDepth 1..4 default 4
src/fixtures/large.ts        NEW  large multi-project generator (tested)
src/graph/flow-elements.ts   MOD  use isNodeVisible; pass focal flag
src/graph/grouped-elements.ts MOD use isNodeVisible; pass focal flag
src/components/TreeView.tsx  MOD  use isNodeVisible; focal highlight; click→focus
src/components/TimelineView.tsx MOD use isNodeVisible; focal highlight; click→focus
src/components/TicketNode.tsx MOD epic badge (full+compact); focal ring; invisible handles
src/components/ContainerNode.tsx MOD invisible handles; focal ring
src/components/GraphCanvas.tsx / GroupedCanvas.tsx MOD nodesConnectable=false; node click → openNode; back button host
src/components/BackButton.tsx NEW floating "← Back to all" (focus mode)
src/components/TicketTypeahead.tsx NEW focus-ticket search (in Sidebar)
src/components/NodePopup.tsx NEW quick ticket overview popover (title/description/relationships/actions)
src/components/DetailPanel.tsx REMOVE from app render (superseded by NodePopup)
src/components/Sidebar.tsx   MOD projects + assignees sections + typeahead; depth labels 1..4
src/components/*.css          MOD epic-badge, focal ring, hidden handles, back button, filter chips, node popup
src/App.tsx                  MOD register Large dataset; node click → openNode+select; render NodePopup + BackButton
```

## 12. Testing

Pure/tested: `isNodeVisible` (each filter dimension incl. unassigned + project); `ticketRelationships(graph, key)` (groups inward/outward/hierarchy rows correctly); epic resolution in `normalizeIssues` (v3 parent chain → epicKey/epicSummary on descendants; none for orphan/epic); `large.ts` generator (≥3 projects, ≥8 assignees, total in range, ≥1 epic→story→task→subtask chain, normalizes without dropping edges); reducer `toggleProject`/`toggleAssignee`/`openNode`/`closeNode` + GroupDepth 4. View/visual layer (node popup, click→popup, focus highlight, back button, badges, hidden handles, deep grouping, large data) verified by running in the browser, both themes.

## 13. Out of scope (YAGNI)

Editing/linking · saved filter presets · multi-ticket focus · server-side data · cross-project layout optimization · per-project assignee sub-grouping in the sidebar (assignees listed flat, AND-combined with project filter).
