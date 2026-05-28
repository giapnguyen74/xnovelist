import { useState, useEffect } from 'react';
import en from './ui/en.json';
import vi from './ui/vi.json';

const translations: Record<string, Record<string, string>> = {
  en,
  vi,
};

let globalLang = 'en';
const listeners = new Set<(lang: string) => void>();

export function getLanguage() {
  return globalLang;
}

export function setLanguage(lang: string) {
  if (lang !== 'en' && lang !== 'vi') return;
  globalLang = lang;
  listeners.forEach((listener) => listener(lang));
}

export function useTranslation() {
  const [lang, setLang] = useState(globalLang);

  useEffect(() => {
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
