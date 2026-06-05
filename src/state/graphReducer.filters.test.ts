import { initialState, reducer } from './graphReducer';

test('default groupDepth is 4 (full nesting), filters empty', () => {
  expect(initialState.groupDepth).toBe(4);
  expect(initialState.hiddenProjects.size).toBe(0);
  expect(initialState.hiddenAssignees.size).toBe(0);
  expect(initialState.nodePopup).toBeNull();
});
test('toggleProject / toggleAssignee', () => {
  const a = reducer(initialState, { type: 'toggleProject', key: 'CHK' });
  expect(a.hiddenProjects.has('CHK')).toBe(true);
  expect(reducer(a, { type: 'toggleProject', key: 'CHK' }).hiddenProjects.has('CHK')).toBe(false);
  const b = reducer(initialState, { type: 'toggleAssignee', name: 'Sam' });
  expect(b.hiddenAssignees.has('Sam')).toBe(true);
});
test('openNode sets popup; closeNode + setFocus clear it', () => {
  const o = reducer(initialState, { type: 'openNode', key: 'CHK-1', x: 10, y: 20 });
  expect(o.nodePopup).toEqual({ key: 'CHK-1', x: 10, y: 20 });
  expect(reducer(o, { type: 'closeNode' }).nodePopup).toBeNull();
  expect(reducer(o, { type: 'setFocus', key: 'CHK-1' }).nodePopup).toBeNull();
});
