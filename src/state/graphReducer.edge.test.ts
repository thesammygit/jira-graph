import { initialState, reducer } from './graphReducer';

test('selectEdge records edge id + click position; clearEdge resets', () => {
  const s = reducer(initialState, { type: 'selectEdge', id: 'link:blocks:A->B', x: 120, y: 80 });
  expect(s.selectedEdge).toEqual({ id: 'link:blocks:A->B', x: 120, y: 80 });
  expect(reducer(s, { type: 'clearEdge' }).selectedEdge).toBeNull();
});

test('selecting a node clears any selected edge', () => {
  const s = reducer(initialState, { type: 'selectEdge', id: 'e1', x: 1, y: 2 });
  expect(reducer(s, { type: 'select', key: 'BUG-40' }).selectedEdge).toBeNull();
});
