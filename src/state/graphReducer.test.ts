import { initialState, reducer } from './graphReducer';

test('defaults: overview, depth 4, empty history/filters', () => {
  expect(initialState.viewMode).toBe('overview');
  expect(initialState.groupDepth).toBe(4);
  expect(initialState.focusHistory).toEqual([]);
  expect(initialState.focusKey).toBeNull();
});

test('openSpotlight from overview enters spotlight without pushing history', () => {
  const s = reducer(initialState, { type: 'openSpotlight', key: 'A' });
  expect(s.viewMode).toBe('spotlight');
  expect(s.focusKey).toBe('A');
  expect(s.focusHistory).toEqual([]);
  expect(s.selectedKey).toBe('A');
});

test('openSpotlight while already spotlighting pushes the previous hero', () => {
  const a = reducer(initialState, { type: 'openSpotlight', key: 'A' });
  const b = reducer(a, { type: 'openSpotlight', key: 'B' });
  expect(b.focusKey).toBe('B');
  expect(b.focusHistory).toEqual(['A']);
});

test('spotlightBack pops to the previous hero, then to overview', () => {
  let s = reducer(initialState, { type: 'openSpotlight', key: 'A' });
  s = reducer(s, { type: 'openSpotlight', key: 'B' });
  s = reducer(s, { type: 'spotlightBack' });
  expect(s.focusKey).toBe('A');
  expect(s.focusHistory).toEqual([]);
  s = reducer(s, { type: 'spotlightBack' });
  expect(s.viewMode).toBe('overview');
});

test('setViewMode, group depth, filters, select, selectEdge', () => {
  expect(reducer(initialState, { type: 'setViewMode', viewMode: 'spotlight' }).viewMode).toBe('spotlight');
  expect(reducer(initialState, { type: 'setGroupDepth', depth: 2 }).groupDepth).toBe(2);
  expect(reducer(initialState, { type: 'toggleProject', key: 'CHK' }).hiddenProjects.has('CHK')).toBe(true);
  expect(reducer(initialState, { type: 'toggleAssignee', name: 'Sam' }).hiddenAssignees.has('Sam')).toBe(true);
  expect(reducer(initialState, { type: 'toggleType', kind: 'bug' }).hiddenTypes.has('bug')).toBe(true);
  expect(reducer(initialState, { type: 'toggleCollapsed', key: 'E' }).collapsed.has('E')).toBe(true);
  const e = reducer(initialState, { type: 'selectEdge', id: 'x', x: 1, y: 2, srcKey: 'A', tgtKey: 'B', relation: 'blocks', label: 'blocks' });
  expect(e.selectedEdge?.id).toBe('x');
  expect(reducer(e, { type: 'clearEdge' }).selectedEdge).toBeNull();
});
