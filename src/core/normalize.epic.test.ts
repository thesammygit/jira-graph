import { normalizeIssues } from './normalize';
import type { Capabilities } from './model';
const caps: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false };
function iss(key: string, kind: string, parent?: string, parentKind?: string) {
  return { key, fields: { summary: key + ' sum', issuetype: { name: kind, subtask: kind === 'Sub-task' }, status: {},
    project: { key: 'P', name: 'P' },
    ...(parent ? { parent: { key: parent, fields: { issuetype: { name: parentKind, subtask: false } } } } : {}) } };
}

test('descendants get epicKey + epicSummary from their epic ancestor', () => {
  const g = normalizeIssues([
    iss('EPIC-1', 'Epic'),
    iss('STORY-1', 'Story', 'EPIC-1', 'Epic'),
    iss('TASK-1', 'Task', 'STORY-1', 'Story'),
    iss('SUB-1', 'Sub-task', 'TASK-1', 'Task'),
  ], caps);
  const byKey = Object.fromEntries(g.nodes.map((n) => [n.key, n]));
  expect(byKey['TASK-1'].epicKey).toBe('EPIC-1');
  expect(byKey['SUB-1'].epicKey).toBe('EPIC-1');
  expect(byKey['STORY-1'].epicSummary).toBe('EPIC-1 sum');
  expect(byKey['EPIC-1'].epicKey).toBeUndefined(); // an epic has no epic
});
