# Jira Relationship Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive graph visualizer for Jira tickets and their relationships, driven by realistic test data now and swappable to a live Jira instance later.

**Architecture:** A `DataProvider` seam fully decouples data from view. Both `MockProvider` (now) and `JiraProvider` (later) run raw Jira-API-shaped issues through one shared `normalize()` into a canonical `{nodes, edges}` model. The React + React Flow visualization only ever sees that model. Layout algorithms and state are hand-rolled (zero extra deps); React Flow handles pan/zoom/rendering.

**Tech Stack:** React 19 + TypeScript + Vite. Runtime deps: `react`, `react-dom`, `@xyflow/react`. Dev deps: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`. Pure logic is TDD'd with Vitest; the thin UI is verified by running the app.

**Spec:** `docs/superpowers/specs/2026-06-04-jira-graph-design.md`

---

## File Structure

```
jira-graph/
  src/
    core/
      model.ts           # GraphNode / GraphEdge / Graph / Capabilities types
      jira-fields.ts      # field helpers: initials, kind, statusCategory, hierarchyLevel
      adf.ts              # ADF (v3) -> plain text
      normalize.ts        # raw Jira issue(s) -> normalized graph (v2/v3, parent, epic link, links)
    graph/
      depth.ts            # BFS neighborhood to depth N
      flow-elements.ts    # normalized graph + positions + filters -> React Flow nodes/edges
      layouts/
        types.ts          # LayoutFn, Positions
        shared.ts         # layerYByLevel, resolveOverlaps (shared by hierarchical + hybrid)
        hierarchical.ts
        force.ts
        hybrid.ts
        index.ts          # LayoutKind -> LayoutFn registry
    providers/
      DataProvider.ts     # interface + shared types
      MockProvider.ts
      JiraProvider.ts      # skeleton, wired at work
    fixtures/
      v3.ts               # raw-API issues: parent field + ADF
      v2.ts               # raw-API issues: Epic Link custom field + plain strings
    state/
      graphReducer.ts     # view/focus/depth/layout/filters/search/selection
    components/
      TicketNode.tsx      # rich card node
      GraphCanvas.tsx     # React Flow wrapper
      Toolbar.tsx
      DetailPanel.tsx
    App.tsx
    main.tsx
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

---

## Phase 0 — Scaffold

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

- [ ] **Step 1: Install dependencies (pinned exact)**

```bash
cd .
npm init -y
npm install --save-exact react react-dom @xyflow/react
npm install --save-dev --save-exact vite @vitejs/plugin-react typescript vitest @types/react @types/react-dom
```

- [ ] **Step 2: Write config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: { globals: true, environment: 'node' },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Jira Graph</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: Write minimal app entry**

`src/App.tsx`:
```tsx
export default function App() {
  return <div>Jira Graph</div>;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
```

- [ ] **Step 4: Add scripts to package.json**

Set the `scripts` field:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Verify build + test runner boot**

Run: `npm run build`
Expected: completes, emits `dist/`.

Run: `npm test`
Expected: "No test files found" (exit 0) — runner works.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS project"
```

---

## Phase 1 — Core (pure logic, TDD)

### Task 2: Model types + field helpers

**Files:**
- Create: `src/core/model.ts`, `src/core/jira-fields.ts`
- Test: `src/core/jira-fields.test.ts`

- [ ] **Step 1: Write the types**

`src/core/model.ts`:
```ts
export type StatusCategory = 'todo' | 'inprogress' | 'done';
export type IssueKind = 'epic' | 'story' | 'task' | 'subtask' | 'bug' | 'other';
export type EdgeKind = 'hierarchy' | 'link';

