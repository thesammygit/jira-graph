import type { Capabilities } from '../core/model';

/**
 * Parameterized API-shaped fixture generator for scale testing — thousands of
 * tickets with full hierarchy (epic ▸ story ▸ task ▸ subtask + bugs), labels,
 * components, and a sparse deterministic sprinkle of links. Same Jira v3
 * payload shape the MockProvider/normalize pipeline expects.
 */
export const hugeCaps: Capabilities = {
  apiVersion: 3,
  baseUrl: 'https://acme.atlassian.net',
  hasEpicLink: false,
  storyPointsFieldId: 'customfield_10016',
  startDateFieldId: 'customfield_10015',
  sprintFieldId: 'customfield_10020',
};

export interface GenSpec {
  projects?: number;       // default 3
  epicsPerProject?: number; // default 18
  storiesPerEpic?: number;  // default 8
  tasksPerStory?: number;   // default 4
}

const STATUSES = [
  { name: 'To Do', statusCategory: { key: 'new' } },
  { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
  { name: 'Done', statusCategory: { key: 'done' } },
];
const PEOPLE = ['Sam Brown', 'Ada Chen', 'Ravi Patel', 'Mia Torres', 'Leo Kim', 'Nora Singh', 'Omar Diaz', 'Priya Rao', 'Tom Lee', 'Eve Walsh'];
const LABELS = ['backend', 'frontend', 'api', 'infra', 'ux', 'performance'];
const COMPONENTS = ['Core', 'Platform', 'Web UI'];
const NOUNS = ['pipeline', 'dashboard', 'endpoint', 'cache', 'schema', 'worker', 'gateway', 'index', 'webhook', 'migration'];
const VERBS = ['Build', 'Refactor', 'Optimise', 'Ship', 'Design', 'Test', 'Document', 'Harden', 'Migrate', 'Profile'];

export function generateIssues(spec: GenSpec = {}): any[] {
  const nProj = spec.projects ?? 3;
  const nEpics = spec.epicsPerProject ?? 22;
  const nStories = spec.storiesPerEpic ?? 9;
  const nTasks = spec.tasksPerStory ?? 4;

  const issues: any[] = [];
  let idx = 0;
  const taskKeys: string[] = [];
  const storyKeys: string[] = [];
  const epicKeys: string[] = [];

  const make = (key: string, summary: string, issuetype: { name: string; subtask: boolean }, projKey: string, parent?: { key: string; typeName: string }) => {
    const i = idx++;
    issues.push({
      key,
      fields: {
        summary,
        issuetype,
        status: STATUSES[i % 3],
        priority: { name: ['High', 'Medium', 'Low'][i % 3] },
        assignee: i % 7 === 6 ? undefined : { displayName: PEOPLE[i % PEOPLE.length] },
        project: { key: projKey, name: `Project ${projKey}` },
        labels: i % 5 === 4 ? [] : [LABELS[i % LABELS.length]],
        components: i % 6 === 5 ? [] : [{ name: COMPONENTS[i % COMPONENTS.length] }],
        ...(issuetype.name === 'Story' || issuetype.name === 'Task' ? { customfield_10016: [1, 2, 3, 5, 8][i % 5] } : {}),
        ...(parent ? { parent: { key: parent.key, fields: { issuetype: { name: parent.typeName, subtask: false } } } } : {}),
        description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: `${summary}.` }] }] },
      },
    });
    return key;
  };

  for (let p = 0; p < nProj; p++) {
    const proj = `P${p + 1}`;
    let n = 0;
    const nk = () => `${proj}-${++n}`;
    for (let e = 0; e < nEpics; e++) {
      const epic = make(nk(), `${VERBS[e % VERBS.length]} ${NOUNS[(e + p) % NOUNS.length]} programme ${e + 1}`, { name: 'Epic', subtask: false }, proj);
      epicKeys.push(epic);
      for (let s = 0; s < nStories; s++) {
        const story = make(nk(), `${VERBS[(e + s) % VERBS.length]} ${NOUNS[s % NOUNS.length]} flow`, { name: 'Story', subtask: false }, proj, { key: epic, typeName: 'Epic' });
        storyKeys.push(story);
        for (let t = 0; t < nTasks; t++) {
          const task = make(nk(), `${VERBS[(s + t) % VERBS.length]} the ${NOUNS[(t + e) % NOUNS.length]}`, { name: 'Task', subtask: false }, proj, { key: story, typeName: 'Story' });
          taskKeys.push(task);
          if (t % 2 === 0) {
            make(nk(), `Spec the ${NOUNS[(t + s) % NOUNS.length]}`, { name: 'Sub-task', subtask: true }, proj, { key: task, typeName: 'Task' });
          }
        }
        if (s % 3 === 2) {
          make(nk(), `${NOUNS[s % NOUNS.length]} regression on edge case`, { name: 'Bug', subtask: false }, proj, { key: story, typeName: 'Story' });
        }
      }
    }
  }

  // One flat "backlog" epic per project — 60 direct children, the shape that
  // exercises per-box chip pagination.
  for (let p = 0; p < nProj; p++) {
    const proj = `P${p + 1}`;
    let n = issues.filter((i) => i.key.startsWith(`${proj}-`)).length;
    const backlog = make(`${proj}-${++n}`, `Backlog & tech debt`, { name: 'Epic', subtask: false }, proj);
    for (let t = 0; t < 60; t++) {
      make(`${proj}-${++n}`, `${VERBS[t % VERBS.length]} backlog ${NOUNS[t % NOUNS.length]} ${t + 1}`, { name: 'Task', subtask: false }, proj, { key: backlog, typeName: 'Epic' });
    }
  }

  // Sparse deterministic links (~1 link per 25 tickets, like a real tracker).
  const byKey = new Map(issues.map((iss) => [iss.key, iss]));
  const link = (from: string, to: string, blocks: boolean) => {
    const iss = byKey.get(from);
    if (!iss || from === to) return;
    (iss.fields.issuelinks ??= []).push({
      type: blocks
        ? { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }
        : { name: 'Relates', inward: 'relates to', outward: 'relates to' },
      outwardIssue: { key: to },
    });
  };
  for (let i = 0; i < taskKeys.length; i += 17) link(taskKeys[i], taskKeys[(i + 5) % taskKeys.length], true);
  for (let i = 0; i < storyKeys.length; i += 9) link(storyKeys[i], storyKeys[(i + 3) % storyKeys.length], i % 2 === 0);
  for (let i = 0; i < epicKeys.length; i += 4) link(epicKeys[i], epicKeys[(i + 1) % epicKeys.length], false);

  return issues;
}

/** ~4,300 tickets — the scale target. Generated once, module-cached. */
export const hugeIssues: any[] = generateIssues();
