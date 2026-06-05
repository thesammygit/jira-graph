# jira-graph

An interactive Jira relationship visualizer built as a static SPA (Vite + React 19 + TypeScript). It serves a dual purpose: a polished portfolio piece now — fully functional with bundled mock fixtures that exercise v2/v3 API differences — and a plug-in-ready visualization engine for real Jira at work later. Swapping in live data requires only replacing the data provider; the entire graph layer is untouched.

---

## Screenshot

![jira-graph in action](docs/screenshot.png)

> To regenerate: run the app locally (`npm run dev`), configure the dataset you want, and take a screenshot.

---

## Features

- **Whole-project map ⇄ focus mode** — toggle between a full overview and a focused view centred on a single ticket.
- **Depth slider** — controls the neighborhood radius in focus mode (how many hops out from the focal node to render).
- **Three hand-rolled layouts** — Hierarchical (top-down tree), Force (physics-style spring), and Hybrid (hierarchical spine + force leaf clusters), selectable at runtime.
- **Type / status / edge filters** — show or hide nodes and edges by issue type, status, and relationship kind.
- **Search** — filter nodes by key or summary text in real time.
- **Rich ticket nodes** — each node shows the issue key, summary, type icon, status badge, and assignee.
- **Detail panel** — click any node to open a side panel with full description (ADF rich text rendered as plain paragraphs), linked tickets, and metadata.
- **Jira v2 / v3 + Epic Link compatibility** — normalizer handles `fields.parent` (Cloud v3) and the legacy "Epic Link" custom field (Server v2), detected at runtime by field name. When Epic Link is absent the epic edges simply disappear — no errors, no broken UI.

---

## View modes

Four switchable views, all rendered from the same normalized graph, so big projects stay legible. Switch between them in the toolbar.

- **Graph** — the free-form relationship graph (hierarchical / force / hybrid layouts, depth slider, filters, search).
- **Grouped** — tickets collapse into nested **container blocks** (epic ▸ story ▸ task, depth selectable 1–3). Each container is collapsible; cross-container links are drawn ticket-to-ticket. The clearest view for "what's in this epic and how epics connect."

  ![Grouped mode](docs/screenshot-grouped.png)

- **Tree** — a compact collapsible outline with inline relationship badges (⛔ blocks, ↔ relates) you can click to jump. The densest view for very large projects.

  ![Tree mode](docs/screenshot-tree.png)

- **Timeline** — a Gantt view: bars on a date axis grouped by epic, `blocks` dependencies drawn as arrows. Needs a time dimension, so the normalizer also reads optional `startDate` / `dueDate` / `sprint` from Jira (`fields.duedate` and the Sprint custom field, feature-detected by name; synthesized into the mock fixtures). When a dataset has no dates the mode shows a friendly empty state.

  ![Timeline mode](docs/screenshot-timeline.png)

Design spec: [`docs/superpowers/specs/2026-06-05-jira-graph-view-modes-design.md`](docs/superpowers/specs/2026-06-05-jira-graph-view-modes-design.md) · Plan: [`docs/superpowers/plans/2026-06-05-jira-graph-view-modes.md`](docs/superpowers/plans/2026-06-05-jira-graph-view-modes.md)

---

## Architecture

The visualization knows nothing about Jira. It consumes a single normalized `{ nodes, edges }` model; a `DataProvider` seam is the only coupling point.

```
┌────────────────────────────────────────────────┐
│  DataProvider (interface)                       │
│   ├── MockProvider   ← bundled fixtures (now)   │
│   └── JiraProvider  ← live Jira REST (later)    │
│         └── shared normalize()                  │
│               ├── absorbs v2 / v3 differences   │
│               ├── ADF → plain text (adf.ts)     │
│               └── Epic Link feature detection   │
└────────────────────────┬───────────────────────┘
                         │ NormalizedGraph
                         ▼
┌────────────────────────────────────────────────┐
│  Graph layer (knows nothing about Jira)         │
│   ├── depth.ts      — neighborhood expansion   │
│   ├── layouts/      — hierarchical/force/hybrid │
│   ├── flow-elements.ts — React Flow node/edge   │
│   └── graphReducer  — all interaction state     │
└────────────────────────┬───────────────────────┘
                         │ React Flow nodes/edges
                         ▼
┌────────────────────────────────────────────────┐
│  React UI (GraphCanvas, Toolbar, DetailPanel,  │
│            TicketNode)                          │
└────────────────────────────────────────────────┘
```

Design spec: [`docs/superpowers/specs/2026-06-04-jira-graph-design.md`](docs/superpowers/specs/2026-06-04-jira-graph-design.md)  
Implementation plan: [`docs/superpowers/plans/2026-06-04-jira-graph.md`](docs/superpowers/plans/2026-06-04-jira-graph.md)

---

## Dependencies & supply-chain hygiene

### Runtime dependencies

| Package | Exact version | Why it's trusted |
|---|---|---|
| `react` | `19.2.7` | Meta-maintained; the de-facto standard React runtime. Audited weekly download count in the hundreds of millions. |
| `react-dom` | `19.2.7` | Same maintainer and release cadence as `react`; necessary companion. |
| `@xyflow/react` | `12.11.0` | The canonical React Flow v12 library. Transitive tree is essentially the d3 interaction modules (d3-drag, d3-zoom, d3-selection) — small, well-understood, widely audited. |

