import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  API_PATHS,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  translate,
  type Locale,
  type TranslationKey,
} from "@adsense/shared";
import "./styles.css";
import { getApiState, type ApiState } from "./status.js";

type Route = "dashboard" | "displays" | "configuration" | "media" | "leads" | "stats" | "help" | "account" | "offer" | "privacy";
const routeKeys: Record<Exclude<Route, "offer" | "privacy">, TranslationKey> = {
  dashboard: "dashboard",
  displays: "displays",
  configuration: "configuration",
  media: "media",
  leads: "leads",
  stats: "stats",
  help: "help",
  account: "account",
};

function routeFromLocation(): Route {
  const path = window.location.pathname.replace(/\/+$/u, "") || "/";
  if (path === "/offer") return "offer";
  if (path === "/privacy") return "privacy";
  const hash = window.location.hash.replace(/^#\/?/u, "") as Route;
  return hash in routeKeys ? hash : "dashboard";
}

function useRoute() {
  const [route, setRoute] = useState<Route>(routeFromLocation);
  useEffect(() => {
    const update = () => setRoute(routeFromLocation());
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return route;
}

function useLocale() {
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = window.localStorage.getItem("adsense-locale");
    return stored === "en" || stored === "ro" ? stored : DEFAULT_LOCALE;
  });
  const change = (next: Locale) => {
    window.localStorage.setItem("adsense-locale", next);
    setLocale(next);
  };
  return [locale, change] as const;
}

function PublicPage({ locale, title, body, cta }: { locale: Locale; title: TranslationKey; body: TranslationKey; cta?: TranslationKey }) {
  const t = (key: TranslationKey) => translate(locale, key);
  return <main className="public-shell"><a className="skip-link" href="#content">{t("backToApp")}</a><section className="public-card" id="content"><p className="eyebrow">{t("publicPage")}</p><h1>{t(title)}</h1><p className="lead">{t(body)}</p>{cta && <button className="button primary" disabled>{t(cta)}</button>}<p><a href="/">{t("backToApp")}</a></p></section></main>;
}

function LoginShell({ locale }: { locale: Locale }) {
  const t = (key: TranslationKey) => translate(locale, key);
  const [notice, setNotice] = useState(false);
  return <main className="login-shell"><section className="login-card"><div className="brand-mark">A</div><p className="eyebrow">{t("appName")}</p><h1>{t("login")}</h1><p className="muted">{t("loginUnavailable")}</p><form onSubmit={(event) => { event.preventDefault(); setNotice(true); }}><label>{t("email")}<input type="email" required autoComplete="email" /></label><label>{t("password")}<input type="password" required autoComplete="current-password" /></label><button className="button primary" type="submit">{t("signIn")}</button></form>{notice && <p className="notice" role="status">{t("loginUnavailable")}</p>}</section></main>;
}

function App() {
  const route = useRoute();
  const [locale, setLocale] = useLocale();
  const t = (key: TranslationKey) => translate(locale, key);
  useEffect(() => { document.documentElement.lang = locale; document.title = t("appName"); }, [locale]);
  if (route === "offer") return <PublicPage locale={locale} title="offerTitle" body="offerBody" cta="offerCta" />;
  if (route === "privacy") return <PublicPage locale={locale} title="privacyTitle" body="privacyBody" />;
  return <Dashboard locale={locale} setLocale={setLocale} route={route} t={t} />;
}

function Dashboard({ locale, setLocale, route, t }: { locale: Locale; setLocale: (locale: Locale) => void; route: Route; t: (key: TranslationKey) => string }) {
  const [loggedIn, setLoggedIn] = useState(true);
  const [health, setHealth] = useState<ApiState>("loading");
  useEffect(() => { void getApiState(() => fetch(API_PATHS.health)).then(setHealth); }, []);
  const nav = useMemo(() => Object.entries(routeKeys) as [Exclude<Route, "offer" | "privacy">, TranslationKey][], []);
  if (!loggedIn) return <LoginShell locale={locale} />;
  return <div className="app-shell"><a className="skip-link" href="#content">{t("skipToContent")}</a><aside className="sidebar"><div className="brand"><div className="brand-mark">A</div><div><strong>{t("appName")}</strong><span>{t("workspace")}</span></div></div><p className="nav-label">{t("navigation")}</p><nav aria-label={t("navigation")}>{nav.map(([key, label]) => <a className={route === key ? "active" : ""} href={`#/${key}`} key={key}>{t(label)}</a>)}</nav><div className="sidebar-bottom"><a href="/privacy">{t("privacyTitle")}</a><button className="text-button" onClick={() => setLoggedIn(false)}>{t("signOut")}</button></div></aside><main className="content" id="content"><header className="topbar"><div><p className="eyebrow">{t("appName")}</p><h1>{t(routeKeys[route as Exclude<Route, "offer" | "privacy">] ?? "dashboard")}</h1></div><label className="language-select">{t("language")}<select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>{SUPPORTED_LOCALES.map((item) => <option value={item} key={item}>{t(item === "ro" ? "romanian" : "english")}</option>)}</select></label></header><PageContent route={route} t={t} health={health} /></main></div>;
}

function PageContent({ route, t, health }: { route: Route; t: (key: TranslationKey) => string; health: ApiState }) {
  if (route === "dashboard") return <><section className="hero"><p className="eyebrow">{t("welcome")}</p><p className="lead">{t("dashboardIntro")}</p></section><div className="metric-grid">{[["activeDisplays", "0"], ["pendingLeads", "0"], ["impressions", "-"], ["conversionRate", "-"]].map(([label, value]) => <article className="metric-card" key={label}><span>{t(label as TranslationKey)}</span><strong>{value}</strong></article>)}</div><section className="panel-grid"><article className="panel"><div className="panel-heading"><h2>{t("serviceStatus")}</h2><span className={`status-dot ${health}`}>{health === "healthy" ? t("healthy") : health === "loading" ? "..." : t("unavailable")}</span></div><p>{health === "healthy" ? t("healthOk") : t("endpointReservedDetail")}</p></article><article className="panel"><h2>{t("recentActivity")}</h2><p className="muted">{t("noActivity")}</p></article></section></>;
  const descriptions: Partial<Record<Route, TranslationKey>> = { displays: "displaysIntro", configuration: "configurationIntro", media: "mediaIntro", leads: "leadsIntro", stats: "statsIntro", help: "helpIntro", account: "accountIntro" };
  return <section className="page-section"><p className="lead">{t(descriptions[route] ?? "dashboardIntro")}</p>{route === "displays" && <div className="panel"><h2>{t("unsupportedBluetooth")}</h2><p>{t("unsupportedBluetoothDetail")}</p><p className="notice">{t("endpointReservedDetail")}</p></div>}{route !== "displays" && <div className="panel empty-state"><h2>{t("comingSoon")}</h2><p>{t("endpointReserved")}</p><button className="button secondary" disabled>{t("save")}</button></div>}</section>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
