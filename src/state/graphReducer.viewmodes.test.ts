import { initialState, reducer } from './graphReducer';

test('defaults: graph mode, depth 2, nothing collapsed', () => {
  expect(initialState.viewMode).toBe('graph');
  expect(initialState.groupDepth).toBe(4);
  expect(initialState.collapsed.size).toBe(0);
});

test('setViewMode switches the active view', () => {
  expect(reducer(initialState, { type: 'setViewMode', viewMode: 'grouped' }).viewMode).toBe('grouped');
});

test('setGroupDepth sets the nesting depth', () => {
  expect(reducer(initialState, { type: 'setGroupDepth', depth: 3 }).groupDepth).toBe(3);
});

test('toggleCollapsed adds then removes a container key', () => {
  const a = reducer(initialState, { type: 'toggleCollapsed', key: 'EPIC-1' });
  expect(a.collapsed.has('EPIC-1')).toBe(true);
  const b = reducer(a, { type: 'toggleCollapsed', key: 'EPIC-1' });
  expect(b.collapsed.has('EPIC-1')).toBe(false);
});
