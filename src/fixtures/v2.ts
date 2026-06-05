import type { Capabilities } from '../core/model';

export const v2Caps: Capabilities = {
  apiVersion: 2,
  baseUrl: 'https://jira.example.com',
  hasEpicLink: true,
  epicLinkFieldId: 'customfield_10014',
  storyPointsFieldId: 'customfield_10024',
  startDateFieldId: 'customfield_10015',
  sprintFieldId: 'customfield_10020',
};

// Helper issuetypes
const Epic = { name: 'Epic', subtask: false };
const Story = { name: 'Story', subtask: false };
const Task = { name: 'Task', subtask: false };
const Subtask = { name: 'Sub-task', subtask: true };
const Bug = { name: 'Bug', subtask: false };

// Helper statuses
const toDo = { name: 'To Do', statusCategory: { key: 'new' } };
const inProgress = { name: 'In Progress', statusCategory: { key: 'indeterminate' } };
const done = { name: 'Done', statusCategory: { key: 'done' } };

// Helper priorities
const high = { name: 'High' };
const medium = { name: 'Medium' };
const low = { name: 'Low' };

// Assignees
const frank = { displayName: 'Frank Torres' };
const grace = { displayName: 'Grace Liu' };
const henry = { displayName: 'Henry Park' };

// Link helpers
function blocks(targetKey: string) {
  return {
    type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
    outwardIssue: { key: targetKey },
  };
}
function isBlockedBy(sourceKey: string) {
  return {
    type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
    inwardIssue: { key: sourceKey },
  };
}
function relatesTo(targetKey: string) {
  return {
    type: { name: 'Relates', inward: 'relates to', outward: 'relates to' },
    outwardIssue: { key: targetKey },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// v2 Issues — "Billing Portal" project (Jira Server / Data Center style)
// Epic Link via customfield_10014; descriptions are plain strings.
// Total: 15 issues
// ─────────────────────────────────────────────────────────────────────────────
export const v2Issues: any[] = [
  // ── Epic ──────────────────────────────────────────────────────────────────
  {
    key: 'EPIC-100',
    fields: {
      summary: 'Billing portal redesign',
      issuetype: Epic,
      status: inProgress,
      priority: high,
      assignee: frank,
      description: 'Full redesign of the self-service billing portal.',
    },
  },

  // ── Stories linked to EPIC-100 via Epic Link ───────────────────────────────
  {
    key: 'STORY-200',
    fields: {
      summary: 'Invoice download page',
      issuetype: Story,
      status: inProgress,
      priority: high,
      assignee: grace,
      customfield_10024: 8,
      customfield_10014: 'EPIC-100',
      customfield_10015: '2026-06-09',
      duedate: '2026-06-27',
      customfield_10020: [{ name: 'Sprint 1' }],
      description: 'Allow users to download invoices as PDF.',
    },
  },
  {
    key: 'STORY-201',
    fields: {
      summary: 'Payment method management',
      issuetype: Story,
      status: toDo,
      priority: high,
      assignee: henry,
      customfield_10024: 13,
      customfield_10014: 'EPIC-100',
      customfield_10015: '2026-06-30',
      duedate: '2026-07-18',
      customfield_10020: [{ name: 'Sprint 2' }],
    },
  },
  {
    key: 'STORY-202',
    fields: {
      summary: 'Subscription plan upgrade flow',
      issuetype: Story,
      status: toDo,
      priority: medium,
      assignee: frank,
      customfield_10024: 8,
      customfield_10014: 'EPIC-100',
      issuelinks: [isBlockedBy('TASK-300')],
    },
  },
  {
    key: 'STORY-203',
    fields: {
      summary: 'Usage-based billing dashboard',
      issuetype: Story,
      status: toDo,
      priority: medium,
      assignee: grace,
      customfield_10024: 5,
      customfield_10014: 'EPIC-100',
      description: 'Show current usage metrics and projected costs.',
    },
  },

  // ── Tasks linked to EPIC-100 via Epic Link ────────────────────────────────
  {
    key: 'TASK-300',
    fields: {
      summary: 'Integrate Stripe billing API',
      issuetype: Task,
      status: inProgress,
      priority: high,
      assignee: henry,
      customfield_10024: 8,
      customfield_10014: 'EPIC-100',
      customfield_10015: '2026-06-02',
      duedate: '2026-06-20',
      customfield_10020: [{ name: 'Sprint 1' }],
      issuelinks: [blocks('STORY-202'), relatesTo('STORY-200')],
    },
  },
  {
    key: 'TASK-301',
    fields: {
      summary: 'Set up PDF generation service',
      issuetype: Task,
      status: done,
      priority: medium,
      assignee: frank,
      customfield_10024: 3,
      customfield_10014: 'EPIC-100',
    },
  },
  {
    key: 'TASK-302',
    fields: {
      summary: 'Write billing portal E2E tests',
      issuetype: Task,
      status: toDo,
      priority: low,
      assignee: grace,
      customfield_10024: 5,
      customfield_10014: 'EPIC-100',
      issuelinks: [isBlockedBy('TASK-300')],
    },
  },

  // ── Subtasks under TASK-300 (still use fields.parent in v2) ───────────────
  {
    key: 'SUB-400',
    fields: {
      summary: 'Implement Stripe webhook receiver',
      issuetype: Subtask,
      status: done,
      priority: high,
      assignee: henry,
      parent: { key: 'TASK-300', fields: { issuetype: Task } },
    },
  },
  {
    key: 'SUB-401',
    fields: {
      summary: 'Handle Stripe payment_intent events',
      issuetype: Subtask,
      status: inProgress,
      priority: medium,
      assignee: frank,
      parent: { key: 'TASK-300', fields: { issuetype: Task } },
    },
  },

  // ── Bugs linked to EPIC-100 via Epic Link ─────────────────────────────────
  {
    key: 'BUG-500',
    fields: {
      summary: 'Invoice PDF missing line items for annual plans',
      issuetype: Bug,
      status: inProgress,
      priority: high,
      assignee: grace,
      customfield_10014: 'EPIC-100',
      issuelinks: [blocks('STORY-200')],
      description: 'Annual plan invoices omit line items due to a rendering bug.',
    },
  },
  {
    key: 'BUG-501',
    fields: {
      summary: 'Subscription upgrade fails for team accounts',
      issuetype: Bug,
      status: toDo,
      priority: high,
      assignee: henry,
      customfield_10014: 'EPIC-100',
      issuelinks: [blocks('STORY-202')],
    },
  },
  {
    key: 'BUG-502',
    fields: {
      summary: 'Usage dashboard shows incorrect unit count',
      issuetype: Bug,
      status: toDo,
      priority: medium,
      assignee: frank,
      customfield_10014: 'EPIC-100',
    },
  },

  // ── Additional task for richer graph ─────────────────────────────────────
  {
    key: 'TASK-303',
    fields: {
      summary: 'Migrate billing data to new schema',
      issuetype: Task,
      status: done,
      priority: high,
      assignee: henry,
      customfield_10024: 8,
      customfield_10014: 'EPIC-100',
      customfield_10015: '2026-05-19',
      duedate: '2026-05-30',
      customfield_10020: [{ name: 'Sprint 1' }],
      issuelinks: [blocks('TASK-300')],
    },
  },
  {
    key: 'STORY-204',
    fields: {
      summary: 'Proration preview on plan change',
      issuetype: Story,
      status: toDo,
      priority: medium,
      assignee: grace,
      customfield_10024: 5,
      customfield_10014: 'EPIC-100',
      issuelinks: [isBlockedBy('STORY-201')],
    },
  },
];
