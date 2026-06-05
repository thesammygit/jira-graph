import { isNodeVisible } from './visible';
function node(over: any = {}): any { return { key: 'K', type: { kind: 'task' }, status: { category: 'todo' }, project: { key: 'CHK', name: 'C' }, assignee: { displayName: 'Sam' }, ...over }; }
const base = { hiddenTypes: new Set(), hiddenStatuses: new Set(), hiddenProjects: new Set(), hiddenAssignees: new Set() };

test('visible by default', () => { expect(isNodeVisible(node(), base as any)).toBe(true); });
test('hidden by type/status/project/assignee', () => {
  expect(isNodeVisible(node(), { ...base, hiddenTypes: new Set(['task']) } as any)).toBe(false);
  expect(isNodeVisible(node(), { ...base, hiddenStatuses: new Set(['todo']) } as any)).toBe(false);
  expect(isNodeVisible(node(), { ...base, hiddenProjects: new Set(['CHK']) } as any)).toBe(false);
  expect(isNodeVisible(node(), { ...base, hiddenAssignees: new Set(['Sam']) } as any)).toBe(false);
});
test('unassigned matches the __unassigned__ key', () => {
  expect(isNodeVisible(node({ assignee: undefined }), { ...base, hiddenAssignees: new Set(['__unassigned__']) } as any)).toBe(false);
});
