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

test('linkLevel defaults to all and is settable', () => {
  expect(initialState.linkLevel).toBe('all');
  expect(reducer(initialState, { type: 'setLinkLevel', level: 'story' }).linkLevel).toBe('story');
});

test('breadcrumbs: overview click starts fresh; revisiting a crumb truncates (no duplicates)', () => {
  let s = reducer(initialState, { type: 'openSpotlight', key: 'A' });
  s = reducer(s, { type: 'openSpotlight', key: 'B' });
  s = reducer(s, { type: 'openSpotlight', key: 'C' });
  expect(s.focusHistory).toEqual(['A', 'B']);
  s = reducer(s, { type: 'openSpotlight', key: 'A' });   // revisit a crumb
  expect(s.focusKey).toBe('A');
  expect(s.focusHistory).toEqual([]);                     // truncated back — no dupes
  s = reducer(s, { type: 'openSpotlight', key: 'B' });
  s = reducer({ ...s, viewMode: 'overview' as const }, { type: 'openSpotlight', key: 'C' });
  expect(s.focusHistory).toEqual([]);                     // fresh trail from overview
});

test('done display + label/component toggles', () => {
  expect(initialState.doneDisplay).toBe('normal');
  expect(reducer(initialState, { type: 'setDoneDisplay', mode: 'hide' }).doneDisplay).toBe('hide');
  expect(reducer(initialState, { type: 'toggleLabel', label: 'backend' }).hiddenLabels.has('backend')).toBe(true);
  expect(reducer(initialState, { type: 'toggleComponent', name: 'Payments' }).hiddenComponents.has('Payments')).toBe(true);
});

test('clearFilters resets every hidden set but leaves display prefs alone', () => {
  let s = reducer(initialState, { type: 'toggleProject', key: 'CHK' });
  s = reducer(s, { type: 'toggleLabel', label: 'backend' });
  s = reducer(s, { type: 'setDoneDisplay', mode: 'dim' });
  s = reducer(s, { type: 'clearFilters' });
  expect(s.hiddenProjects.size + s.hiddenLabels.size + s.hiddenTypes.size).toBe(0);
  expect(s.doneDisplay).toBe('dim'); // display pref untouched
});

test('revealInOverview loosens whatever hides the ticket and arms the zoom', () => {
  const node: any = {
    key: 'CHK-9', summary: 's', type: { name: 'Task', kind: 'task' },
    status: { name: 'Done', category: 'done' }, project: { key: 'CHK', name: 'Checkout' },
    assignee: { displayName: 'Sam Brown', initials: 'SB' }, labels: ['backend'], components: [],
  };
  let s = reducer(initialState, { type: 'setGroupDepth', depth: 1 });
  s = reducer(s, { type: 'toggleProject', key: 'CHK' });
  s = reducer(s, { type: 'toggleLabel', label: 'backend' });
  s = reducer(s, { type: 'setDoneDisplay', mode: 'hide' });
  s = reducer(s, { type: 'toggleCollapsed', key: 'CHK-2' });
  s = { ...s, viewMode: 'spotlight' as const };
  s = reducer(s, { type: 'revealInOverview', node, minDepth: 3, ancestors: ['CHK-2', 'CHK-1'] });
  expect(s.viewMode).toBe('overview');
  expect(s.groupDepth).toBe(3);                       // raised to make a task visible
  expect(s.hiddenProjects.has('CHK')).toBe(false);    // project unhidden
  expect(s.hiddenLabels.has('backend')).toBe(false);  // label unhidden
  expect(s.doneDisplay).toBe('dim');                  // done no longer fully hidden
  expect(s.collapsed.has('CHK-2')).toBe(false);       // ancestor expanded
  expect(s.focusKey).toBe('CHK-9');
  expect(s.reveal).toEqual({ key: 'CHK-9', n: 1 });
  // repeat reveal bumps the nonce so the zoom re-fires
  expect(reducer(s, { type: 'revealInOverview', node, minDepth: 3, ancestors: [] }).reveal!.n).toBe(2);
});

test('revealInOverview never LOWERS the Show depth', () => {
  const node: any = {
    key: 'E1', summary: 's', type: { name: 'Epic', kind: 'epic' },
    status: { name: 'To Do', category: 'todo' }, project: { key: 'P', name: 'P' }, labels: [], components: [],
  };
  const s = reducer(initialState, { type: 'revealInOverview', node, minDepth: 1, ancestors: [] });
  expect(s.groupDepth).toBe(4); // stays at the user's deeper setting
});
