import { nextTheme, initialTheme } from './useTheme';

test('nextTheme toggles', () => {
  expect(nextTheme('dark')).toBe('light');
  expect(nextTheme('light')).toBe('dark');
});

test('initialTheme prefers a stored value, else falls back to dark', () => {
  expect(initialTheme('light')).toBe('light');
  expect(initialTheme('dark')).toBe('dark');
  expect(initialTheme(null)).toBe('dark');
  expect(initialTheme('garbage')).toBe('dark');
});
