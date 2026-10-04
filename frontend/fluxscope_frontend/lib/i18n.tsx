"use client";

import { createContext, useContext } from "react";

export type Language = "en" | "ur";

const LanguageContext = createContext<Language>("en");

export const LanguageProvider = LanguageContext.Provider;

export function useLanguage(): Language {
  return useContext(LanguageContext);
}

/** Returns a picker for an English/Urdu pair; English strings stay as written. */
export function useT(): (en: string, ur: string) => string {
  const language = useLanguage();
  return (en, ur) => (language === "ur" ? ur : en);
}
