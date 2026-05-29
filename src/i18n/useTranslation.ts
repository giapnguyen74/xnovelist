import { useState, useEffect } from 'react';
import en from './ui/en.json';
import vi from './ui/vi.json';

const translations: Record<string, Record<string, string>> = {
  en,
  vi,
};

// In-memory language state — always starts as 'en' so that the initial
// server render and the first client render agree (no hydration mismatch).
// The real persisted value is loaded inside useEffect (client-only).
let globalLang = 'en';
const listeners = new Set<(lang: string) => void>();

export function getLanguage() {
  return globalLang;
}

export function setLanguage(lang: string) {
  if (lang !== 'en' && lang !== 'vi') return;
  globalLang = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem('xnovelist-ui-language', lang);
  }
  listeners.forEach((listener) => listener(lang));
}

export function useTranslation() {
  // Always start with 'en' to match the server-rendered HTML.
  const [lang, setLang] = useState('en');

  useEffect(() => {
    // After mount (client only), load the persisted language and sync.
    const saved = localStorage.getItem('xnovelist-ui-language') || 'en';
    if (saved !== globalLang) {
      globalLang = saved;
    }
    // Update local state so this component re-renders with the right language.
    setLang(globalLang);

    // Subscribe to future language changes triggered by setLanguage().
    const handleLanguageChange = (newLang: string) => {
      setLang(newLang);
    };
    listeners.add(handleLanguageChange);
    return () => {
      listeners.delete(handleLanguageChange);
    };
  }, []);

  const t = (key: keyof typeof en): string => {
    const pack = translations[lang] || en;
    return pack[key] || en[key] || String(key);
  };

  return { t, lang, setLang: setLanguage };
}
