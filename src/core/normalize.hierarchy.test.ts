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
  const { edges } = normalizeIssue(raw, base);
  expect(edges).toHaveLength(0);
});
