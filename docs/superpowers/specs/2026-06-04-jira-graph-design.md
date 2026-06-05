# Jira Relationship Visualizer — Design Spec

**Date:** 2026-06-04
**Status:** Approved design, pending implementation plan
**Working name:** `jira-graph`

## 1. Overview & goals

An interactive web tool that visualizes Jira tickets and the relationships between
them (hierarchy + issue links) as a graph. Two audiences:

1. **Now — portfolio piece.** Runs on a personal machine with **no Jira instance**,
   driven by realistic test data. Deployable as a static site (GitHub Pages) to show off.
2. **Later — internal work tool.** The same visualization, pointed at a real Jira
   instance (a secure corporate environment) by swapping the data source. No changes
   to the visualization layer.

The architecture's whole point is that **the data source and the visualization are
fully decoupled**, so the swap from test data to live Jira touches one module.

## 2. Constraints

- **No live Jira now** → prove the concept with test data shaped exactly like the API.
- **API v2 *and* v3 compatible** → the normalization layer absorbs the differences
  (see §5). Must also tolerate older Server/Data Center instances.
- **Epic Link compatibility** → support the legacy "Epic Link" custom field when it
  exists (the user's work instance has it), and gracefully render nothing for it when
  it doesn't. Resolve it **by field name**, never a hardcoded custom-field ID.
- **Minimal, trusted dependencies** → recent npm supply-chain incidents + a secure
  work environment mean we hand-roll what we reasonably can and only pull
  extremely-trusted packages. See §9.
- **Configurable relationship depth** → graphs get messy fast; a focus ticket + depth
  limit is the primary scale control (see §7).

## 3. Architecture — the provider seam

```
┌─────────────────────────────────────────────────────────┐
│  Visualization (React + React Flow)                       │
│  Knows nothing about Jira. Consumes the normalized model. │
└────────────────────────────┬──────────────────────────────┘
                            │   { nodes: GraphNode[], edges: GraphEdge[] }
┌────────────────────────────┴──────────────────────────────┐
│  DataProvider interface (§6)                               │
│    ├─ MockProvider   ← now:   raw-API-shaped JSON fixtures │
│    └─ JiraProvider   ← later: live /rest/api/{2,3} (+proxy)│
└────────────────────────────┬──────────────────────────────┘
                            │   raw Jira issue JSON
                  core/normalize.ts   (shared by BOTH providers)
```

**Key decision:** mock fixtures are stored in **real Jira-API JSON shape**, and *both*
providers run their raw issues through the **same `normalize()` function**. Benefits:

- The normalizer is exercised against realistic data from day one.
- Switching to live Jira is just changing the fetch source; normalization is already proven.
- The fixtures double as documentation of the API shapes we support.

**Hosting:** static SPA, no backend, deployable to GitHub Pages. At work, `JiraProvider`
sits behind a thin reverse proxy (out of scope here) that handles auth/CORS.

## 4. The normalized model (the contract)

```ts
type StatusCategory = 'todo' | 'inprogress' | 'done';

interface GraphNode {
  id: string;            // issue key, e.g. "BUG-40" — stable graph id
  key: string;           // same as id, explicit for clarity
  summary: string;
  type: { name: string; kind: IssueKind };   // Epic | Story | Task | Subtask | Bug | ...
  status: { name: string; category: StatusCategory };
  priority?: string;
  assignee?: { displayName: string; initials: string; avatarUrl?: string };
  storyPoints?: number;
  hierarchyLevel: number; // epic=2, story/task=1, subtask=0 — drives layout
  url: string;            // "open in Jira" deep link
  raw: unknown;           // original API object — escape hatch, nothing lost
}

interface GraphEdge {
  id: string;
  source: string;         // node id
  target: string;         // node id
  kind: 'hierarchy' | 'link';
  relation: string;       // hierarchy: 'epic'|'parent'|'subtask'
                          // link: link-type name, e.g. 'blocks','relates','duplicates'
  label: string;          // human text, e.g. "blocks", "is blocked by", "parent"
  directed: boolean;      // hierarchy + blocks/duplicates = true; relates = false
  raw: unknown;
}
```

Every API quirk collapses into these two shapes. The visualization only ever sees these.

## 5. How `normalize()` absorbs API variation

`normalize(rawIssue, capabilities) → { node: GraphNode, edges: GraphEdge[] }`

- **Rich text (v2 vs v3):** v3 returns description/comments as **ADF** (a JSON document
  tree); v2 returns plain/wiki strings. The normalizer flattens both to display text.
  (For the graph we mostly need summary/status/type/links, so ADF handling is shallow.)
- **Hierarchy:**
  - Reads `fields.parent` (the modern unified field) → emits `epic` / `parent` /
    `subtask` edges based on the parent's and child's types.
  - **Feature-detects "Epic Link":** at startup the provider fetches field metadata
    (`/rest/api/2/field`); if a field named "Epic Link" exists, resolve its
    `customfield_xxxxx` id **by name** and emit `epic` edges from it. If absent, emit
    nothing — the graph simply lacks those edges. No errors, no empty states.
- **Issue links:** `fields.issuelinks[]` → one `link` edge per entry, carrying the
  type name and inward/outward direction (blocks, relates, duplicates, clones, …).
- **Search & pagination:** the provider abstracts the deprecated `/search` endpoints
  vs the newer `/search/jql` token-based pagination, so callers never see the difference.

A `capabilities` object (`{ apiVersion, hasEpicLink, epicLinkFieldId, … }`) is produced
once via feature detection and threaded into normalization.

## 6. Provider interface

```ts
interface DataProvider {
  capabilities(): Promise<Capabilities>;              // feature detection
  getGraph(opts?): Promise<Graph>;                    // whole-project map
  getNeighborhood(focusKey, depth, opts?): Promise<Graph>; // focus + expand
  search(query: string): Promise<NodeSummary[]>;      // search box
}
```

- **MockProvider** — loads bundled raw-API-shaped fixtures, runs them through
  `normalize()`, and simulates `getNeighborhood` by BFS over the edge set to `depth`,
  plus fake pagination. Exposes a flag to simulate **"Epic Link absent"** so graceful
  degradation is demonstrable live.
- **JiraProvider** (skeleton now, wired at work) — same surface, real `fetch` against
  `/rest/api/2` or `/rest/api/3`, same `normalize()`, real pagination.

## 7. Visualization features (v1)

- **Two modes:** whole-project **map** ⇄ **focus mode** (choose a ticket).
- **Depth slider (1–N):** caps neighborhood radius from the focus ticket. The primary
  scale/clutter control; applies in every layout.
- **Layout toggle** — three layouts over the *same* normalized graph (positions are a
  pure function of nodes+edges, animated on switch):
  - **Hierarchical** — rows by `hierarchyLevel`, parent edges top-down, links cross.
  - **Force** — focus-centered organic spring layout.
  - **Hybrid** — hierarchical backbone + emphasized, distinctly-styled cross-links. (default)
- **Filters:** by issue type, status category, and edge/link type (toggle
  blocks / relates / hierarchy visibility independently).
- **Search:** by key or summary → highlight + optionally set as focus.
- **Rich card nodes:** key, type+priority, summary, status pill, assignee avatar,
  story points, inline link summary.
- **Edge legend:** gray arrow = hierarchy, red arrow = blocks (directed), blue dashed =
  relates (undirected).
- **Detail panel:** click a node → full fields, link list, "open in Jira" link.

## 8. Mock data design

A believable mini-project so relationships look real:

- **"Checkout revamp"** epic → stories (Cart page, Payment form) → tasks → subtasks.
- A couple of **bugs** that **block** stories.
- A **dependency chain** (A blocks B blocks C …) to demo the depth slider.
- Cross-epic **relates** links.
- A **second epic** to show multi-epic structure.
- ~25–40 tickets total.

Shipped as **two fixture sets** so the normalizer is exercised both ways:

- **v3 set** — `fields.parent` + ADF description bodies.
- **v2 set** — legacy "Epic Link" custom field + plain-string descriptions.

Plus a capability flag to simulate an instance **without** Epic Link.

## 9. Rendering stack & dependency policy

**Decision:** React Flow for rendering/interaction (pan/zoom, node rendering, edge
routing); **everything else hand-rolled.**

**Runtime dependencies (direct):**

| Package         | Why                                   | Trust notes |
|-----------------|---------------------------------------|-------------|
| `react`         | UI framework                          | Meta, ubiquitous |
| `react-dom`     | DOM renderer                          | Meta, ubiquitous |
| `@xyflow/react` | graph canvas: pan/zoom, HTML nodes, edge routing | xyflow org, MIT, millions of weekly downloads; transitive tree is essentially the d3 interaction modules (d3-zoom/drag/selection — d3 org) |

**Dev dependencies:** `vite`, `typescript`, `@vitejs/plugin-react`, `@types/react`,
`@types/react-dom`.

**Hand-rolled (zero deps):**

- **Layout algorithms** (`graph/layouts/`):
  - *Hierarchical* — layer by `hierarchyLevel`; order within layers by a barycenter
    pass to reduce edge crossings; pack horizontally.
  - *Force* — a small spring/repulsion sim (naive O(n²) is fine; depth-limiting keeps
    n small).
  - *Hybrid* — hierarchical backbone with link edges offset/styled distinctly.
- **State** — React `useReducer` / context. No external state library.

**Supply-chain hygiene (documented for work security review):**

- Pin exact versions; commit the lockfile.
- Install with `npm ci --ignore-scripts`; run `npm audit` in CI.
- Vet each dep on add: maintainer, weekly downloads, transitive tree, last publish.

## 10. Project structure (proposed)

```
jira-graph/
  src/
    core/
      model.ts          # GraphNode / GraphEdge types
      normalize.ts      # raw Jira issue -> normalized node + edges (v2/v3, epic link)
      adf.ts            # ADF -> text flattening
    providers/
      DataProvider.ts   # interface
      MockProvider.ts
      JiraProvider.ts   # skeleton for work
    fixtures/
      v3/ ...           # raw-API-shaped issues (parent + ADF)
      v2/ ...           # raw-API-shaped issues (Epic Link custom field)
    graph/
      layouts/
        hierarchical.ts
        force.ts
        hybrid.ts
      depth.ts          # BFS neighborhood to depth N
    components/
      GraphCanvas.tsx   # React Flow wrapper
      TicketNode.tsx    # rich card node
      Toolbar.tsx       # mode, depth slider, layout toggle, filters, search
      DetailPanel.tsx
    state/
      graphReducer.ts
    App.tsx
  docs/superpowers/specs/2026-06-04-jira-graph-design.md
```

## 11. Out of scope (v1, YAGNI)

Editing/writing to Jira · auth UI / OAuth (the work proxy handles auth later) ·
remote links (Confluence et al.) · real-time updates / websockets · multiple
simultaneous instances · persistence beyond URL state. The architecture leaves room
for each.

## 12. Future / open

- **Work proxy:** thin server fronting `JiraProvider` for auth + CORS (separate effort).
- **Higher hierarchy levels:** some instances have levels above Epic (Initiative, etc.);
  `hierarchyLevel` is a number specifically so this extends cleanly.
- **Portfolio polish:** sample-data picker, shareable URL state, light/dark theme.
