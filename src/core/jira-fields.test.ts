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