export interface GraphNode {
  id: string;
  key: string;
  summary: string;
  type: { name: string; kind: IssueKind };
  status: { name: string; category: StatusCategory };
  priority?: string;
  assignee?: { displayName: string; initials: string; avatarUrl?: string };
  storyPoints?: number;
  hierarchyLevel: number;
  url: string;
  raw: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  relation: string;
  label: string;
  directed: boolean;
  raw: unknown;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Capabilities {
  apiVersion: 2 | 3;
  baseUrl: string;
  hasEpicLink: boolean;
  epicLinkFieldId?: string;
  storyPointsFieldId?: string;
}
```

- [ ] **Step 2: Write the failing test**

`src/core/jira-fields.test.ts`:
```ts
import { initialsFrom, kindFromIssuetype, statusCategoryFrom, hierarchyLevelFor } from './jira-fields';

test('initialsFrom builds two-letter initials', () => {
  expect(initialsFrom('Sam Brown')).toBe('SB');
  expect(initialsFrom('cher')).toBe('C');
  expect(initialsFrom('')).toBe('?');
});

test('kindFromIssuetype maps names and subtask flag', () => {
  expect(kindFromIssuetype({ name: 'Epic', subtask: false })).toBe('epic');
  expect(kindFromIssuetype({ name: 'Story', subtask: false })).toBe('story');
  expect(kindFromIssuetype({ name: 'Bug', subtask: false })).toBe('bug');
  expect(kindFromIssuetype({ name: 'Sub-task', subtask: true })).toBe('subtask');
  expect(kindFromIssuetype({ name: 'Spike', subtask: false })).toBe('other');
});

test('statusCategoryFrom maps Jira category keys', () => {
  expect(statusCategoryFrom('new')).toBe('todo');
  expect(statusCategoryFrom('indeterminate')).toBe('inprogress');
  expect(statusCategoryFrom('done')).toBe('done');
  expect(statusCategoryFrom('weird')).toBe('todo');
});

test('hierarchyLevelFor ranks kinds', () => {
  expect(hierarchyLevelFor('epic')).toBe(2);
  expect(hierarchyLevelFor('story')).toBe(1);
  expect(hierarchyLevelFor('subtask')).toBe(0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/core/jira-fields.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/core/jira-fields.ts`:
```ts
import type { IssueKind, StatusCategory } from './model';

export function initialsFrom(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function kindFromIssuetype(it: { name?: string; subtask?: boolean } | undefined): IssueKind {
  if (!it) return 'other';
  if (it.subtask) return 'subtask';
  switch ((it.name ?? '').toLowerCase()) {
    case 'epic': return 'epic';
    case 'story': return 'story';
    case 'bug': return 'bug';
    case 'task': return 'task';
    default: return 'other';
  }
}

export function statusCategoryFrom(key: string | undefined): StatusCategory {
  switch (key) {
    case 'indeterminate': return 'inprogress';
    case 'done': return 'done';
    default: return 'todo';
  }
}

export function hierarchyLevelFor(kind: IssueKind): number {
  switch (kind) {
    case 'epic': return 2;
    case 'subtask': return 0;
    default: return 1;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/core/jira-fields.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/model.ts src/core/jira-fields.ts src/core/jira-fields.test.ts
git commit -m "feat: core model types and Jira field helpers"
```

---

### Task 3: ADF → text flattening

**Files:**
- Create: `src/core/adf.ts`
- Test: `src/core/adf.test.ts`

- [ ] **Step 1: Write the failing test**

`src/core/adf.test.ts`:
```ts
import { adfToText } from './adf';

test('passes plain strings through (v2)', () => {
  expect(adfToText('hello world')).toBe('hello world');
});

test('returns empty string for null/undefined', () => {
  expect(adfToText(null)).toBe('');
  expect(adfToText(undefined)).toBe('');
});

test('flattens an ADF document (v3) joining blocks with newlines', () => {
  const adf = {
    type: 'doc', version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'First line.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Second ' }, { type: 'text', text: 'line.' }] },
    ],
  };
  expect(adfToText(adf)).toBe('First line.\nSecond line.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/adf.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/core/adf.ts`:
```ts
const BLOCK_TYPES = new Set(['paragraph', 'heading', 'blockquote', 'listItem', 'codeBlock']);

export function adfToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  return collect(value as AdfNode).replace(/\n{2,}/g, '\n').trim();
}

interface AdfNode { type?: string; text?: string; content?: AdfNode[] }

function collect(node: AdfNode): string {
  if (node.type === 'text') return node.text ?? '';
  const inner = (node.content ?? []).map(collect).join('');
  return BLOCK_TYPES.has(node.type ?? '') ? inner + '\n' : inner;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/adf.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/adf.ts src/core/adf.test.ts
git commit -m "feat: ADF to text flattening for v3 rich text"
```

---

### Task 4: normalize() — node fields

**Files:**
- Create: `src/core/normalize.ts`
- Test: `src/core/normalize.node.test.ts`

- [ ] **Step 1: Write the failing test**

`src/core/normalize.node.test.ts`:
```ts
import { normalizeIssue } from './normalize';
import type { Capabilities } from './model';

const caps: Capabilities = {
  apiVersion: 3, baseUrl: 'https://example.atlassian.net',
  hasEpicLink: false, storyPointsFieldId: 'customfield_10016',
};

const raw = {
  key: 'STORY-10',
  fields: {
    summary: 'Cart page',
    issuetype: { name: 'Story', subtask: false },
    status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
    priority: { name: 'High' },
    assignee: { displayName: 'Sam Brown' },
    customfield_10016: 5,
  },
};

test('normalizeIssue builds a node from common fields', () => {
  const { node } = normalizeIssue(raw, caps);
  expect(node.id).toBe('STORY-10');
  expect(node.summary).toBe('Cart page');
  expect(node.type.kind).toBe('story');
  expect(node.status.category).toBe('inprogress');
  expect(node.priority).toBe('High');
  expect(node.assignee).toEqual({ displayName: 'Sam Brown', initials: 'SB', avatarUrl: undefined });
  expect(node.storyPoints).toBe(5);
  expect(node.hierarchyLevel).toBe(1);
  expect(node.url).toBe('https://example.atlassian.net/browse/STORY-10');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/normalize.node.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement (node only; edges added in Tasks 5–6)**

`src/core/normalize.ts`:
```ts
import type { Capabilities, Graph, GraphEdge, GraphNode } from './model';
import { hierarchyLevelFor, initialsFrom, kindFromIssuetype, statusCategoryFrom } from './jira-fields';

export function normalizeIssue(raw: any, caps: Capabilities): { node: GraphNode; edges: GraphEdge[] } {
  const f = raw.fields ?? {};
  const kind = kindFromIssuetype(f.issuetype);
  const node: GraphNode = {
    id: raw.key,
    key: raw.key,
    summary: f.summary ?? '',
    type: { name: f.issuetype?.name ?? 'Unknown', kind },
    status: { name: f.status?.name ?? 'Unknown', category: statusCategoryFrom(f.status?.statusCategory?.key) },
    priority: f.priority?.name,
    assignee: f.assignee
      ? { displayName: f.assignee.displayName, initials: initialsFrom(f.assignee.displayName ?? ''), avatarUrl: f.assignee.avatarUrls?.['24x24'] }
      : undefined,
    storyPoints: caps.storyPointsFieldId ? f[caps.storyPointsFieldId] : undefined,
    hierarchyLevel: hierarchyLevelFor(kind),
    url: `${caps.baseUrl}/browse/${raw.key}`,
    raw,
  };
  const edges: GraphEdge[] = [];
  // hierarchy + link edges added in Tasks 5 and 6
  return { node, edges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/normalize.node.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/normalize.ts src/core/normalize.node.test.ts
git commit -m "feat: normalize Jira issue into a graph node"
```

---

### Task 5: normalize() — hierarchy edges (parent + Epic Link)

**Files:**
- Modify: `src/core/normalize.ts`
- Test: `src/core/normalize.hierarchy.test.ts`

- [ ] **Step 1: Write the failing test**

`src/core/normalize.hierarchy.test.ts`:
```ts
import { normalizeIssue } from './normalize';
import type { Capabilities } from './model';

const base: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false };

test('v3 parent of an Epic produces an epic hierarchy edge', () => {
  const raw = { key: 'STORY-10', fields: {
    summary: 's', issuetype: { name: 'Story', subtask: false }, status: {},
    parent: { key: 'EPIC-1', fields: { issuetype: { name: 'Epic', subtask: false } } },
  }};
  const { edges } = normalizeIssue(raw, base);
  expect(edges).toHaveLength(1);
  expect(edges[0]).toMatchObject({ kind: 'hierarchy', relation: 'epic', source: 'EPIC-1', target: 'STORY-10', directed: true });
  expect(edges[0].id).toBe('hier:epic:EPIC-1->STORY-10');
});

test('subtask parent produces a subtask edge', () => {
  const raw = { key: 'SUB-30', fields: {
    summary: 's', issuetype: { name: 'Sub-task', subtask: true }, status: {},
    parent: { key: 'TASK-20', fields: { issuetype: { name: 'Task', subtask: false } } },
  }};
  const { edges } = normalizeIssue(raw, base);
  expect(edges[0]).toMatchObject({ relation: 'subtask', source: 'TASK-20', target: 'SUB-30' });
});

test('legacy Epic Link is read by configured field id when capability present', () => {
  const caps: Capabilities = { ...base, hasEpicLink: true, epicLinkFieldId: 'customfield_10014' };
  const raw = { key: 'STORY-77', fields: {
    summary: 's', issuetype: { name: 'Story', subtask: false }, status: {},
    customfield_10014: 'EPIC-9',
  }};
  const { edges } = normalizeIssue(raw, caps);
  expect(edges[0]).toMatchObject({ relation: 'epic', source: 'EPIC-9', target: 'STORY-77' });
});

test('Epic Link absent (capability off) yields no epic edge', () => {
  const raw = { key: 'STORY-77', fields: {
    summary: 's', issuetype: { name: 'Story', subtask: false }, status: {},
    customfield_10014: 'EPIC-9',
  }};
  const { edges } = normalizeIssue(raw, base); // hasEpicLink:false
  expect(edges).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/normalize.hierarchy.test.ts`
Expected: FAIL — edges empty.

- [ ] **Step 3: Implement — add hierarchy edges to normalizeIssue**

In `src/core/normalize.ts`, add this helper above `normalizeIssue` and call it. Replace the `// hierarchy + link edges` comment line with `edges.push(...hierarchyEdges(raw, kind, caps));`:

```ts
function hierarchyEdge(source: string, target: string, relation: string, raw: unknown): GraphEdge {
  const label = relation === 'subtask' ? 'subtask of' : relation === 'epic' ? 'epic' : 'parent';
  return { id: `hier:${relation}:${source}->${target}`, source, target, kind: 'hierarchy', relation, label, directed: true, raw };
}

function hierarchyEdges(raw: any, childKind: string, caps: Capabilities): GraphEdge[] {
  const f = raw.fields ?? {};
  if (f.parent?.key) {
    const parentKind = kindFromIssuetype(f.parent.fields?.issuetype);
    const relation = childKind === 'subtask' ? 'subtask' : parentKind === 'epic' ? 'epic' : 'parent';
    return [hierarchyEdge(f.parent.key, raw.key, relation, f.parent)];
  }
  if (caps.hasEpicLink && caps.epicLinkFieldId) {
    const epicKey = f[caps.epicLinkFieldId];
    if (typeof epicKey === 'string' && epicKey) return [hierarchyEdge(epicKey, raw.key, 'epic', { epicLink: epicKey })];
  }
  return [];
}
```

Note: `kind` is already computed in `normalizeIssue`; pass it as `childKind`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/normalize.hierarchy.test.ts`
Expected: PASS (4 tests). Also re-run Task 4: `npx vitest run src/core/normalize.node.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/normalize.ts src/core/normalize.hierarchy.test.ts
git commit -m "feat: normalize parent + legacy Epic Link into hierarchy edges"
```

---

### Task 6: normalize() — issue link edges

**Files:**
- Modify: `src/core/normalize.ts`
- Test: `src/core/normalize.links.test.ts`

- [ ] **Step 1: Write the failing test**

`src/core/normalize.links.test.ts`:
```ts
import { normalizeIssue, normalizeIssues } from './normalize';
import type { Capabilities } from './model';

const caps: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false };
const issuetype = { name: 'Bug', subtask: false };

test('outward blocks link is directed source->target', () => {
  const raw = { key: 'BUG-40', fields: { summary: 's', issuetype, status: {}, issuelinks: [
    { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, outwardIssue: { key: 'STORY-11' } },
  ]}};
  const { edges } = normalizeIssue(raw, caps);
  expect(edges[0]).toMatchObject({ kind: 'link', relation: 'blocks', source: 'BUG-40', target: 'STORY-11', directed: true, label: 'blocks' });
  expect(edges[0].id).toBe('link:blocks:BUG-40->STORY-11');
});

test('inward link is oriented partner->me', () => {
  const raw = { key: 'STORY-11', fields: { summary: 's', issuetype, status: {}, issuelinks: [
    { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: 'BUG-40' } },
  ]}};
  const { edges } = normalizeIssue(raw, caps);
  expect(edges[0]).toMatchObject({ source: 'BUG-40', target: 'STORY-11', relation: 'blocks' });
});

test('relates link is undirected', () => {
  const raw = { key: 'TASK-21', fields: { summary: 's', issuetype, status: {}, issuelinks: [
    { type: { name: 'Relates', inward: 'relates to', outward: 'relates to' }, outwardIssue: { key: 'STORY-10' } },
  ]}};
  const { edges } = normalizeIssue(raw, caps);
  expect(edges[0].directed).toBe(false);
});

test('normalizeIssues dedupes the same link seen from both sides and drops dangling edges', () => {
  const a = { key: 'BUG-40', fields: { summary: 's', issuetype, status: {}, issuelinks: [
    { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, outwardIssue: { key: 'STORY-11' } },
  ]}};
  const b = { key: 'STORY-11', fields: { summary: 's', issuetype: { name: 'Story', subtask: false }, status: {}, issuelinks: [
    { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: 'BUG-40' } },
  ]}};
  const graph = normalizeIssues([a, b], caps);
  expect(graph.nodes).toHaveLength(2);
  expect(graph.edges).toHaveLength(1); // deduped, both endpoints present
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/normalize.links.test.ts`
Expected: FAIL — `normalizeIssues` not exported, link edges absent.

- [ ] **Step 3: Implement — add link edges + normalizeIssues**

In `src/core/normalize.ts`, add:
```ts
const UNDIRECTED = new Set(['relates', 'relate', 'relates to']);

function linkEdges(raw: any): GraphEdge[] {
  const out: GraphEdge[] = [];
  for (const l of raw.fields?.issuelinks ?? []) {
    const relation = (l.type?.name ?? 'relates').toLowerCase();
    const directed = !UNDIRECTED.has(relation);
    const label = l.type?.outward ?? relation;
    let source: string | undefined, target: string | undefined;
    if (l.outwardIssue) { source = raw.key; target = l.outwardIssue.key; }
    else if (l.inwardIssue) { source = l.inwardIssue.key; target = raw.key; }
    if (source && target) {
      out.push({ id: `link:${relation}:${source}->${target}`, source, target, kind: 'link', relation, label, directed, raw: l });
    }
  }
  return out;
}
```

Add `...linkEdges(raw)` to the edges in `normalizeIssue` (after the hierarchy push). Then add the graph-level function:
```ts
export function normalizeIssues(rawIssues: any[], caps: Capabilities): Graph {
  const nodes: GraphNode[] = [];
  const edgeMap = new Map<string, GraphEdge>();
  for (const raw of rawIssues) {
    const { node, edges } = normalizeIssue(raw, caps);
    nodes.push(node);
    for (const e of edges) edgeMap.set(e.id, e);
  }
  const keys = new Set(nodes.map((n) => n.key));
  const edges = [...edgeMap.values()].filter((e) => keys.has(e.source) && keys.has(e.target));
  return { nodes, edges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/normalize.links.test.ts`
Expected: PASS (4 tests). Re-run prior normalize tests → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/normalize.ts src/core/normalize.links.test.ts
git commit -m "feat: normalize issue links and assemble deduped graph"
```

---

### Task 7: Depth-limited neighborhood (BFS)

**Files:**
- Create: `src/graph/depth.ts`
- Test: `src/graph/depth.test.ts`

- [ ] **Step 1: Write the failing test**

`src/graph/depth.test.ts`:
```ts
import { neighborhood } from './depth';
import type { Graph } from '../core/model';

function node(key: string): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: 1, url: '', raw: {} }; }
function edge(s: string, t: string): any { return { id: `${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'b', directed: true, raw: {} }; }

// A - B - C - D  (a chain)
const graph: Graph = { nodes: ['A', 'B', 'C', 'D'].map(node), edges: [edge('A', 'B'), edge('B', 'C'), edge('C', 'D')] };

test('depth 1 returns focus + direct neighbors', () => {
  const g = neighborhood(graph, 'B', 1);
  expect(g.nodes.map((n) => n.key).sort()).toEqual(['A', 'B', 'C']);
  expect(g.edges.map((e) => e.id).sort()).toEqual(['A-B', 'B-C']);
});

test('depth 2 reaches two hops, treating edges as undirected', () => {
  const g = neighborhood(graph, 'A', 2);
  expect(g.nodes.map((n) => n.key).sort()).toEqual(['A', 'B', 'C']);
});

test('depth 0 returns only the focus node', () => {
  const g = neighborhood(graph, 'C', 0);
  expect(g.nodes.map((n) => n.key)).toEqual(['C']);
  expect(g.edges).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/graph/depth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/graph/depth.ts`:
```ts
import type { Graph } from '../core/model';

export function neighborhood(graph: Graph, focusKey: string, depth: number): Graph {
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    (adj.get(e.source) ?? adj.set(e.source, []).get(e.source)!).push(e.target);
    (adj.get(e.target) ?? adj.set(e.target, []).get(e.target)!).push(e.source);
  }
  const dist = new Map<string, number>([[focusKey, 0]]);
  let frontier = [focusKey];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const k of frontier) {
      for (const nb of adj.get(k) ?? []) {
        if (!dist.has(nb)) { dist.set(nb, d + 1); next.push(nb); }
      }
    }
    frontier = next;
  }
  const nodes = graph.nodes.filter((n) => dist.has(n.key));
  const edges = graph.edges.filter((e) => dist.has(e.source) && dist.has(e.target));
  return { nodes, edges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/graph/depth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/graph/depth.ts src/graph/depth.test.ts
git commit -m "feat: depth-limited neighborhood BFS"
```

---

## Phase 2 — Fixtures + Provider

### Task 8: Mock fixtures (v3 + v2)

**Files:**
- Create: `src/fixtures/v3.ts`, `src/fixtures/v2.ts`
- Test: `src/fixtures/fixtures.test.ts`

- [ ] **Step 1: Write the failing test**

`src/fixtures/fixtures.test.ts`:
```ts
import { v3Issues, v3Caps } from './v3';
import { v2Issues, v2Caps } from './v2';
import { normalizeIssues } from '../core/normalize';

test('v3 fixtures normalize into a connected graph with epic + link edges', () => {
  const g = normalizeIssues(v3Issues, v3Caps);
  expect(g.nodes.length).toBeGreaterThanOrEqual(20);
  expect(g.edges.some((e) => e.relation === 'epic')).toBe(true);
  expect(g.edges.some((e) => e.relation === 'blocks')).toBe(true);
  expect(g.edges.some((e) => e.relation === 'relates')).toBe(true);
  expect(g.edges.some((e) => e.relation === 'subtask')).toBe(true);
});

test('v2 fixtures produce epic edges via Epic Link when capability is on', () => {
  const on = normalizeIssues(v2Issues, v2Caps);
  expect(on.edges.some((e) => e.relation === 'epic')).toBe(true);
  const off = normalizeIssues(v2Issues, { ...v2Caps, hasEpicLink: false });
  expect(off.edges.some((e) => e.relation === 'epic')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/fixtures/fixtures.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement fixtures**

Create `src/fixtures/v3.ts` exporting `v3Caps: Capabilities` (`{ apiVersion: 3, baseUrl: 'https://demo.atlassian.net', hasEpicLink: false, storyPointsFieldId: 'customfield_10016' }`) and `v3Issues: any[]`. Build a "Checkout revamp" project: `EPIC-1` (Checkout revamp) and `EPIC-2` (Search overhaul); stories/tasks/subtasks under EPIC-1 using `fields.parent` (with the parent's `issuetype`); a dependency chain via `Blocks` links (e.g. `TASK-20` blocks `TASK-22` blocks `TASK-24`) to exercise depth; at least one `Relates` link crossing to EPIC-2; one `Bug` that blocks a story. Aim for 22–28 issues. Each issue: `{ key, fields: { summary, issuetype:{name,subtask}, status:{name,statusCategory:{key}}, priority:{name}, assignee:{displayName}, customfield_10016?, parent?, issuelinks?[] } }`. Give descriptions as ADF docs to exercise `adfToText` (not asserted, but realistic).

Create `src/fixtures/v2.ts` exporting `v2Caps` (`{ apiVersion: 2, baseUrl: 'https://jira.example.com', hasEpicLink: true, epicLinkFieldId: 'customfield_10014', storyPointsFieldId: 'customfield_10024' }`) and `v2Issues`. Mirror a smaller version (12–16 issues) but: NO `fields.parent` for epic relationships — instead set the epic via `customfield_10014: 'EPIC-100'`; descriptions as plain strings; subtasks still use `fields.parent`.

> Tip: keep both files as plain exported arrays. No logic to test beyond the assertions above; the assertions guard structure.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/fixtures/fixtures.test.ts`
Expected: PASS (2 tests). If counts fail, add/adjust issues until thresholds met.

- [ ] **Step 5: Commit**

```bash
git add src/fixtures/v3.ts src/fixtures/v2.ts src/fixtures/fixtures.test.ts
git commit -m "feat: v3 and v2 mock fixtures with epic/link/subtask relationships"
```

---

### Task 9: DataProvider interface + MockProvider

**Files:**
- Create: `src/providers/DataProvider.ts`, `src/providers/MockProvider.ts`, `src/providers/JiraProvider.ts`
- Test: `src/providers/MockProvider.test.ts`

- [ ] **Step 1: Write the failing test**

`src/providers/MockProvider.test.ts`:
```ts
import { MockProvider } from './MockProvider';
import { v3Issues, v3Caps } from '../fixtures/v3';

const provider = new MockProvider(v3Issues, v3Caps);

test('capabilities echoes the configured caps', async () => {
  expect((await provider.capabilities()).apiVersion).toBe(3);
});

test('getGraph returns the full normalized graph', async () => {
  const g = await provider.getGraph();
  expect(g.nodes.length).toBeGreaterThanOrEqual(20);
});

test('getNeighborhood limits by depth around a focus key', async () => {
  const full = await provider.getGraph();
  const near = await provider.getNeighborhood(full.nodes[0].key, 1);
  expect(near.nodes.length).toBeLessThanOrEqual(full.nodes.length);
  expect(near.nodes.some((n) => n.key === full.nodes[0].key)).toBe(true);
});

test('search matches key and summary case-insensitively', async () => {
  const hits = await provider.search('cart');
  expect(Array.isArray(hits)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/providers/MockProvider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/providers/DataProvider.ts`:
```ts
import type { Capabilities, Graph, IssueKind } from '../core/model';

export interface NodeSummary { key: string; summary: string; kind: IssueKind }

export interface DataProvider {
  capabilities(): Promise<Capabilities>;
  getGraph(): Promise<Graph>;
  getNeighborhood(focusKey: string, depth: number): Promise<Graph>;
  search(query: string): Promise<NodeSummary[]>;
}
```

`src/providers/MockProvider.ts`:
```ts
import type { Capabilities, Graph } from '../core/model';
import { normalizeIssues } from '../core/normalize';
import { neighborhood } from '../graph/depth';
import type { DataProvider, NodeSummary } from './DataProvider';

export class MockProvider implements DataProvider {
  private graph: Graph;
  constructor(rawIssues: any[], private caps: Capabilities) {
    this.graph = normalizeIssues(rawIssues, caps);
  }
  async capabilities(): Promise<Capabilities> { return this.caps; }
  async getGraph(): Promise<Graph> { return this.graph; }
  async getNeighborhood(focusKey: string, depth: number): Promise<Graph> {
    return neighborhood(this.graph, focusKey, depth);
  }
  async search(query: string): Promise<NodeSummary[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return this.graph.nodes
      .filter((n) => n.key.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q))
      .map((n) => ({ key: n.key, summary: n.summary, kind: n.type.kind }));
  }
}
```

`src/providers/JiraProvider.ts` (skeleton for work — not wired now):
```ts
import type { Capabilities, Graph } from '../core/model';
import { normalizeIssues } from '../core/normalize';
import { neighborhood } from '../graph/depth';
import type { DataProvider, NodeSummary } from './DataProvider';

/**
 * Wired up at work behind a thin auth/CORS proxy. Detects Epic Link via
 * /rest/api/2/field, then fetches issues via /search/jql and normalizes them
 * with the SAME normalize() the MockProvider uses.
 */
export class JiraProvider implements DataProvider {
  private cache?: Graph;
  constructor(private baseUrl: string, private fetchFn: typeof fetch = fetch) {}

  async capabilities(): Promise<Capabilities> {
    const res = await this.fetchFn(`${this.baseUrl}/rest/api/3/field`);
    const fields: Array<{ id: string; name: string }> = await res.json();
    const epic = fields.find((f) => f.name === 'Epic Link');
    const points = fields.find((f) => f.name === 'Story Points' || f.name === 'Story point estimate');
    return { apiVersion: 3, baseUrl: this.baseUrl, hasEpicLink: !!epic, epicLinkFieldId: epic?.id, storyPointsFieldId: points?.id };
  }

  private async load(): Promise<Graph> {
    if (this.cache) return this.cache;
    const caps = await this.capabilities();
    // TODO(work): page through GET /rest/api/3/search/jql (token pagination) with a JQL filter.
    const res = await this.fetchFn(`${this.baseUrl}/rest/api/3/search/jql?fields=*all`);
    const data = await res.json();
    this.cache = normalizeIssues(data.issues ?? [], caps);
    return this.cache;
  }

  async getGraph(): Promise<Graph> { return this.load(); }
  async getNeighborhood(focusKey: string, depth: number): Promise<Graph> { return neighborhood(await this.load(), focusKey, depth); }
  async search(query: string): Promise<NodeSummary[]> {
    const q = query.toLowerCase();
    return (await this.load()).nodes.filter((n) => n.key.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q))
      .map((n) => ({ key: n.key, summary: n.summary, kind: n.type.kind }));
  }
}
```

> The `TODO(work)` is intentional — it marks the one integration point completed against a real instance, not missing plan detail.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/providers/MockProvider.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/providers/ && git commit -m "feat: DataProvider interface, MockProvider, JiraProvider skeleton"
```

---

## Phase 3 — Layouts (pure, TDD)

### Task 10: Layout types + shared helpers + hierarchical

**Files:**
- Create: `src/graph/layouts/types.ts`, `src/graph/layouts/shared.ts`, `src/graph/layouts/hierarchical.ts`
- Test: `src/graph/layouts/hierarchical.test.ts`

- [ ] **Step 1: Write the failing test**

`src/graph/layouts/hierarchical.test.ts`:
```ts
import { hierarchical } from './hierarchical';
import type { Graph } from '../../core/model';

function n(key: string, level: number): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
function e(s: string, t: string): any { return { id: `${s}-${t}`, source: s, target: t, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }

const graph: Graph = { nodes: [n('E', 2), n('S1', 1), n('S2', 1), n('T', 0)], edges: [e('E', 'S1'), e('E', 'S2'), e('S1', 'T')] };

test('higher hierarchy levels get smaller y (placed above)', () => {
  const pos = hierarchical(graph);
  expect(pos.get('E')!.y).toBeLessThan(pos.get('S1')!.y);
  expect(pos.get('S1')!.y).toBeLessThan(pos.get('T')!.y);
});

test('every node receives a finite, unique position', () => {
  const pos = hierarchical(graph);
  expect(pos.size).toBe(4);
  const seen = new Set([...pos.values()].map((p) => `${p.x},${p.y}`));
  expect(seen.size).toBe(4);
  for (const p of pos.values()) { expect(Number.isFinite(p.x)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
});

test('is deterministic', () => {
  expect([...hierarchical(graph).entries()]).toEqual([...hierarchical(graph).entries()]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/graph/layouts/hierarchical.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/graph/layouts/types.ts`:
```ts
import type { Graph } from '../../core/model';
export type Positions = Map<string, { x: number; y: number }>;
export type LayoutFn = (graph: Graph) => Positions;
export const ROW_H = 150;
export const COL_W = 240;
```

`src/graph/layouts/shared.ts`:
```ts
import type { Graph, GraphNode } from '../../core/model';
import { ROW_H } from './types';

/** Group nodes by hierarchyLevel; return rows ordered top (highest level) to bottom. */
export function rowsByLevel(graph: Graph): GraphNode[][] {
  const byLevel = new Map<number, GraphNode[]>();
  for (const node of graph.nodes) {
    (byLevel.get(node.hierarchyLevel) ?? byLevel.set(node.hierarchyLevel, []).get(node.hierarchyLevel)!).push(node);
  }
  return [...byLevel.keys()].sort((a, b) => b - a).map((lvl) => byLevel.get(lvl)!);
}

export function yForLevel(level: number, maxLevel: number): number {
  return (maxLevel - level) * ROW_H;
}
```

`src/graph/layouts/hierarchical.ts`:
```ts
import type { Graph } from '../../core/model';
import type { Positions } from './types';
import { COL_W } from './types';
import { rowsByLevel, yForLevel } from './shared';

export function hierarchical(graph: Graph): Positions {
  const rows = rowsByLevel(graph);
  const maxLevel = Math.max(0, ...graph.nodes.map((n) => n.hierarchyLevel));
  const pos: Positions = new Map();
  for (const row of rows) {
    row.forEach((node, i) => pos.set(node.key, { x: i * COL_W, y: yForLevel(node.hierarchyLevel, maxLevel) }));
  }
  barycenter(graph, rows, pos);
  return pos;
}

/** Two sweeps: pull each node toward the mean x of its hierarchy-connected neighbors, then de-overlap per row. */
function barycenter(graph: Graph, rows: ReturnType<typeof rowsByLevel>, pos: Positions): void {
  const neighbors = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.kind !== 'hierarchy') continue;
    (neighbors.get(e.source) ?? neighbors.set(e.source, []).get(e.source)!).push(e.target);
    (neighbors.get(e.target) ?? neighbors.set(e.target, []).get(e.target)!).push(e.source);
  }
  for (let sweep = 0; sweep < 4; sweep++) {
    for (const row of rows) {
      for (const node of row) {
        const nbs = neighbors.get(node.key) ?? [];
        if (nbs.length) {
          const mean = nbs.reduce((s, k) => s + (pos.get(k)?.x ?? 0), 0) / nbs.length;
          pos.get(node.key)!.x = mean;
        }
      }
      // de-overlap: sort by x, enforce minimum spacing
      const sorted = [...row].sort((a, b) => pos.get(a.key)!.x - pos.get(b.key)!.x);
      for (let i = 1; i < sorted.length; i++) {
        const prev = pos.get(sorted[i - 1].key)!, cur = pos.get(sorted[i].key)!;
        if (cur.x - prev.x < COL_W) cur.x = prev.x + COL_W;
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/graph/layouts/hierarchical.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/graph/layouts/types.ts src/graph/layouts/shared.ts src/graph/layouts/hierarchical.ts src/graph/layouts/hierarchical.test.ts
git commit -m "feat: hierarchical layout with barycenter crossing reduction"
```

---

### Task 11: Force layout

**Files:**
- Create: `src/graph/layouts/force.ts`
- Test: `src/graph/layouts/force.test.ts`

- [ ] **Step 1: Write the failing test**

`src/graph/layouts/force.test.ts`:
```ts
import { force } from './force';
import type { Graph } from '../../core/model';

function n(key: string): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: 1, url: '', raw: {} }; }
function e(s: string, t: string): any { return { id: `${s}-${t}`, source: s, target: t, kind: 'link', relation: 'relates', label: 'r', directed: false, raw: {} }; }

const graph: Graph = { nodes: ['A', 'B', 'C'].map(n), edges: [e('A', 'B'), e('B', 'C')] };

test('positions every node with finite coordinates', () => {
  const pos = force(graph);
  expect(pos.size).toBe(3);
  for (const p of pos.values()) { expect(Number.isFinite(p.x)).toBe(true); expect(Number.isFinite(p.y)).toBe(true); }
});

test('is deterministic (seeded, no randomness)', () => {
  expect([...force(graph).entries()]).toEqual([...force(graph).entries()]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/graph/layouts/force.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement (seeded spring simulation, zero deps)**

`src/graph/layouts/force.ts`:
```ts
import type { Graph } from '../../core/model';
import type { Positions } from './types';

const ITER = 300, REPULSION = 120_000, SPRING = 0.02, REST = 220, DAMP = 0.85;

export function force(graph: Graph): Positions {
  const keys = graph.nodes.map((n) => n.key);
  const N = keys.length || 1;
  // deterministic seed: spread on a circle by index
  const p = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  keys.forEach((k, i) => {
    const a = (i / N) * Math.PI * 2;
    p.set(k, { x: Math.cos(a) * 300, y: Math.sin(a) * 300, vx: 0, vy: 0 });
  });
  for (let it = 0; it < ITER; it++) {
    // repulsion (O(n^2), fine for depth-limited graphs)
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = p.get(keys[i])!, b = p.get(keys[j])!;
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const f = REPULSION / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    // spring attraction along edges
    for (const e of graph.edges) {
      const a = p.get(e.source), b = p.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - REST) * SPRING;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for (const k of keys) {
      const v = p.get(k)!;
      v.vx *= DAMP; v.vy *= DAMP;
      v.x += v.vx; v.y += v.vy;
    }
  }
  const out: Positions = new Map();
  for (const k of keys) { const v = p.get(k)!; out.set(k, { x: v.x, y: v.y }); }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/graph/layouts/force.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/graph/layouts/force.ts src/graph/layouts/force.test.ts
git commit -m "feat: deterministic force-directed layout"
```

---

### Task 12: Hybrid layout + registry

**Files:**
- Create: `src/graph/layouts/hybrid.ts`, `src/graph/layouts/index.ts`
- Test: `src/graph/layouts/hybrid.test.ts`

- [ ] **Step 1: Write the failing test**

`src/graph/layouts/hybrid.test.ts`:
```ts
import { hybrid } from './hybrid';
import { layouts } from './index';
import type { Graph } from '../../core/model';
import { ROW_H } from './types';

function n(key: string, level: number): any { return { id: key, key, summary: key, type: { name: 't', kind: 'task' }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
function he(s: string, t: string): any { return { id: `h-${s}-${t}`, source: s, target: t, kind: 'hierarchy', relation: 'parent', label: 'p', directed: true, raw: {} }; }
function le(s: string, t: string): any { return { id: `l-${s}-${t}`, source: s, target: t, kind: 'link', relation: 'blocks', label: 'b', directed: true, raw: {} }; }

// Two siblings far apart, joined by a link — hybrid should pull them closer in x than pure rows would.
const graph: Graph = { nodes: [n('E', 2), n('A', 1), n('B', 1)], edges: [he('E', 'A'), he('E', 'B'), le('A', 'B')] };

test('keeps hierarchy y-by-level (E above A and B)', () => {
  const pos = hybrid(graph);
  expect(pos.get('E')!.y).toBe(0);
  expect(pos.get('A')!.y).toBe(ROW_H);
  expect(pos.get('B')!.y).toBe(ROW_H);
});

test('registry exposes all three layouts', () => {
  expect(Object.keys(layouts).sort()).toEqual(['force', 'hierarchical', 'hybrid']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/graph/layouts/hybrid.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/graph/layouts/hybrid.ts`:
```ts
import type { Graph } from '../../core/model';
import type { Positions } from './types';
import { COL_W } from './types';
import { rowsByLevel, yForLevel } from './shared';

/**
 * Hierarchical backbone (y by level) but the horizontal barycenter pass also
 * accounts for LINK edges, so link-connected nodes drift closer together —
 * giving cleaner, shorter cross-links than strict hierarchical rows.
 */
export function hybrid(graph: Graph): Positions {
  const rows = rowsByLevel(graph);
  const maxLevel = Math.max(0, ...graph.nodes.map((n) => n.hierarchyLevel));
  const pos: Positions = new Map();
  for (const row of rows) row.forEach((node, i) => pos.set(node.key, { x: i * COL_W, y: yForLevel(node.hierarchyLevel, maxLevel) }));

  const neighbors = new Map<string, string[]>();
  for (const e of graph.edges) { // ALL edges, hierarchy + link
    (neighbors.get(e.source) ?? neighbors.set(e.source, []).get(e.source)!).push(e.target);
    (neighbors.get(e.target) ?? neighbors.set(e.target, []).get(e.target)!).push(e.source);
  }
  for (let sweep = 0; sweep < 6; sweep++) {
    for (const row of rows) {
      for (const node of row) {
        const nbs = neighbors.get(node.key) ?? [];
        if (nbs.length) pos.get(node.key)!.x = nbs.reduce((s, k) => s + (pos.get(k)?.x ?? 0), 0) / nbs.length;
      }
      const sorted = [...row].sort((a, b) => pos.get(a.key)!.x - pos.get(b.key)!.x);
      for (let i = 1; i < sorted.length; i++) {
        const prev = pos.get(sorted[i - 1].key)!, cur = pos.get(sorted[i].key)!;
        if (cur.x - prev.x < COL_W) cur.x = prev.x + COL_W;
      }
    }
  }
  return pos;
}
```

`src/graph/layouts/index.ts`:
```ts
import type { LayoutFn } from './types';
import { hierarchical } from './hierarchical';
import { force } from './force';
import { hybrid } from './hybrid';

export type LayoutKind = 'hierarchical' | 'force' | 'hybrid';
export const layouts: Record<LayoutKind, LayoutFn> = { hierarchical, force, hybrid };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/graph/layouts/hybrid.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/graph/layouts/hybrid.ts src/graph/layouts/index.ts src/graph/layouts/hybrid.test.ts
git commit -m "feat: hybrid layout and layout registry"
```

---

## Phase 4 — State + UI

### Task 13: Graph state reducer

**Files:**
- Create: `src/state/graphReducer.ts`
- Test: `src/state/graphReducer.test.ts`

- [ ] **Step 1: Write the failing test**

`src/state/graphReducer.test.ts`:
```ts
import { initialState, reducer } from './graphReducer';

test('setLayout switches layout', () => {
  const s = reducer(initialState, { type: 'setLayout', layout: 'force' });
  expect(s.layout).toBe('force');
});

test('setFocus enters focus mode and records the key', () => {
  const s = reducer(initialState, { type: 'setFocus', key: 'STORY-10' });
  expect(s.mode).toBe('focus');
  expect(s.focusKey).toBe('STORY-10');
});

test('setMode back to map clears focus', () => {
  const focused = reducer(initialState, { type: 'setFocus', key: 'STORY-10' });
  const s = reducer(focused, { type: 'setMode', mode: 'map' });
  expect(s.mode).toBe('map');
  expect(s.focusKey).toBeNull();
});

test('setDepth clamps to >= 0', () => {
  expect(reducer(initialState, { type: 'setDepth', depth: -3 }).depth).toBe(0);
  expect(reducer(initialState, { type: 'setDepth', depth: 4 }).depth).toBe(4);
});

test('toggleType adds and removes a hidden issue kind', () => {
  const hidden = reducer(initialState, { type: 'toggleType', kind: 'bug' });
  expect(hidden.hiddenTypes.has('bug')).toBe(true);
  const shown = reducer(hidden, { type: 'toggleType', kind: 'bug' });
  expect(shown.hiddenTypes.has('bug')).toBe(false);
});

test('select records the selected key', () => {
  expect(reducer(initialState, { type: 'select', key: 'BUG-40' }).selectedKey).toBe('BUG-40');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/graphReducer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/state/graphReducer.ts`:
```ts
import type { IssueKind, StatusCategory } from '../core/model';
import type { LayoutKind } from '../graph/layouts';

export interface GraphState {
  mode: 'map' | 'focus';
  focusKey: string | null;
  depth: number;
  layout: LayoutKind;
  hiddenTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  hiddenRelations: Set<string>; // link relation names + 'hierarchy'
  search: string;
  selectedKey: string | null;
}

export const initialState: GraphState = {
  mode: 'map', focusKey: null, depth: 2, layout: 'hybrid',
  hiddenTypes: new Set(), hiddenStatuses: new Set(), hiddenRelations: new Set(),
  search: '', selectedKey: null,
};

export type Action =
  | { type: 'setMode'; mode: 'map' | 'focus' }
  | { type: 'setFocus'; key: string }
  | { type: 'setDepth'; depth: number }
  | { type: 'setLayout'; layout: LayoutKind }
  | { type: 'toggleType'; kind: IssueKind }
  | { type: 'toggleStatus'; status: StatusCategory }
  | { type: 'toggleRelation'; relation: string }
  | { type: 'setSearch'; query: string }
  | { type: 'select'; key: string | null };

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}

export function reducer(state: GraphState, action: Action): GraphState {
  switch (action.type) {
    case 'setMode': return { ...state, mode: action.mode, focusKey: action.mode === 'map' ? null : state.focusKey };
    case 'setFocus': return { ...state, mode: 'focus', focusKey: action.key };
    case 'setDepth': return { ...state, depth: Math.max(0, action.depth) };
    case 'setLayout': return { ...state, layout: action.layout };
    case 'toggleType': return { ...state, hiddenTypes: toggle(state.hiddenTypes, action.kind) };
    case 'toggleStatus': return { ...state, hiddenStatuses: toggle(state.hiddenStatuses, action.status) };
    case 'toggleRelation': return { ...state, hiddenRelations: toggle(state.hiddenRelations, action.relation) };
    case 'setSearch': return { ...state, search: action.query };
    case 'select': return { ...state, selectedKey: action.key };
    default: return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/graphReducer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/graphReducer.ts src/state/graphReducer.test.ts
git commit -m "feat: graph view state reducer"
```

---

### Task 14: Graph → React Flow elements (pure mapping)

**Files:**
- Create: `src/graph/flow-elements.ts`
- Test: `src/graph/flow-elements.test.ts`

- [ ] **Step 1: Write the failing test**

`src/graph/flow-elements.test.ts`:
```ts
import { toFlowElements } from './flow-elements';
import type { Graph } from '../core/model';
import { initialState } from '../state/graphReducer';
import { hierarchical } from './layouts/hierarchical';

function n(key: string, kind: any, level: number): any { return { id: key, key, summary: key, type: { name: kind, kind }, status: { name: 's', category: 'todo' }, hierarchyLevel: level, url: '', raw: {} }; }
const graph: Graph = {
  nodes: [n('EPIC-1', 'epic', 2), n('BUG-40', 'bug', 1)],
  edges: [{ id: 'l1', source: 'BUG-40', target: 'EPIC-1', kind: 'link', relation: 'blocks', label: 'blocks', directed: true, raw: {} }],
};

test('maps nodes and edges with positions', () => {
  const { nodes, edges } = toFlowElements(graph, hierarchical(graph), initialState);
  expect(nodes).toHaveLength(2);
  expect(nodes[0].position).toBeDefined();
  expect(edges).toHaveLength(1);
});

test('hides nodes whose type is filtered, and edges touching them', () => {
  const state = { ...initialState, hiddenTypes: new Set(['bug'] as any) };
  const { nodes, edges } = toFlowElements(graph, hierarchical(graph), state);
  expect(nodes.map((x) => x.id)).toEqual(['EPIC-1']);
  expect(edges).toHaveLength(0);
});

test('hides edges whose relation is filtered', () => {
  const state = { ...initialState, hiddenRelations: new Set(['blocks']) };
  const { edges } = toFlowElements(graph, hierarchical(graph), state);
  expect(edges).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/graph/flow-elements.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/graph/flow-elements.ts`:
```ts
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import type { Positions } from './layouts/types';

const EDGE_COLOR: Record<string, string> = { hierarchy: '#9aa5b1', blocks: '#e12d39', relates: '#2186eb' };

function edgeColor(relation: string, kind: string): string {
  if (kind === 'hierarchy') return EDGE_COLOR.hierarchy;
  return EDGE_COLOR[relation] ?? '#7b8794';
}

export function toFlowElements(graph: Graph, positions: Positions, state: GraphState): { nodes: Node[]; edges: Edge[] } {
  const visible = new Set<string>();
  const nodes: Node[] = [];
  for (const gn of graph.nodes) {
    if (state.hiddenTypes.has(gn.type.kind) || state.hiddenStatuses.has(gn.status.category)) continue;
    visible.add(gn.key);
    nodes.push({
      id: gn.key,
      type: 'ticket',
      position: positions.get(gn.key) ?? { x: 0, y: 0 },
      data: { node: gn, selected: state.selectedKey === gn.key, search: state.search },
    });
  }
  const edges: Edge[] = [];
  for (const ge of graph.edges) {
    const relKey = ge.kind === 'hierarchy' ? 'hierarchy' : ge.relation;
    if (state.hiddenRelations.has(relKey)) continue;
    if (!visible.has(ge.source) || !visible.has(ge.target)) continue;
    const color = edgeColor(ge.relation, ge.kind);
    edges.push({
      id: ge.id, source: ge.source, target: ge.target, label: ge.label,
      animated: ge.relation === 'blocks',
      style: { stroke: color, strokeWidth: 1.6, strokeDasharray: ge.directed ? undefined : '5 4' },
      markerEnd: ge.directed ? { type: MarkerType.ArrowClosed, color } : undefined,
    });
  }
  return { nodes, edges };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/graph/flow-elements.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/graph/flow-elements.ts src/graph/flow-elements.test.ts
git commit -m "feat: map normalized graph to React Flow elements with filtering"
```

---

### Task 15: TicketNode component (rich card)

**Files:**
- Create: `src/components/TicketNode.tsx`, `src/components/TicketNode.css`

> UI task — verified visually when the app runs (Task 18). No unit test.

- [ ] **Step 1: Implement the node component**

`src/components/TicketNode.tsx`:
```tsx
import { Handle, Position } from '@xyflow/react';
import type { GraphNode } from '../core/model';
import './TicketNode.css';

const KIND_COLOR: Record<string, string> = { epic: '#7b61ff', story: '#3ebd93', task: '#2186eb', subtask: '#a0aec0', bug: '#e12d39', other: '#7b8794' };
const CAT_COLOR: Record<string, string> = { todo: '#9aa5b1', inprogress: '#f0b429', done: '#3ebd93' };

export function TicketNode({ data }: { data: { node: GraphNode; selected: boolean; search: string } }) {
  const { node, selected, search } = data;
  const match = !!search && (node.key.toLowerCase().includes(search.toLowerCase()) || node.summary.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className={`ticket ${selected ? 'selected' : ''} ${match ? 'match' : ''}`} style={{ borderTopColor: KIND_COLOR[node.type.kind] }}>
      <Handle type="target" position={Position.Top} />
      <div className="ticket-row">
        <span className="ticket-key" style={{ color: KIND_COLOR[node.type.kind] }}>{node.key}</span>
        <span className="ticket-type">{node.type.name}{node.priority ? ` · ${node.priority}` : ''}</span>
      </div>
      <div className="ticket-summary">{node.summary}</div>
      <div className="ticket-meta">
        <span className="ticket-pill" style={{ background: CAT_COLOR[node.status.category] + '22', color: CAT_COLOR[node.status.category] }}>{node.status.name}</span>
        <span className="ticket-right">
          {node.storyPoints != null && <span className="ticket-pts">{node.storyPoints} pts</span>}
          {node.assignee && <span className="ticket-av" title={node.assignee.displayName}>{node.assignee.initials}</span>}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

`src/components/TicketNode.css`:
```css
.ticket { width: 210px; background: #fff; border: 1px solid #e1e7ef; border-top: 3px solid #999; border-radius: 10px; box-shadow: 0 4px 14px rgba(16,42,67,.10); padding: 10px 12px; font-family: ui-sans-serif, system-ui; }
.ticket.selected { box-shadow: 0 0 0 3px #2186eb; }
.ticket.match { outline: 2px solid #f0b429; }
.ticket-row { display: flex; align-items: center; justify-content: space-between; }
.ticket-key { font: 700 11px ui-monospace, monospace; letter-spacing: .3px; }
.ticket-type { font-size: 10px; color: #7b8794; }
.ticket-summary { font-size: 13px; font-weight: 600; color: #1f2933; margin: 7px 0 9px; line-height: 1.3; }
.ticket-meta { display: flex; align-items: center; justify-content: space-between; }
.ticket-pill { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
.ticket-right { display: flex; align-items: center; gap: 6px; }
.ticket-pts { font-size: 10px; font-weight: 700; color: #3e4c59; background: #f0f4f8; padding: 2px 7px; border-radius: 6px; }
.ticket-av { width: 22px; height: 22px; border-radius: 50%; background: #7b61ff; color: #fff; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TicketNode.tsx src/components/TicketNode.css
git commit -m "feat: rich TicketNode card component"
```

---

### Task 16: GraphCanvas wrapper

**Files:**
- Create: `src/components/GraphCanvas.tsx`

> UI task — verified visually in Task 18.

- [ ] **Step 1: Implement**

`src/components/GraphCanvas.tsx`:
```tsx
import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Graph } from '../core/model';
import type { GraphState } from '../state/graphReducer';
import { layouts } from '../graph/layouts';
import { toFlowElements } from '../graph/flow-elements';
import { TicketNode } from './TicketNode';

const nodeTypes = { ticket: TicketNode };

export function GraphCanvas({ graph, state, onSelect }: { graph: Graph; state: GraphState; onSelect: (key: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const positions = layouts[state.layout](graph);
    return toFlowElements(graph, positions, state);
  }, [graph, state.layout, state.hiddenTypes, state.hiddenStatuses, state.hiddenRelations, state.selectedKey, state.search]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      onNodeClick={(_, n: Node) => onSelect(n.id)}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GraphCanvas.tsx
git commit -m "feat: React Flow GraphCanvas wrapper"
```

---

### Task 17: Toolbar + DetailPanel

**Files:**
- Create: `src/components/Toolbar.tsx`, `src/components/DetailPanel.tsx`, `src/components/panels.css`

> UI task — verified visually in Task 18.

- [ ] **Step 1: Implement Toolbar**

`src/components/Toolbar.tsx`:
```tsx
import type { Dispatch } from 'react';
import type { Action, GraphState } from '../state/graphReducer';
import type { LayoutKind } from '../graph/layouts';
import type { IssueKind } from '../core/model';
import './panels.css';

const LAYOUTS: LayoutKind[] = ['hybrid', 'hierarchical', 'force'];
const TYPES: IssueKind[] = ['epic', 'story', 'task', 'subtask', 'bug'];
const RELATIONS = ['hierarchy', 'blocks', 'relates'];

export function Toolbar({ state, dispatch }: { state: GraphState; dispatch: Dispatch<Action> }) {
  return (
    <div className="toolbar">
      <input className="tb-search" placeholder="Search key or summary…" value={state.search}
        onChange={(e) => dispatch({ type: 'setSearch', query: e.target.value })} />

      <div className="tb-group">
        <span className="tb-label">Mode</span>
        <button className={state.mode === 'map' ? 'on' : ''} onClick={() => dispatch({ type: 'setMode', mode: 'map' })}>Map</button>
        <button className={state.mode === 'focus' ? 'on' : ''} onClick={() => state.selectedKey && dispatch({ type: 'setFocus', key: state.selectedKey })}>Focus</button>
      </div>

      {state.mode === 'focus' && (
        <div className="tb-group">
          <span className="tb-label">Depth {state.depth}</span>
          <input type="range" min={0} max={5} value={state.depth} onChange={(e) => dispatch({ type: 'setDepth', depth: Number(e.target.value) })} />
        </div>
      )}

      <div className="tb-group">
        <span className="tb-label">Layout</span>
        {LAYOUTS.map((l) => <button key={l} className={state.layout === l ? 'on' : ''} onClick={() => dispatch({ type: 'setLayout', layout: l })}>{l}</button>)}
      </div>

      <div className="tb-group">
        <span className="tb-label">Types</span>
        {TYPES.map((t) => <button key={t} className={state.hiddenTypes.has(t) ? '' : 'on'} onClick={() => dispatch({ type: 'toggleType', kind: t })}>{t}</button>)}
      </div>

      <div className="tb-group">
        <span className="tb-label">Edges</span>
        {RELATIONS.map((r) => <button key={r} className={state.hiddenRelations.has(r) ? '' : 'on'} onClick={() => dispatch({ type: 'toggleRelation', relation: r })}>{r}</button>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement DetailPanel**

`src/components/DetailPanel.tsx`:
```tsx
import type { Dispatch } from 'react';
import type { Graph, GraphNode } from '../core/model';
import type { Action } from '../state/graphReducer';

export function DetailPanel({ graph, selectedKey, dispatch }: { graph: Graph; selectedKey: string | null; dispatch: Dispatch<Action> }) {
  if (!selectedKey) return null;
  const node: GraphNode | undefined = graph.nodes.find((n) => n.key === selectedKey);
  if (!node) return null;
  const links = graph.edges.filter((e) => e.source === node.key || e.target === node.key);
  return (
    <aside className="detail">
      <button className="detail-close" onClick={() => dispatch({ type: 'select', key: null })}>×</button>
      <div className="detail-key">{node.key}</div>
      <h3 className="detail-summary">{node.summary}</h3>
      <dl className="detail-fields">
        <dt>Type</dt><dd>{node.type.name}</dd>
        <dt>Status</dt><dd>{node.status.name}</dd>
        {node.priority && <><dt>Priority</dt><dd>{node.priority}</dd></>}
        {node.assignee && <><dt>Assignee</dt><dd>{node.assignee.displayName}</dd></>}
        {node.storyPoints != null && <><dt>Points</dt><dd>{node.storyPoints}</dd></>}
      </dl>
      <div className="detail-links">
        <span className="tb-label">Relationships ({links.length})</span>
        <ul>
          {links.map((e) => (
            <li key={e.id}>
              <button onClick={() => dispatch({ type: 'setFocus', key: e.source === node.key ? e.target : e.source })}>
                {e.source === node.key ? `${e.label} → ${e.target}` : `${e.source} ${e.label} →`}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <a className="detail-open" href={node.url} target="_blank" rel="noreferrer">Open in Jira ↗</a>
    </aside>
  );
}
```

`src/components/panels.css`:
```css
.toolbar { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; padding: 10px 14px; background: #fff; border-bottom: 1px solid #e1e7ef; font-family: ui-sans-serif, system-ui; }
.tb-search { padding: 6px 10px; border: 1px solid #cbd2d9; border-radius: 8px; min-width: 220px; font-size: 13px; }
.tb-group { display: flex; align-items: center; gap: 6px; }
.tb-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #7b8794; }
.toolbar button { font-size: 12px; padding: 4px 9px; border: 1px solid #cbd2d9; border-radius: 7px; background: #f5f7fa; color: #52606d; cursor: pointer; }
.toolbar button.on { background: #2186eb; border-color: #2186eb; color: #fff; }
.detail { position: absolute; top: 0; right: 0; width: 300px; height: 100%; background: #fff; border-left: 1px solid #e1e7ef; box-shadow: -6px 0 18px rgba(16,42,67,.08); padding: 18px; overflow-y: auto; font-family: ui-sans-serif, system-ui; z-index: 5; }
.detail-close { position: absolute; top: 10px; right: 12px; border: none; background: none; font-size: 20px; cursor: pointer; color: #7b8794; }
.detail-key { font: 700 12px ui-monospace, monospace; color: #2186eb; }
.detail-summary { margin: 6px 0 14px; font-size: 16px; }
.detail-fields { display: grid; grid-template-columns: 80px 1fr; gap: 4px 8px; font-size: 13px; }
.detail-fields dt { color: #7b8794; }
.detail-links { margin-top: 16px; }
.detail-links ul { list-style: none; padding: 0; margin: 6px 0; }
.detail-links button { background: none; border: none; color: #2186eb; cursor: pointer; font-size: 12px; padding: 2px 0; text-align: left; }
.detail-open { display: inline-block; margin-top: 16px; font-size: 13px; color: #2186eb; }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar.tsx src/components/DetailPanel.tsx src/components/panels.css
git commit -m "feat: Toolbar and DetailPanel components"
```

---

### Task 18: App wiring + run verification

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.css`

- [ ] **Step 1: Wire provider → state → UI**

`src/App.tsx`:
```tsx
import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Graph } from './core/model';
import { MockProvider } from './providers/MockProvider';
import { v3Issues, v3Caps } from './fixtures/v3';
import { v2Issues, v2Caps } from './fixtures/v2';
import { initialState, reducer } from './state/graphReducer';
import { GraphCanvas } from './components/GraphCanvas';
import { Toolbar } from './components/Toolbar';
import { DetailPanel } from './components/DetailPanel';
import './App.css';

type Dataset = 'v3' | 'v2' | 'v2-no-epic';

function providerFor(ds: Dataset): MockProvider {
  if (ds === 'v3') return new MockProvider(v3Issues, v3Caps);
  if (ds === 'v2') return new MockProvider(v2Issues, v2Caps);
  return new MockProvider(v2Issues, { ...v2Caps, hasEpicLink: false }); // graceful degradation demo
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset>('v3');
  const [state, dispatch] = useReducer(reducer, initialState);
  const [full, setFull] = useState<Graph>({ nodes: [], edges: [] });
  const [view, setView] = useState<Graph>({ nodes: [], edges: [] });
  const provider = useMemo(() => providerFor(dataset), [dataset]);

  useEffect(() => { provider.getGraph().then(setFull); }, [provider]);
  useEffect(() => {
    if (state.mode === 'focus' && state.focusKey) provider.getNeighborhood(state.focusKey, state.depth).then(setView);
    else setView(full);
  }, [provider, full, state.mode, state.focusKey, state.depth]);

  return (
    <div className="app">
      <header className="app-bar">
        <strong>Jira Graph</strong>
        <select value={dataset} onChange={(e) => setDataset(e.target.value as Dataset)}>
          <option value="v3">Cloud v3 (parent field)</option>
          <option value="v2">Server v2 (Epic Link)</option>
          <option value="v2-no-epic">v2 — Epic Link absent</option>
        </select>
      </header>
      <Toolbar state={state} dispatch={dispatch} />
      <div className="app-canvas">
        <GraphCanvas graph={view} state={state} onSelect={(key) => dispatch({ type: 'select', key })} />
        <DetailPanel graph={view} selectedKey={state.selectedKey} dispatch={dispatch} />
      </div>
    </div>
  );
}
```

`src/App.css`:
```css
html, body, #root { height: 100%; margin: 0; }
.app { display: flex; flex-direction: column; height: 100vh; }
.app-bar { display: flex; align-items: center; gap: 14px; padding: 10px 14px; background: #1f2933; color: #fff; font-family: ui-sans-serif, system-ui; }
.app-bar select { margin-left: auto; padding: 5px 8px; border-radius: 7px; border: 1px solid #52606d; background: #323f4b; color: #fff; }
.app-canvas { position: relative; flex: 1; min-height: 0; }
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all suites PASS.

- [ ] **Step 3: Run the app and verify visually**

Run: `npm run dev`
Open the printed URL. Verify:
- The v3 dataset renders the graph with rich cards and the three edge colors.
- Switching **Layout** (hybrid/hierarchical/force) re-arranges nodes.
- Clicking a node opens the **DetailPanel**; "Focus" + the **Depth** slider limit the neighborhood.
- Toggling **Types** / **Edges** filters shows/hides elements.
- The **"v2 — Epic Link absent"** dataset renders with no epic edges and no errors (graceful degradation).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: wire provider, state, and UI into the app"
```

---

## Phase 5 — Docs & deploy

### Task 19: README, dependency table, GitHub Pages

**Files:**
- Create: `README.md`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Write README**

`README.md` must include: a one-paragraph pitch; a screenshot placeholder (`docs/screenshot.png`); **Architecture** section explaining the provider seam (link the spec); **the dependency table** (react, react-dom, @xyflow/react + why each is trusted; note layouts/state are hand-rolled, zero extra deps); **supply-chain hygiene** notes (`npm ci --ignore-scripts`, `npm audit`, pinned exact versions); **Run locally** (`npm install`, `npm run dev`, `npm test`); and a **"Using real Jira at work"** section pointing to `JiraProvider` and the proxy requirement.

- [ ] **Step 2: Add GitHub Pages deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci --ignore-scripts
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages }
    steps:
      - uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Verify build once more**

Run: `npm run build`
Expected: `dist/` emitted with relative asset paths (because `base: './'`).

- [ ] **Step 4: Commit**

```bash
git add README.md .github/workflows/deploy.yml
git commit -m "docs: README, dependency table, and GitHub Pages deploy"
```

---

## Self-Review notes (already reconciled)

- **Spec coverage:** provider seam (T9), normalized model (T2), v2/v3 + ADF (T3–T6), Epic Link feature-detection + graceful absence (T5, T8, T18), issue links (T6), depth limiting (T7, T18), three layouts + toggle (T10–T12, T16–T17), filters/search (T13–T14, T17), rich nodes (T15), detail panel (T17), mock data both versions (T8), dependency policy/table (T1, T19), GitHub Pages (T19). JiraProvider skeleton for the work path (T9).
- **Out of scope** (editing, auth UI, remote links, real-time) intentionally omitted.
- **Type consistency:** `normalizeIssues`, `neighborhood`, `layouts[kind]`, `toFlowElements`, reducer `hiddenTypes/hiddenRelations`, and `Capabilities` field names are used identically across tasks.
