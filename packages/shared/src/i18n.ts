import type { Locale } from "./constants.js";

export const strings = {
  en: {
    appName: "AdSense smart display",
    healthOk: "Service is healthy",
    unauthorized: "Authentication required",
    notFound: "Not found",
    m1Notice: "This endpoint is reserved for a later milestone.",
  },
  ro: {
    appName: "Display inteligent AdSense",
    healthOk: "Serviciul este disponibil",
    unauthorized: "Autentificarea este necesara",
    notFound: "Nu a fost gasit",
    m1Notice: "Acest endpoint este rezervat pentru un milestone ulterior.",
  },
} satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof typeof strings.en;

export function translate(locale: Locale, key: TranslationKey): string {
  return strings[locale][key];
}
