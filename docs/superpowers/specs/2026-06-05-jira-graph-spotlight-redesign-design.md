# Jira Graph — Spotlight Mode + Two-View Simplification — Design Spec

**Date:** 2026-06-05
**Status:** Approved (standing approval — implement autonomously, merge to main).
**Builds on:** everything merged to `main` (incl. the user/codex WIP savepoint commit).

## Goal

Collapse the app to **two purpose-built, ultra-readable views** and delete the rest:

1. **Overview** — the grouped container view (epics as boxes with nested story ▸ task ▸ subtask, cross-epic relationship links). "See the whole project and how epics connect."
2. **Spotlight** — a focused, pure-DOM "one ticket + its world" view: the clicked ticket is the hero, everything it touches is sorted into labeled lanes, click to re-center. Zero overlap, ever.

Delete **Graph (free node-graph), Tree, and Timeline** modes and their code. Fix the bugs hit along the way (project-untoggle empty boxes, arrows clipping cards, broken minimap drag, missing mode tooltips). A frontend-design pass on Spotlight + Overview cards.

No new runtime dependencies.

## 1. State model (`graphReducer.ts`)

Target `GraphState` (remove what's no longer used):

```ts
type ViewMode = 'overview' | 'spotlight';   // was graph|grouped|tree|timeline
interface GraphState {
  viewMode: ViewMode;            // default 'overview'
  focusKey: string | null;       // the Spotlight hero
  focusHistory: string[];        // breadcrumb trail (for Back)
  groupDepth: 1 | 2 | 3 | 4;     // Overview nesting depth (default 4)
  collapsed: Set<string>;        // Overview container collapse
  hiddenTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  hiddenProjects: Set<string>;
  hiddenAssignees: Set<string>;
  hiddenRelations: Set<string>;
  search: string;                // Overview highlight
  selectedKey: string | null;    // Overview highlight
  selectedEdge: { id; x; y; srcKey; tgtKey; relation; label } | null; // EdgePopup (kept)
}
```

**Removed fields:** `mode` (map/focus), `depth` (focus neighborhood), `layout` (graph layouts), `nodePopup` (Spotlight replaces the click-popup).

**Actions:**
- `openSpotlight(key)` → `viewMode:'spotlight'`, push current `focusKey` (if any & different) onto `focusHistory`, `focusKey:key`, `selectedKey:key`, clear `selectedEdge`.
- `spotlightBack()` → pop `focusHistory`; if a key remains, `focusKey:that`; if empty, `viewMode:'overview'`.
- `setViewMode(mode)` → set viewMode (Overview button → 'overview', keep focusKey for re-entry).
- Keep: `setGroupDepth`, `toggleCollapsed`, `toggleType/Status/Project/Assignee/Relation`, `setSearch`, `select`, `selectEdge`/`clearEdge`.
- **Removed actions:** `setMode`, `setDepth`, `setLayout`, `setFocus` (replaced by `openSpotlight`), `openNode`/`closeNode`.

Tests touching `groupDepth` default, removed fields/actions, and `viewMode` values are updated accordingly.

## 2. Spotlight relationship grouping (pure, tested) — `src/graph/spotlight.ts`

```ts
export interface SpotlightModel {
  hero: GraphNode;
  epic?: GraphNode;          // resolved from hero.epicKey
  parent?: GraphNode;        // direct hierarchy parent (when not the epic)
  children: GraphNode[];     // hierarchy children (tasks/subtasks under hero)
  blocks: GraphNode[];       // outward 'blocks'
  blockedBy: GraphNode[];    // inward 'blocks'
  relates: GraphNode[];      // 'relates' either direction
  other: { relation: string; label: string; node: GraphNode; outward: boolean }[]; // duplicates/clones/etc
}
export function spotlightModel(graph: Graph, focusKey: string): SpotlightModel | null;
```
Built from `graph.edges` (hierarchy + link) and `hero.epicKey`. Deduped; a node never appears in two lanes (priority: epic > parent > children > blocks/blockedBy > relates > other). Returns null if the hero key isn't in the graph.

## 3. Spotlight view (`src/components/SpotlightView.tsx` — pure DOM)

- **Layout:** a CSS grid — hero centered; **Epic / Parent** lane above; **Subtasks / Children** below; **Blocked by** left; **Blocks** right; **Relates** + **Other** in a row beneath. Empty lanes are omitted. Lanes scroll if long. Thin connector accents from hero to each lane (decorative, CSS/SVG — no routing engine).
- **Hero card:** key, summary, type · priority, status pill, assignee, story points, epic badge, and the flattened `description`. An "Open in Jira ↗" link.
- **Related cards:** compact (key + summary + status dot + type accent), color-coded by relationship lane; clicking dispatches `openSpotlight(otherKey)` to re-center.
- **Breadcrumb bar (top):** the `focusHistory` trail (clickable to jump), a **← Back** button (`spotlightBack`), and an **Overview** button (`setViewMode('overview')`).
- Respects theme tokens; built with the **frontend-design** skill for a polished, calm, readable result.
- Pure DOM → no obstacle routing, no overlap. Filters (project/assignee/etc.) do NOT prune Spotlight lanes (you explicitly chose this ticket), but a hidden relation type can still hide that lane (consistent with the legend).

## 4. Overview (kept = grouped) + fixes

- Becomes the default view and the entry point. Clicking a ticket → `openSpotlight(key)`. Container header click → collapse (unchanged).
- **Fix empty boxes on project/assignee untoggle:** apply `filterGroupingForState(grouping, state)` (already written) BEFORE `layoutGrouped`, so hidden-project containers are removed, not left empty. `GroupedCanvas` computes `grouping = filterGroupingForState(groupGraph(graph, depth), state)` then lays that out.
- **Fix arrows clipping cards:** obstacle rects use real rendered sizes — containers use `data.width/height`; member tickets use `GROUP.CHIP_W × GROUP.CHIP_H`; keep `EDGE_OBSTACLE_PADDING`. (The big offender — the free graph mode with mismatched 210×108 cards — is being deleted.)
- **Fix minimap drag:** replace the custom `CanvasChrome`/`TicketMiniMap` with React Flow's **built-in** `<MiniMap>` + `<Controls>`, themed via the existing CSS token overrides. The built-in minimap tracks the cursor correctly. (Removes the custom-minimap complexity.)
- Cross-epic relationship links remain drawn (so "epics linked together" is visible). `RoutedEdge` + `routing.ts` are kept for these.

## 5. Sidebar (`Sidebar.tsx`) — simplified

- Mode nav becomes **Overview / Spotlight** (with hover `title` tooltips). Spotlight is enabled only when a `focusKey` exists; otherwise it's a hint ("click a ticket to spotlight it").
- **Remove:** the layout switcher (graph layouts gone) and the focus-mode depth slider. **Keep:** the Overview **group-depth** control (Epic/Story/Task/Subtask), Focus-a-ticket typeahead (now opens Spotlight), Search, Projects/Assignees/Types filters, Relationships legend, dataset picker, theme toggle.
- Typeahead selecting a ticket → `openSpotlight(key)`.

## 6. Deletions (the "complexity" removed)

- Components: `GraphCanvas.tsx`, `TreeView.tsx`, `TimelineView.tsx`, `NodePopup.tsx`, `CanvasChrome.tsx`.
- Graph logic: `flow-elements.ts` (+test), `tree.ts` (+test), `timeline.ts` (+test), `layouts/hierarchical.ts` (+test), `layouts/force.ts` (+test), `layouts/hybrid.ts` (+test), `layouts/shared.ts`, `layouts/index.ts` (the registry + `LayoutKind`). `layouts/grouped.ts`, `layouts/types.ts` STAY (Overview uses them).
- CSS: `tree.css`, `timeline.css`, `node-popup.css` removed; their imports cleaned.
- `node-dimensions.ts` STAYS (used for Overview obstacle sizes). `routing.ts`, `RoutedEdge.tsx`, `grouped-elements.ts`, `GroupedCanvas.tsx`, `relation-colors.ts`, `relationships.ts`, `visible.ts`, `EdgePopup.tsx` STAY.

## 7. Components & files (new / changed / removed)

```
src/graph/spotlight.ts          NEW  pure relationship grouping (tested)
src/components/SpotlightView.tsx NEW  pure-DOM spotlight (frontend-design)
src/components/spotlight.css     NEW
src/state/graphReducer.ts        MOD  viewMode overview/spotlight, focusHistory, openSpotlight/spotlightBack; remove mode/depth/layout/nodePopup + their actions
src/components/GroupedCanvas.tsx MOD  filterGroupingForState before layout; built-in MiniMap+Controls; node click → openSpotlight; obstacle real sizes
src/components/Sidebar.tsx       MOD  Overview/Spotlight nav + tooltips; remove layout switcher + focus depth; typeahead → openSpotlight
src/components/TicketTypeahead.tsx MOD dispatch openSpotlight
src/App.tsx                      MOD  render Overview vs Spotlight by viewMode; remove Graph/Tree/Timeline/NodePopup; keep EdgePopup
src/graph/grouped-elements.ts    MOD  node click → openSpotlight wiring stays via canvas; (no logic change beyond filter already present)
REMOVE: GraphCanvas, TreeView, TimelineView, NodePopup, CanvasChrome, flow-elements(.ts/.test),
        tree(.ts/.test), timeline(.ts/.test), layouts/{hierarchical,force,hybrid}(.ts/.test),
        layouts/shared.ts, layouts/index.ts, tree.css, timeline.css, node-popup.css
```

## 8. Testing

Pure/tested: `spotlightModel` (correct lane assignment incl. epic/parent/children/blocks/blockedBy/relates, dedup, null on missing); reducer (`openSpotlight` pushes history + sets focus/view, `spotlightBack` pops to prior then to overview, removed-field defaults). The grouped filter fix is covered by a `filterGroupingForState`-applied test (containers for a hidden project are dropped). The Spotlight/Overview visual layer + minimap drag + tooltips are verified by running the app in both themes. Removing the deleted modules' tests is expected; total test count will shift.

## 9. Out of scope (YAGNI)

Editing · saving views · multi-ticket spotlight · animated lane transitions beyond a simple fade · re-adding the removed modes. Routing remains only for Overview's cross-epic links.
