import type { Capabilities } from '../core/model';

export const largeCaps: Capabilities = {
  apiVersion: 3,
  baseUrl: 'https://jira.example.invalid',
  hasEpicLink: false,
  storyPointsFieldId: 'customfield_10016',
  startDateFieldId: 'customfield_10015',
  sprintFieldId: 'customfield_10020',
};

// ─── Projects ────────────────────────────────────────────────────────────────
const PROJECTS = [
  { key: 'CHK', name: 'Checkout Platform' },
  { key: 'SRCH', name: 'Search & Discovery' },
  { key: 'MOB', name: 'Mobile App' },
];

// ─── Assignee pool (~10) — cycling by index; every 7th issue unassigned ──────
const ASSIGNEE_POOL = [
  'Sam Brown', 'Ada Chen', 'Ravi Patel', 'Mia Torres',
  'Leo Kim', 'Nora Singh', 'Omar Diaz', 'Priya Rao',
  'Tom Lee', 'Eve Walsh',
];

function assigneeAt(idx: number): { displayName: string } | undefined {
  if (idx % 7 === 6) return undefined; // unassigned
  return { displayName: ASSIGNEE_POOL[idx % ASSIGNEE_POOL.length] };
}

// ─── Cycling helpers (deterministic, index-based) ────────────────────────────
const STATUSES = [
  { name: 'To Do',       statusCategory: { key: 'new' } },
  { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
  { name: 'Done',        statusCategory: { key: 'done' } },
];
const PRIORITIES = ['High', 'Medium', 'Low'];
const STORY_POINTS = [1, 2, 3, 5, 8];
const SPRINTS = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6'];

function statusAt(idx: number) { return STATUSES[idx % STATUSES.length]; }
function priorityAt(idx: number): { name: string } { return { name: PRIORITIES[idx % PRIORITIES.length] }; }
function pointsAt(idx: number): number { return STORY_POINTS[idx % STORY_POINTS.length]; }
function sprintAt(idx: number): Array<{ name: string }> { return [{ name: SPRINTS[idx % SPRINTS.length] }]; }

// Base date: 2026-06-01, stagger by 4 days per step
function dateFor(offset: number): string {
  // offset: days from 2026-06-01
  const base = new Date(2026, 5, 1); // month is 0-indexed
  const d = new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Issuetype constants ─────────────────────────────────────────────────────
const Epic    = { name: 'Epic',     subtask: false };
const Story   = { name: 'Story',    subtask: false };
const Task    = { name: 'Task',     subtask: false };
const Subtask = { name: 'Sub-task', subtask: true };
const Bug     = { name: 'Bug',      subtask: false };

// ─── Link helpers ─────────────────────────────────────────────────────────────
function blocksLink(targetKey: string) {
  return {
    type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
    outwardIssue: { key: targetKey },
  };
}
function relatesLink(targetKey: string) {
  return {
    type: { name: 'Relates', inward: 'relates to', outward: 'relates to' },
    outwardIssue: { key: targetKey },
  };
}

// ─── ADF description helper ───────────────────────────────────────────────────
function adf(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

// ─── Issue builder ────────────────────────────────────────────────────────────
interface IssueSpec {
  key: string;
  summary: string;
  issuetype: typeof Epic | typeof Story | typeof Task | typeof Subtask | typeof Bug;
  project: { key: string; name: string };
  idx: number;  // deterministic cycling seed
  parent?: { key: string; issuetype: typeof Epic | typeof Story | typeof Task };
  issuelinks?: object[];
  description?: string;
}

// Deterministic labels (cross-project) and components (per project) for filter demos.
const LABEL_POOL = ['backend', 'frontend', 'api', 'infra', 'ux', 'performance'];
const COMPONENTS: Record<string, string[]> = {
  CHK: ['Payments', 'Cart', 'Checkout UI'],
  SRCH: ['Query Engine', 'Ranking', 'Analytics'],
  MOB: ['iOS', 'Android', 'Mobile Core'],
};
function labelsAt(idx: number): string[] {
  // ~1 in 5 issues unlabeled; others get 1–2 labels
  if (idx % 5 === 4) return [];
  const first = LABEL_POOL[idx % LABEL_POOL.length];
  return idx % 3 === 0 ? [first, LABEL_POOL[(idx + 2) % LABEL_POOL.length]] : [first];
}
function componentsAt(projectKey: string, idx: number): string[] {
  const pool = COMPONENTS[projectKey] ?? [];
  if (pool.length === 0 || idx % 6 === 5) return [];
  return [pool[idx % pool.length]];
}

function makeIssue(spec: IssueSpec): any {
  const { key, summary, issuetype, project, idx, parent, issuelinks, description } = spec;
  const status = statusAt(idx);
  const priority = priorityAt(idx);
  const points = (issuetype === Story || issuetype === Task) ? pointsAt(idx) : undefined;
  const startDay = idx * 3; // stagger starts every 3 days
  const dueDay = startDay + 10 + (idx % 8) * 2;

  return {
    key,
    fields: {
      summary,
      issuetype,
      status,
      priority,
      assignee: assigneeAt(idx),
      project,
      labels: labelsAt(idx),
      components: componentsAt(project.key, idx).map((name) => ({ name })),
      ...(points !== undefined ? { customfield_10016: points } : {}),
      customfield_10015: dateFor(startDay),
      duedate: dateFor(dueDay),
      customfield_10020: sprintAt(idx),
      ...(parent ? { parent: { key: parent.key, fields: { issuetype: parent.issuetype } } } : {}),
      ...(issuelinks ? { issuelinks } : {}),
      description: adf(description ?? `${summary}. Auto-generated description for ${key}.`),
    },
  };
}

// ─── Generator ───────────────────────────────────────────────────────────────
// Counter shared across all issues for deterministic cycling
let globalIdx = 0;
function nextIdx(): number { return globalIdx++; }

// Per-project counters
const projectCounters: Record<string, number> = {};
function nextKey(projKey: string): string {
  projectCounters[projKey] = (projectCounters[projKey] ?? 0) + 1;
  return `${projKey}-${projectCounters[projKey]}`;
}

// Reset all counters so re-imports yield same data
globalIdx = 0;
for (const p of PROJECTS) projectCounters[p.key] = 0;

const issues: any[] = [];

// ─── Helper to capture cross-project link target keys ahead of time ───────────
// CHK project: 2 epics, each with 3 stories, each story with 2 tasks, ~half tasks get 2 subtasks + bugs
// SRCH project: 3 epics, similar structure
// MOB project: 2 epics, similar structure

// We'll build arrays to capture first-level task keys for cross-project links
const chkTasks: string[] = [];
const srchStories: string[] = [];
const mobTasks: string[] = [];

// ─── CHK — Checkout Platform ─────────────────────────────────────────────────
const chkProj = PROJECTS[0];

// Epic CHK-1
const chk_e1 = nextKey('CHK');
issues.push(makeIssue({ key: chk_e1, summary: 'Checkout Platform v2', issuetype: Epic, project: chkProj, idx: nextIdx() }));

// Stories under CHK-1
const chk_e1_stories: string[] = [];
for (let si = 0; si < 3; si++) {
  const stKey = nextKey('CHK');
  chk_e1_stories.push(stKey);
  const stIdx = nextIdx();
  issues.push(makeIssue({
    key: stKey,
    summary: ['Redesign cart summary', 'Implement guest checkout', 'Order confirmation emails'][si],
    issuetype: Story,
    project: chkProj,
    idx: stIdx,
    parent: { key: chk_e1, issuetype: Epic },
  }));

  // Tasks under each story
  const numTasks = 2 + (si % 2); // 2 or 3 tasks
  for (let ti = 0; ti < numTasks; ti++) {
    const tkKey = nextKey('CHK');
    chkTasks.push(tkKey);
    const tkIdx = nextIdx();
    issues.push(makeIssue({
      key: tkKey,
      summary: [`Migrate cart schema`, `Set up Stripe webhook`, `Write E2E checkout tests`,
                `Deploy payment service`, `Add address autocomplete`, `Implement payment adapter`][chkTasks.length - 1] ?? `CHK task ${chkTasks.length}`,
      issuetype: Task,
      project: chkProj,
      idx: tkIdx,
      parent: { key: stKey, issuetype: Story },
    }));

    // Subtasks under ~half the tasks (even indices)
    if (ti % 2 === 0) {
      for (let sub = 0; sub < 2; sub++) {
        const sbKey = nextKey('CHK');
        issues.push(makeIssue({
          key: sbKey,
          summary: [`Write migration script`, `Add DB indexes`, `Stripe interface impl`, `Unit tests for adapter`][sub % 4] ?? `Subtask ${sub}`,
          issuetype: Subtask,
          project: chkProj,
          idx: nextIdx(),
          parent: { key: tkKey, issuetype: Task },
        }));
      }
    }
  }

  // Bug per story
  const bugKey = nextKey('CHK');
  issues.push(makeIssue({
    key: bugKey,
    summary: [`Cart total miscalculates with discounts`, `Address form clears on error`, `Guest checkout loses session`][si],
    issuetype: Bug,
    project: chkProj,
    idx: nextIdx(),
    parent: { key: stKey, issuetype: Story },
  }));
}

// Epic CHK-2
const chk_e2 = nextKey('CHK');
issues.push(makeIssue({ key: chk_e2, summary: 'Payment Gateway Integration', issuetype: Epic, project: chkProj, idx: nextIdx() }));

// Stories under CHK-2
for (let si = 0; si < 2; si++) {
  const stKey = nextKey('CHK');
  const stIdx = nextIdx();
  issues.push(makeIssue({
    key: stKey,
    summary: ['Integrate PayPal gateway', 'Add Apple Pay support'][si],
    issuetype: Story,
    project: chkProj,
    idx: stIdx,
    parent: { key: chk_e2, issuetype: Epic },
  }));

  for (let ti = 0; ti < 2; ti++) {
    const tkKey = nextKey('CHK');
    chkTasks.push(tkKey);
    const tkIdx = nextIdx();
    issues.push(makeIssue({
      key: tkKey,
      summary: [`PayPal SDK integration`, `PayPal webhook handler`, `Apple Pay session setup`, `Apple Pay UI component`][si * 2 + ti],
      issuetype: Task,
      project: chkProj,
      idx: tkIdx,
      parent: { key: stKey, issuetype: Story },
    }));

    if (ti === 0) {
      const sbKey = nextKey('CHK');
      issues.push(makeIssue({
        key: sbKey,
        summary: [`Configure PayPal sandbox`, `Configure Apple Pay domain`][si],
        issuetype: Subtask,
        project: chkProj,
        idx: nextIdx(),
        parent: { key: tkKey, issuetype: Task },
      }));
    }
  }
}

// ─── SRCH — Search & Discovery ────────────────────────────────────────────────
const srchProj = PROJECTS[1];

// Epic SRCH-1
const srch_e1 = nextKey('SRCH');
issues.push(makeIssue({ key: srch_e1, summary: 'Faceted Search Filters', issuetype: Epic, project: srchProj, idx: nextIdx() }));

// Stories under SRCH-1
for (let si = 0; si < 3; si++) {
  const stKey = nextKey('SRCH');
  srchStories.push(stKey);
  const stIdx = nextIdx();
  issues.push(makeIssue({
    key: stKey,
    summary: ['Faceted search filters UI', 'Search result ranking algorithm', 'Autocomplete suggestions endpoint'][si],
    issuetype: Story,
    project: srchProj,
    idx: stIdx,
    parent: { key: srch_e1, issuetype: Epic },
  }));

  const numTasks = 2 + (si % 2);
  for (let ti = 0; ti < numTasks; ti++) {
    const tkKey = nextKey('SRCH');
    const tkIdx = nextIdx();
    issues.push(makeIssue({
      key: tkKey,
      summary: [`Index product catalog`, `Set up Elasticsearch cluster`, `Implement ranking scorer`,
                `A/B test ranking model`, `Build suggest endpoint`, `Cache autocomplete results`][si * 2 + ti] ?? `SRCH task`,
      issuetype: Task,
      project: srchProj,
      idx: tkIdx,
      parent: { key: stKey, issuetype: Story },
    }));

    if (ti % 2 === 0) {
      for (let sub = 0; sub < 1; sub++) {
        const sbKey = nextKey('SRCH');
        issues.push(makeIssue({
          key: sbKey,
          summary: [`Define ES index mapping`, `Load test ES cluster`, `Tune ranker params`][si % 3],
          issuetype: Subtask,
          project: srchProj,
          idx: nextIdx(),
          parent: { key: tkKey, issuetype: Task },
        }));
      }
    }
  }

  // Bug per story
  const bugKey = nextKey('SRCH');
  issues.push(makeIssue({
    key: bugKey,
    summary: ['Search returns stale results', 'Ranking ignores recency boost', 'Autocomplete duplicates entries'][si],
    issuetype: Bug,
    project: srchProj,
    idx: nextIdx(),
    parent: { key: stKey, issuetype: Story },
  }));
}

// Epic SRCH-2
const srch_e2 = nextKey('SRCH');
issues.push(makeIssue({ key: srch_e2, summary: 'Personalisation Engine', issuetype: Epic, project: srchProj, idx: nextIdx() }));

// Stories under SRCH-2
for (let si = 0; si < 2; si++) {
  const stKey = nextKey('SRCH');
  srchStories.push(stKey);
  const stIdx = nextIdx();
  issues.push(makeIssue({
    key: stKey,
    summary: ['User behaviour tracking', 'Personalised recommendations API'][si],
    issuetype: Story,
    project: srchProj,
    idx: stIdx,
    parent: { key: srch_e2, issuetype: Epic },
  }));

  for (let ti = 0; ti < 2; ti++) {
    const tkKey = nextKey('SRCH');
    const tkIdx = nextIdx();
    issues.push(makeIssue({
      key: tkKey,
      summary: [`Capture click events`, `Store user sessions`, `Build recommendations model`, `Expose recs endpoint`][si * 2 + ti],
      issuetype: Task,
      project: srchProj,
      idx: tkIdx,
      parent: { key: stKey, issuetype: Story },
    }));
  }
}

// Epic SRCH-3
const srch_e3 = nextKey('SRCH');
issues.push(makeIssue({ key: srch_e3, summary: 'Search Analytics Dashboard', issuetype: Epic, project: srchProj, idx: nextIdx() }));

// Stories under SRCH-3
for (let si = 0; si < 2; si++) {
  const stKey = nextKey('SRCH');
  srchStories.push(stKey);
  const stIdx = nextIdx();
  issues.push(makeIssue({
    key: stKey,
    summary: ['Query volume metrics', 'Zero-results report'][si],
    issuetype: Story,
    project: srchProj,
    idx: stIdx,
    parent: { key: srch_e3, issuetype: Epic },
  }));

  for (let ti = 0; ti < 2; ti++) {
    const tkKey = nextKey('SRCH');
    const tkIdx = nextIdx();
    issues.push(makeIssue({
      key: tkKey,
      summary: [`Aggregate query logs`, `Build metrics dashboard`, `Detect zero-result queries`, `Alert on zero-result spike`][si * 2 + ti],
      issuetype: Task,
      project: srchProj,
      idx: tkIdx,
      parent: { key: stKey, issuetype: Story },
    }));

    if (ti === 0) {
      const sbKey = nextKey('SRCH');
      issues.push(makeIssue({
        key: sbKey,
        summary: [`Set up log pipeline`, `Configure alert thresholds`][si],
        issuetype: Subtask,
        project: srchProj,
        idx: nextIdx(),
        parent: { key: tkKey, issuetype: Task },
      }));
    }
  }
}

// ─── MOB — Mobile App ────────────────────────────────────────────────────────
const mobProj = PROJECTS[2];

// Epic MOB-1
const mob_e1 = nextKey('MOB');
issues.push(makeIssue({ key: mob_e1, summary: 'Mobile Checkout Experience', issuetype: Epic, project: mobProj, idx: nextIdx() }));

// Stories under MOB-1
for (let si = 0; si < 3; si++) {
  const stKey = nextKey('MOB');
  const stIdx = nextIdx();
  issues.push(makeIssue({
    key: stKey,
    summary: ['Native cart page', 'Biometric payment confirmation', 'Push notification for order status'][si],
    issuetype: Story,
    project: mobProj,
    idx: stIdx,
    parent: { key: mob_e1, issuetype: Epic },
  }));

  const numTasks = 2 + (si % 2);
  for (let ti = 0; ti < numTasks; ti++) {
    const tkKey = nextKey('MOB');
    mobTasks.push(tkKey);
    const tkIdx = nextIdx();
    issues.push(makeIssue({
      key: tkKey,
      summary: [`Cart list component`, `Cart total bar`, `Face ID integration`, `Touch ID fallback`,
                `FCM notification setup`, `Deep link for order`][si * 2 + ti] ?? `MOB task`,
      issuetype: Task,
      project: mobProj,
      idx: tkIdx,
      parent: { key: stKey, issuetype: Story },
    }));

    if (ti % 2 === 0) {
      for (let sub = 0; sub < 2; sub++) {
        const sbKey = nextKey('MOB');
        issues.push(makeIssue({
          key: sbKey,
          summary: [`Swipe-to-remove item`, `Quantity stepper`, `Keychain storage for biometrics`, `Biometric error handling`][sub % 4],
          issuetype: Subtask,
          project: mobProj,
          idx: nextIdx(),
          parent: { key: tkKey, issuetype: Task },
        }));
      }
    }
  }

  // Bug per story
  const bugKey = nextKey('MOB');
  issues.push(makeIssue({
    key: bugKey,
    summary: ['Cart crashes on empty state', 'Face ID fails on second attempt', 'Push notification not received'][si],
    issuetype: Bug,
    project: mobProj,
    idx: nextIdx(),
    parent: { key: stKey, issuetype: Story },
  }));
}

// Epic MOB-2
const mob_e2 = nextKey('MOB');
issues.push(makeIssue({ key: mob_e2, summary: 'Mobile Search Integration', issuetype: Epic, project: mobProj, idx: nextIdx() }));

// Stories under MOB-2
for (let si = 0; si < 2; si++) {
  const stKey = nextKey('MOB');
  const stIdx = nextIdx();
  issues.push(makeIssue({
    key: stKey,
    summary: ['Voice search support', 'Search results page mobile layout'][si],
    issuetype: Story,
    project: mobProj,
    idx: stIdx,
    parent: { key: mob_e2, issuetype: Epic },
  }));

  for (let ti = 0; ti < 2; ti++) {
    const tkKey = nextKey('MOB');
    mobTasks.push(tkKey);
    const tkIdx = nextIdx();
    issues.push(makeIssue({
      key: tkKey,
      summary: [`Speech-to-text integration`, `Voice query UX`, `Responsive grid layout`, `Infinite scroll for results`][si * 2 + ti],
      issuetype: Task,
      project: mobProj,
      idx: tkIdx,
      parent: { key: stKey, issuetype: Story },
    }));

    if (ti === 0) {
      const sbKey = nextKey('MOB');
      issues.push(makeIssue({
        key: sbKey,
        summary: [`Request mic permissions`, `Debounce voice input`, `Skeleton loading state`, `Image lazy loading`][si * 2 + ti],
        issuetype: Subtask,
        project: mobProj,
        idx: nextIdx(),
        parent: { key: tkKey, issuetype: Task },
      }));
    }
  }
}

// ─── Add intra-project and cross-project links ────────────────────────────────
// Find some concrete keys that definitely exist by looking at what we built.
// CHK: blocks chain across first few tasks
// We'll add issuelinks to existing issues by mutating the fields arrays.

// Helper to add a link to an existing issue (safe because we have full control)
function addLink(issueKey: string, link: object) {
  const iss = issues.find((i) => i.key === issueKey);
  if (!iss) return;
  if (!iss.fields.issuelinks) iss.fields.issuelinks = [];
  iss.fields.issuelinks.push(link);
}

// CHK intra-project: blocks chain across first 3 CHK tasks
if (chkTasks.length >= 3) {
  addLink(chkTasks[0], blocksLink(chkTasks[1]));
  addLink(chkTasks[1], blocksLink(chkTasks[2]));
}
// CHK intra-project: relates between two CHK stories
const chkStory1 = chk_e1_stories[0];
const chkStory2 = chk_e1_stories[1];
if (chkStory1 && chkStory2) {
  addLink(chkStory1, relatesLink(chkStory2));
}
// CHK high-level dependency between epics
addLink(chk_e1, relatesLink(chk_e2));

// SRCH intra-project: blocks chain across first 2 SRCH stories
if (srchStories.length >= 2) {
  addLink(srchStories[0], blocksLink(srchStories[1]));
}
// SRCH high-level dependency between epics
addLink(srch_e2, blocksLink(srch_e3));

// Cross-project links (required by spec):
// 1. SRCH story relates to CHK story (cross-project relates)
if (srchStories[0] && chkStory1) {
  addLink(srchStories[0], relatesLink(chkStory1));
}
// 2. CHK task blocks MOB task (cross-project blocks)
if (chkTasks[0] && mobTasks[0]) {
  addLink(chkTasks[0], blocksLink(mobTasks[0]));
}
// 3. MOB task relates to SRCH task
if (mobTasks.length >= 1 && srchStories.length >= 3) {
  addLink(mobTasks[0], relatesLink(srchStories[2]));
}
// Cross-project high-level dependency
addLink(mob_e1, relatesLink(srch_e1));

export const largeIssues: any[] = issues;
