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
