import type { Capabilities } from '../core/model';

export const v3Caps: Capabilities = {
  apiVersion: 3,
  baseUrl: 'https://demo.atlassian.net',
  hasEpicLink: false,
  storyPointsFieldId: 'customfield_10016',
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

// Assignees
const alice = { displayName: 'Alice Chen' };
const bob = { displayName: 'Bob Marley' };
const carol = { displayName: 'Carol White' };
const dave = { displayName: 'Dave Kim' };

// Sprint helpers
function sprint(name: string) {
  return [{ name }];
}

// ADF description helper
function adf(text: string) {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

// Parent refs
function epicParent(key: string) {
  return { key, fields: { issuetype: Epic } };
}
function taskParent(key: string) {
  return { key, fields: { issuetype: Task } };
}

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
// v3 Issues — "Checkout Revamp" + "Search Overhaul" mini-project
// Total: 25 issues
// ─────────────────────────────────────────────────────────────────────────────
export const v3Issues: any[] = [
  // ── Epics ──────────────────────────────────────────────────────────────────
  {
    key: 'EPIC-1',
    fields: {
      summary: 'Checkout revamp',
      issuetype: Epic,
      status: inProgress,
      priority: high,
      assignee: alice,
      description: adf('Overhaul the entire checkout flow for improved conversion.'),
    },
  },
  {
    key: 'EPIC-2',
    fields: {
      summary: 'Search overhaul',
      issuetype: Epic,
      status: toDo,
      priority: medium,
      assignee: bob,
      description: adf('Rebuild search to use Elasticsearch with faceted filters.'),
    },
  },

  // ── Stories under EPIC-1 ───────────────────────────────────────────────────
  {
    key: 'STORY-10',
    fields: {
      summary: 'Redesign cart summary page',
      issuetype: Story,
      status: inProgress,
      priority: high,
      assignee: alice,
      customfield_10016: 8,
      customfield_10015: '2026-06-02',
      duedate: '2026-06-20',
      customfield_10020: sprint('Sprint 1'),
      parent: epicParent('EPIC-1'),
      description: adf('Users should see a clear cart summary before payment.'),
    },
  },
  {
    key: 'STORY-11',
    fields: {
      summary: 'Implement guest checkout flow',
      issuetype: Story,
      status: toDo,
      priority: high,
      assignee: carol,
      customfield_10016: 13,
      customfield_10015: '2026-06-23',
      duedate: '2026-07-11',
      customfield_10020: sprint('Sprint 2'),
      parent: epicParent('EPIC-1'),
      issuelinks: [isBlockedBy('TASK-20')],
    },
  },
  {
    key: 'STORY-12',
    fields: {
      summary: 'Add address autocomplete',
      issuetype: Story,
      status: toDo,
      priority: medium,
      assignee: dave,
      customfield_10016: 5,
      customfield_10015: '2026-07-14',
      duedate: '2026-07-25',
      customfield_10020: sprint('Sprint 2'),
      parent: epicParent('EPIC-1'),
    },
  },
  {
    key: 'STORY-13',
    fields: {
      summary: 'Order confirmation email template',
      issuetype: Story,
      status: done,
      priority: medium,
      assignee: bob,
      customfield_10016: 3,
      customfield_10015: '2026-05-26',
      duedate: '2026-06-06',
      customfield_10020: sprint('Sprint 1'),
      parent: epicParent('EPIC-1'),
    },
  },

  // ── Stories under EPIC-2 ───────────────────────────────────────────────────
  {
    key: 'STORY-30',
    fields: {
      summary: 'Faceted search filters UI',
      issuetype: Story,
      status: toDo,
      priority: high,
      assignee: bob,
      customfield_10016: 8,
      customfield_10015: '2026-07-28',
      duedate: '2026-08-08',
      customfield_10020: sprint('Sprint 3'),
      parent: epicParent('EPIC-2'),
      issuelinks: [relatesTo('STORY-10')],
    },
  },
  {
    key: 'STORY-31',
    fields: {
      summary: 'Search result ranking algorithm',
      issuetype: Story,
      status: toDo,
      priority: high,
      assignee: carol,
      customfield_10016: 13,
      customfield_10015: '2026-08-11',
      duedate: '2026-08-22',
      customfield_10020: sprint('Sprint 3'),
      parent: epicParent('EPIC-2'),
    },
  },
  {
    key: 'STORY-32',
    fields: {
      summary: 'Autocomplete suggestions endpoint',
      issuetype: Story,
      status: inProgress,
      priority: medium,
      assignee: dave,
      customfield_10016: 5,
      customfield_10015: '2026-07-14',
      duedate: '2026-07-28',
      customfield_10020: sprint('Sprint 3'),
      parent: epicParent('EPIC-2'),
      description: adf('Build a /suggest endpoint backed by Elasticsearch.'),
    },
  },

  // ── Tasks under EPIC-1 ─────────────────────────────────────────────────────
  {
    key: 'TASK-20',
    fields: {
      summary: 'Migrate cart DB schema',
      issuetype: Task,
      status: inProgress,
      priority: high,
      assignee: dave,
      customfield_10016: 5,
      customfield_10015: '2026-06-09',
      duedate: '2026-06-20',
      customfield_10020: sprint('Sprint 1'),
      parent: epicParent('EPIC-1'),
      issuelinks: [blocks('TASK-22')],
    },
  },
  {
    key: 'TASK-21',
    fields: {
      summary: 'Set up Stripe webhook handler',
      issuetype: Task,
      status: toDo,
      priority: high,
      assignee: alice,
      customfield_10016: 8,
      customfield_10015: '2026-06-23',
      duedate: '2026-07-04',
      customfield_10020: sprint('Sprint 2'),
      parent: epicParent('EPIC-1'),
    },
  },
  {
    key: 'TASK-22',
    fields: {
      summary: 'Implement payment service adapter',
      issuetype: Task,
      status: toDo,
      priority: high,
      assignee: carol,
      customfield_10016: 8,
      customfield_10015: '2026-06-23',
      duedate: '2026-07-11',
      customfield_10020: sprint('Sprint 2'),
      parent: epicParent('EPIC-1'),
      issuelinks: [isBlockedBy('TASK-20'), blocks('TASK-24')],
    },
  },
  {
    key: 'TASK-23',
    fields: {
      summary: 'Write E2E tests for checkout',
      issuetype: Task,
      status: toDo,
      priority: medium,
      assignee: bob,
      customfield_10016: 5,
      customfield_10015: '2026-07-14',
      duedate: '2026-07-25',
      customfield_10020: sprint('Sprint 2'),
      parent: epicParent('EPIC-1'),
    },
  },
  {
    key: 'TASK-24',
    fields: {
      summary: 'Deploy payment service to staging',
      issuetype: Task,
      status: toDo,
      priority: medium,
      assignee: dave,
      customfield_10016: 3,
      customfield_10015: '2026-07-14',
      duedate: '2026-07-28',
      customfield_10020: sprint('Sprint 2'),
      parent: epicParent('EPIC-1'),
      issuelinks: [isBlockedBy('TASK-22')],
    },
  },

  // ── Subtasks under TASK-20 ─────────────────────────────────────────────────
  {
    key: 'SUB-40',
    fields: {
      summary: 'Write migration script for cart_items table',
      issuetype: Subtask,
      status: done,
      priority: high,
      assignee: dave,
      parent: taskParent('TASK-20'),
    },
  },
  {
    key: 'SUB-41',
    fields: {
      summary: 'Add DB indexes for order lookups',
      issuetype: Subtask,
      status: inProgress,
      priority: medium,
      assignee: alice,
      parent: taskParent('TASK-20'),
    },
  },

  // ── Subtasks under TASK-22 ─────────────────────────────────────────────────
  {
    key: 'SUB-42',
    fields: {
      summary: 'Implement Stripe adapter interface',
      issuetype: Subtask,
      status: toDo,
      priority: high,
      assignee: carol,
      parent: taskParent('TASK-22'),
    },
  },
  {
    key: 'SUB-43',
    fields: {
      summary: 'Unit tests for payment adapter',
      issuetype: Subtask,
      status: toDo,
      priority: medium,
      assignee: bob,
      parent: taskParent('TASK-22'),
    },
  },

  // ── Bugs ──────────────────────────────────────────────────────────────────
  {
    key: 'BUG-50',
    fields: {
      summary: 'Cart total miscalculates with discount codes',
      issuetype: Bug,
      status: inProgress,
      priority: high,
      assignee: alice,
      customfield_10016: 3,
      customfield_10015: '2026-06-09',
      duedate: '2026-06-16',
      customfield_10020: sprint('Sprint 1'),
      parent: epicParent('EPIC-1'),
      issuelinks: [blocks('STORY-11')],
      description: adf('Discount codes applying twice on multi-item carts.'),
    },
  },
  {
    key: 'BUG-51',
    fields: {
      summary: 'Address form clears on validation error',
      issuetype: Bug,
      status: toDo,
      priority: medium,
      assignee: carol,
      parent: epicParent('EPIC-1'),
    },
  },
  {
    key: 'BUG-52',
    fields: {
      summary: 'Search returns stale results after update',
      issuetype: Bug,
      status: toDo,
      priority: high,
      assignee: dave,
      customfield_10015: '2026-07-07',
      duedate: '2026-07-18',
      customfield_10020: sprint('Sprint 3'),
      parent: epicParent('EPIC-2'),
      issuelinks: [blocks('STORY-32')],
    },
  },

  // ── Tasks under EPIC-2 ─────────────────────────────────────────────────────
  {
    key: 'TASK-33',
    fields: {
      summary: 'Index product catalog into Elasticsearch',
      issuetype: Task,
      status: inProgress,
      priority: high,
      assignee: dave,
      customfield_10016: 8,
      customfield_10015: '2026-06-16',
      duedate: '2026-07-04',
      customfield_10020: sprint('Sprint 2'),
      parent: epicParent('EPIC-2'),
    },
  },
  {
    key: 'TASK-34',
    fields: {
      summary: 'Set up Elasticsearch cluster on staging',
      issuetype: Task,
      status: done,
      priority: high,
      assignee: bob,
      customfield_10016: 3,
      parent: epicParent('EPIC-2'),
    },
  },
  {
    key: 'TASK-35',
    fields: {
      summary: 'Load test search endpoint',
      issuetype: Task,
      status: toDo,
      priority: medium,
      assignee: carol,
      customfield_10016: 5,
      customfield_10015: '2026-07-28',
      duedate: '2026-08-08',
      customfield_10020: sprint('Sprint 3'),
      parent: epicParent('EPIC-2'),
      issuelinks: [isBlockedBy('TASK-33')],
    },
  },

  // ── Subtask under TASK-33 ─────────────────────────────────────────────────
  {
    key: 'SUB-60',
    fields: {
      summary: 'Define Elasticsearch index mapping',
      issuetype: Subtask,
      status: done,
      priority: high,
      assignee: dave,
      parent: taskParent('TASK-33'),
    },
  },
];
