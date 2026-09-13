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
  isMuted: boolean;
  toggleMute: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('mplad-theme');
    const storedMute = window.localStorage.getItem('mplad-sound-muted');
    if (storedMute === 'true' || storedMute === 'false') setIsMuted(storedMute === 'true');
    if (stored === 'light' || stored === 'dark') {
      setThemeState(stored);
    } else {
      setThemeState(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    window.localStorage.setItem('mplad-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('mplad-sound-muted', String(isMuted));
  }, [isMuted]);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggle: () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
      isMuted,
      toggleMute: () => setIsMuted((current) => !current),
    }),
    [theme, isMuted],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
