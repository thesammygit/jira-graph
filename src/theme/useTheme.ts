import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'jira-graph-theme';

export function nextTheme(t: Theme): Theme { return t === 'dark' ? 'light' : 'dark'; }

export function initialTheme(stored: string | null): Theme {
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() =>
    initialTheme(typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null));
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  return { theme, toggle: () => setTheme(nextTheme) };
}