All layout algorithms (hierarchical, force, hybrid), application state management, and graph traversal are **hand-rolled with zero additional runtime dependencies**. This minimal, deliberately-vetted dependency surface is intentional for a security-reviewed work environment.

### Hygiene practices

- **Pinned exact versions + committed lockfile** — `package.json` records exact versions (no `^`/`~` ranges); `package-lock.json` is committed so CI and local installs are byte-for-byte identical.
- **`npm ci --ignore-scripts`** — CI (and recommended local installs) use `npm ci` to respect the lockfile exactly and `--ignore-scripts` to block lifecycle-script execution from transitive dependencies.
- **`npm audit` in CI** — the deploy workflow runs `npm audit --audit-level=high`, so any high/critical advisory fails the build.
- **Vet each dep on add** — before adding any new dependency: review the maintainer, weekly download count, transitive dependency tree, and time since last publish. Prefer hand-rolling small utilities over pulling in a new package.

---

## Run locally

```bash
npm install        # install dependencies from lockfile
npm run dev        # start Vite dev server (http://localhost:5173)
npm test           # run Vitest unit tests (70 tests)
npm run build      # type-check + Vite production build → dist/
```

The build emits `dist/` with relative asset paths (`base: './'`) so it can be served from any subdirectory, including GitHub Pages.

---

## Using real Jira at work

Open [`src/providers/JiraProvider.ts`](src/providers/JiraProvider.ts).

The skeleton provider:

- Shares the same `normalize()` function as `MockProvider` — Jira API shape differences are absorbed there, not in the provider.
- Detects whether the instance exposes an "Epic Link" custom field (older Server/Data Center) by calling `/rest/api/3/field` and scanning field names — no hardcoded custom field IDs. (Pointing at a v2 instance means swapping the version in the field/search paths; the normalizer already handles both shapes.)
- Fetches issues from `/rest/api/3/search/jql`. The current skeleton does a single un-paginated request (`fields=*all`); token-based pagination is marked `TODO(work)` in the file and is the one piece to finish against a live instance.
- Requires a thin auth/CORS proxy to attach credentials and forward requests (out of scope for the public demo).

The data provider is the **only** thing that changes when connecting to a live instance. The entire visualization layer — layouts, filters, depth expansion, state machine, React components — is untouched.

---

## Project structure

```
src/
├── core/
│   ├── model.ts              — TypeScript types (NormalizedGraph, TicketNode, TicketEdge, …)
│   ├── normalize.ts          — v2/v3 normalizer: parent field, Epic Link, issue links, ADF
│   ├── adf.ts                — Atlassian Document Format → plain text extractor
│   └── jira-fields.ts        — field-name helpers for Epic Link detection
├── providers/
│   ├── DataProvider.ts       — DataProvider interface
│   ├── MockProvider.ts       — normalizes bundled fixtures (dataset picker: v3/v2/no-epic)
│   └── JiraProvider.ts       — live Jira skeleton (shares normalize(); pagination is TODO)
├── fixtures/
│   ├── v3.ts                 — Cloud v3 sample payload (parent field)
│   └── v2.ts                 — Server v2 sample payload (Epic Link custom field)
├── graph/
│   ├── depth.ts              — BFS neighborhood expansion for focus mode
│   ├── flow-elements.ts      — maps NormalizedGraph → React Flow nodes/edges
│   ├── grouping.ts           — containment grouping by depth (grouped mode)
│   ├── grouped-elements.ts   — grouping → React Flow compound nodes/edges
│   ├── tree.ts               — graph → collapsible tree rows + badges (tree mode)
│   ├── timeline.ts           — dated nodes → Gantt geometry (timeline mode)
│   ├── layouts/
│   │   ├── hierarchical.ts   — top-down tree layout
│   │   ├── force.ts          — spring/repulsion force layout
│   │   ├── hybrid.ts         — hierarchical spine + force leaf clusters
│   │   ├── grouped.ts        — nested container layout (grouped mode)
│   │   ├── shared.ts         — shared layout utilities
│   │   ├── types.ts          — layout type definitions
│   │   └── index.ts          — layout registry / selector
│   └── (*.test.ts files alongside each module)
├── state/
│   └── graphReducer.ts       — useReducer state machine (incl. viewMode/groupDepth/collapsed)
└── components/
    ├── GraphCanvas.tsx        — React Flow canvas wrapper (graph mode)
    ├── GroupedCanvas.tsx      — nested container view (grouped mode)
    ├── ContainerNode.tsx      — grouped container node
    ├── TreeView.tsx           — collapsible outline (tree mode)
    ├── TimelineView.tsx       — Gantt view (timeline mode)
    ├── ViewModeSwitch.tsx     — graph/grouped/tree/timeline + depth control
    ├── Toolbar.tsx            — layout picker, filters, depth slider, search, mode toggle
    ├── TicketNode.tsx         — custom React Flow node (full + compact variants)
    └── DetailPanel.tsx        — side panel: description, links, metadata
```

---

## Testing

The pure-logic core — `normalize` (incl. date fields), depth expansion, all layouts, grouping, tree building, timeline geometry, `MockProvider`, `graphReducer`, `flow-elements`, and `grouped-elements` — is covered by **70 Vitest unit tests**. Tests run in Node (no browser required) and complete in under a second.

The thin React layer (component rendering, user interactions, visual output) is verified by running the app: `npm run dev` spins up the full SPA against the bundled fixtures, and `npm run build` confirms the production bundle compiles and tree-shakes cleanly.
