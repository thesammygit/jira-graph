import { isNodeVisible } from './visible';
function node(over: any = {}): any { return { key: 'K', type: { kind: 'task' }, status: { category: 'todo' }, project: { key: 'CHK', name: 'C' }, assignee: { displayName: 'Sam' }, ...over }; }
const base = { onlyTypes: new Set(), hiddenStatuses: new Set(), onlyProjects: new Set(), onlyAssignees: new Set(), onlyLabels: new Set(), onlyComponents: new Set(), doneDisplay: 'normal' as const };

test('everything visible when nothing is selected (opt-in filters)', () => {
  expect(isNodeVisible(node(), base as any)).toBe(true);
});

test('selections narrow: matching values stay, everything else hides', () => {
  expect(isNodeVisible(node(), { ...base, onlyTypes: new Set(['task']) } as any)).toBe(true);
  expect(isNodeVisible(node(), { ...base, onlyTypes: new Set(['epic']) } as any)).toBe(false);
  expect(isNodeVisible(node(), { ...base, onlyProjects: new Set(['CHK']) } as any)).toBe(true);
  expect(isNodeVisible(node(), { ...base, onlyProjects: new Set(['MOB']) } as any)).toBe(false);
  expect(isNodeVisible(node(), { ...base, onlyAssignees: new Set(['Sam']) } as any)).toBe(true);
  expect(isNodeVisible(node(), { ...base, onlyAssignees: new Set(['Ada']) } as any)).toBe(false);
  expect(isNodeVisible(node(), { ...base, hiddenStatuses: new Set(['todo']) } as any)).toBe(false);
});

test('unassigned matches the __unassigned__ key', () => {
  expect(isNodeVisible(node({ assignee: undefined }), { ...base, onlyAssignees: new Set(['__unassigned__']) } as any)).toBe(true);
  expect(isNodeVisible(node({ assignee: undefined }), { ...base, onlyAssignees: new Set(['Sam']) } as any)).toBe(false);
});

test('label/component selections match ANY tag; untagged tickets cannot match', () => {
  const tagged = node({ labels: ['backend', 'api'], components: ['Payments'] });
  expect(isNodeVisible(tagged, { ...base, onlyLabels: new Set(['backend']) } as any)).toBe(true);
  expect(isNodeVisible(tagged, { ...base, onlyLabels: new Set(['ux']) } as any)).toBe(false);
  expect(isNodeVisible(tagged, { ...base, onlyComponents: new Set(['Payments']) } as any)).toBe(true);
  expect(isNodeVisible(node({}), { ...base, onlyLabels: new Set(['backend']) } as any)).toBe(false); // untagged hidden by active tag selection
});

test('done hides on doneDisplay=hide only', () => {
  const done = node({ status: { category: 'done' } });
  expect(isNodeVisible(done, { ...base, doneDisplay: 'hide' } as any)).toBe(false);
  expect(isNodeVisible(done, { ...base, doneDisplay: 'strike' } as any)).toBe(true);
});
