'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from './en.json';
import hi from './hi.json';
import mr from './mr.json';

export type Lang = 'en' | 'hi' | 'mr';
type Dictionary = typeof en;
const dictionaries: Record<Lang, Dictionary> = { en, hi, mr };

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: keyof Dictionary) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem('mplad-language') as Lang | null;
    if (stored && stored in dictionaries) setLangState(stored);
  }, []);

  const value = useMemo<LangContextValue>(() => ({
    lang,
    setLang: (next) => {
      setLangState(next);
      window.localStorage.setItem('mplad-language', next);
    },
    t: (key) => dictionaries[lang][key] || dictionaries.en[key] || key,
  }), [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const value = useContext(LangContext);
  if (!value) throw new Error('useLang must be used within LangProvider');
  return value;
}
