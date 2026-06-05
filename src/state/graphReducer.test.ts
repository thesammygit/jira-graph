import { initialState, reducer } from './graphReducer';

test('setLayout switches layout', () => {
  const s = reducer(initialState, { type: 'setLayout', layout: 'force' });
  expect(s.layout).toBe('force');
});

test('setFocus enters focus mode and records the key', () => {
  const s = reducer(initialState, { type: 'setFocus', key: 'STORY-10' });
  expect(s.mode).toBe('focus');
  expect(s.focusKey).toBe('STORY-10');
});

test('setMode back to map clears focus', () => {
  const focused = reducer(initialState, { type: 'setFocus', key: 'STORY-10' });
  const s = reducer(focused, { type: 'setMode', mode: 'map' });
  expect(s.mode).toBe('map');
  expect(s.focusKey).toBeNull();
});

test('setDepth clamps to >= 0', () => {
  expect(reducer(initialState, { type: 'setDepth', depth: -3 }).depth).toBe(0);
  expect(reducer(initialState, { type: 'setDepth', depth: 4 }).depth).toBe(4);
});

test('toggleType adds and removes a hidden issue kind', () => {
  const hidden = reducer(initialState, { type: 'toggleType', kind: 'bug' });
  expect(hidden.hiddenTypes.has('bug')).toBe(true);
  const shown = reducer(hidden, { type: 'toggleType', kind: 'bug' });
  expect(shown.hiddenTypes.has('bug')).toBe(false);
});

test('select records the selected key', () => {
  expect(reducer(initialState, { type: 'select', key: 'BUG-40' }).selectedKey).toBe('BUG-40');
});
