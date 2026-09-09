'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    // MPLAD Radar is intentionally a dark command center. Ignore any legacy
    // light-mode preference so there is no theme flash or alternate palette.
    setThemeState('dark');
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
    window.localStorage.setItem('mplad-theme', 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
    if (typeof window !== 'undefined') window.localStorage.setItem('mplad-theme', 'dark');
  }, [theme]);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      setTheme: () => setThemeState('dark'),
      toggle: () => setThemeState('dark'),
    }),
    [theme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
