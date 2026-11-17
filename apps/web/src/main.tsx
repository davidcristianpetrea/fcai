import { StrictMode, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
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

type Route = "dashboard" | "displays" | "media" | "leads" | "stats" | "help" | "account" | "offer" | "privacy";
const routeKeys: Partial<Record<Exclude<Route, "offer" | "privacy">, TranslationKey>> = {
  dashboard: "dashboard",
  displays: "displays",
  media: "media",
  leads: "leads",
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

function OfferPage({ locale }: { locale: Locale }) {
  const t = (key: TranslationKey) => translate(locale, key);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [offerInfo, setOfferInfo] = useState<{ headline?: string; subtext?: string; displayName?: string } | null>(null);
  const deviceId = useMemo(() => new URLSearchParams(window.location.search).get("d") || "", []);

  useEffect(() => {
    fetch(`/api/public/offer${deviceId ? `?d=${encodeURIComponent(deviceId)}` : ""}`)
      .then((r) => r.json())
      .then((data) => setOfferInfo(data))
      .catch(() => {});
  }, [deviceId]);

  if (sent) {
    return (
      <main className="public-shell">
        <section className="public-card text-center">
          <div className="success-icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>✓</div>
          <p className="eyebrow">{locale === "ro" ? "Confirmare" : "Confirmation"}</p>
          <h1>{locale === "ro" ? "Mulțumim! Oferta ta a fost înregistrată." : "Thank you! Your offer has been claimed."}</h1>
          <p className="lead" style={{ marginTop: "1rem" }}>
            {locale === "ro" ? "Vei primi detaliile pe email în curând." : "You will receive the details by email shortly."}
          </p>
        </section>
      </main>
    );
  }

  const headline = offerInfo?.headline || t("offerTitle");
  const subtext = offerInfo?.subtext || t("offerCta");

  return (
    <main className="public-shell">
      <section className="public-card">
        <p className="eyebrow">{offerInfo?.displayName || t("publicPage")}</p>
        <h1>{headline}</h1>
        <p className="lead">{subtext}</p>
        <form
          className="offer-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const response = await fetch("/api/leads", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: form.get("name"),
                email: form.get("email"),
                consent: form.get("consent") === "on",
                website: form.get("website"),
                deviceId: deviceId || undefined,
              }),
            });
            if (response.ok) {
              setSent(true);
            } else {
              setNotice(t("offerRequired"));
            }
          }}
        >
          <label>
            {t("offerName")}
            <input name="name" required placeholder={locale === "ro" ? "Ion Popescu" : "John Doe"} />
          </label>
          <label>
            {t("offerEmail")}
            <input name="email" type="email" required placeholder="exemplu@email.com" />
          </label>
          <label className="honeypot" aria-hidden="true" style={{ display: "none" }}>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="consent" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input name="consent" type="checkbox" required />
            <span>{t("offerConsent")}</span>
          </label>
          <button className="button primary" type="submit" style={{ marginTop: "1rem" }}>
            {t("offerSubmit")}
          </button>
          {notice && <p className="notice">{notice}</p>}
        </form>
      </section>
    </main>
  );
}

function LoginShell({ locale }: { locale: Locale }) {
  const t = (key: TranslationKey) => translate(locale, key);
  const [notice, setNotice] = useState("");
  return <main className="login-shell"><section className="login-card"><div className="brand-mark">A</div><p className="eyebrow">{t("appName")}</p><h1>{t("login")}</h1><p className="muted">{t("loginUnavailable")}</p><form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) }); if (!response.ok) { setNotice(t("loginUnavailable")); return; } const payload = await response.json() as { token: string }; window.localStorage.setItem("adsense-session", payload.token); window.location.reload(); }}><label>{t("email")}<input name="username" required autoComplete="username" /></label><label>{t("password")}<input name="password" type="password" required autoComplete="current-password" /></label><button className="button primary" type="submit">{t("signIn")}</button></form>{notice && <p className="notice" role="status">{notice}</p>}</section></main>;
}

function authHeaders(): HeadersInit {
  const token = window.localStorage.getItem("adsense-session");
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function digestFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function MediaUploader({ locale }: { locale: Locale }) {
  const t = (key: TranslationKey) => translate(locale, key);
  const [items, setItems] = useState<{ name: string; progress: number; done: boolean; error?: string }[]>([]);
  const [assets, setAssets] = useState<{ id: string; filename: string; size_bytes: number }[]>([]);
  const refresh = () => { void fetch("/api/assets", { headers: authHeaders() }).then((response) => response.ok ? response.json() as Promise<{ assets: typeof assets }> : { assets: [] }).then((payload) => setAssets(payload.assets)); };
  useEffect(refresh, []);
  const upload = async (file: File, itemIndex: number) => {
    try {
      if (file.size > 2 * 1024 * 1024 * 1024) throw new Error("upload_too_large");
      const created = await fetch("/api/assets", { method: "POST", headers: { ...authHeaders(), "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }) });
      if (!created.ok) throw new Error("upload_failed");
      const asset = await created.json() as { assetId: string; uploadUrl: string; chunkBytes: number };
      const uploadUrl = new URL(asset.uploadUrl, window.location.origin);
      const token = uploadUrl.searchParams.get("token") ?? "";
      const chunkBytes = asset.chunkBytes;
      const totalChunks = Math.ceil(file.size / chunkBytes);
      const status = await fetch(`/api/assets/${asset.assetId}/upload-status?token=${encodeURIComponent(token)}`, { headers: authHeaders() });
      const statusPayload = status.ok ? await status.json() as { nextIndex: number } : { nextIndex: 0 };
      let nextIndex = statusPayload.nextIndex;
      while (nextIndex < totalChunks) {
        const index = nextIndex;
        const chunk = file.slice(index * chunkBytes, Math.min(file.size, (index + 1) * chunkBytes));
        let sent = false;
        for (let attempt = 0; attempt < 3 && !sent; attempt++) {
          const response = await fetch(`/api/assets/${asset.assetId}/chunks/${index}?token=${encodeURIComponent(token)}`, { method: "PUT", headers: authHeaders(), body: chunk });
          sent = response.ok;
          if (!sent && response.status === 409) {
            const latest = await fetch(`/api/assets/${asset.assetId}/upload-status?token=${encodeURIComponent(token)}`, { headers: authHeaders() });
            nextIndex = (await latest.json() as { nextIndex: number }).nextIndex;
            break;
          }
        }
        if (!sent) throw new Error("upload_failed");
        nextIndex++;
        setItems((current) => current.map((item, indexToUpdate) => indexToUpdate === itemIndex ? { ...item, progress: Math.round(nextIndex / totalChunks * 100) } : item));
      }
      const sha256 = await digestFile(file);
      const complete = await fetch(`/api/assets/${asset.assetId}/complete?token=${encodeURIComponent(token)}`, { method: "POST", headers: { ...authHeaders(), "content-type": "application/json" }, body: JSON.stringify({ totalSize: file.size, sha256 }) });
      if (!complete.ok) throw new Error((await complete.json().catch(() => ({})) as { error?: string }).error ?? "upload_failed");
      setItems((current) => current.map((item, indexToUpdate) => indexToUpdate === itemIndex ? { ...item, progress: 100, done: true } : item));
      refresh();
    } catch (error) {
      setItems((current) => current.map((item, indexToUpdate) => indexToUpdate === itemIndex ? { ...item, error: error instanceof Error && error.message === "upload_too_large" ? t("uploadTooLarge") : t("uploadFailed") } : item));
    }
  };
  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setItems(files.map((file) => ({ name: file.name, progress: 0, done: false })));
    files.forEach((file, index) => void upload(file, index));
  };
  return <div className="panel media-uploader"><label className="button primary file-picker">{t("chooseFiles")}<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm,video/x-matroska,image/gif" onChange={chooseFiles} /></label>{items.map((item) => <div className="upload-row" key={item.name}><div className="upload-heading"><span>{item.name}</span><strong>{item.error ?? (item.done ? t("uploadDone") : `${item.progress}%`)}</strong></div><progress max="100" value={item.progress} /></div>)}<div className="asset-list">{assets.map((asset) => <div className="upload-heading" key={asset.id}><span>{asset.filename}</span><button className="text-button" onClick={() => { void fetch(`/api/assets/${asset.id}`, { method: "DELETE", headers: authHeaders() }).then(refresh); }}>{t("delete")}</button></div>)}</div></div>;
}

function DisplaysPanel({ locale }: { locale: Locale }) {
  const t = (key: TranslationKey) => translate(locale, key);
  const [devices, setDevices] = useState<{ id: string; name: string; online: boolean; last_seen_at?: string }[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = () => { void fetch("/api/devices", { headers: authHeaders() }).then((response) => response.json() as Promise<{ devices: typeof devices }>).then((payload) => setDevices(payload.devices)); };
  useEffect(refresh, []);
  const pair = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/devices/pair", { method: "POST", headers: { ...authHeaders(), "content-type": "application/json" }, body: JSON.stringify({ code, name }) });
    if (!response.ok) { setNotice(locale === "ro" ? "Codul nu este valid sau a expirat." : "That code is invalid or expired."); return; }
    setNotice(locale === "ro" ? "Ecranul a fost adaugat." : "Display added.");
    setCode(""); setName(""); refresh();
  };
  return <div className="panel-grid"><section className="panel"><h2>{locale === "ro" ? "Adaugă ecran" : "Add display"}</h2><p>{locale === "ro" ? "Introdu codul afișat pe televizor." : "Enter the code shown on the TV."}</p><form className="offer-form" onSubmit={pair}><label>{locale === "ro" ? "Cod din 6 cifre" : "6-digit code"}<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /></label><label>{locale === "ro" ? "Numele ecranului" : "Display name"}<input value={name} placeholder={`Ecran ${devices.length + 1}`} onChange={(event) => setName(event.target.value)} /></label><button className="button primary" type="submit">{locale === "ro" ? "Adaugă" : "Add"}</button>{notice && <p className="notice">{notice}</p>}</form></section><section className="panel"><h2>{t("displays")}</h2>{devices.length === 0 ? <p>{t("noActivity")}</p> : devices.map((device) => <a className="upload-heading display-row" href="#/displays" key={device.id}><span><strong>{device.name}</strong><small>{device.last_seen_at ? `Ultima conectare: ${new Date(device.last_seen_at).toLocaleString(locale === "ro" ? "ro-RO" : "en-US")}` : "Nu s-a conectat încă"}</small></span><strong className={device.online ? "online" : "offline"}>{device.online ? "Online" : "Offline"}</strong></a>)}</section></div>;
}

function LeadsPanel({ locale }: { locale: Locale }) {
  const t = (key: TranslationKey) => translate(locale, key);
  const [leads, setLeads] = useState<{ id: string; name: string; email: string; created_at: string }[]>([]);
  const [query, setQuery] = useState("");
  const refresh = () => { void fetch("/api/leads", { headers: authHeaders() }).then((response) => response.json() as Promise<{ leads: typeof leads }>).then((payload) => setLeads(payload.leads)); };
  useEffect(refresh, []);
  const visible = leads.filter((lead) => `${lead.name} ${lead.email}`.toLowerCase().includes(query.toLowerCase()));
  const exportCsv = () => { const csv = ["name,email,created_at", ...visible.map((lead) => [lead.name, lead.email, lead.created_at].map((value) => `"${value.replaceAll('"', '""')}"`).join(","))].join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "leads.csv"; link.click(); URL.revokeObjectURL(link.href); };
  return <section className="panel"><div className="panel-heading"><h2>{t("leads")}</h2><button className="button secondary" onClick={exportCsv}>{t("exportCsv")}</button></div><input className="search-input" placeholder={t("search")} value={query} onChange={(event) => setQuery(event.target.value)} />{visible.length === 0 ? <p>{t("noLeads")}</p> : visible.map((lead) => <div className="upload-heading" key={lead.id}><span>{lead.name} · {lead.email}</span><button className="text-button" onClick={() => { void fetch(`/api/leads/${lead.id}`, { method: "DELETE", headers: authHeaders() }).then(refresh); }}>{t("delete")}</button></div>)}</section>;
}

function ConfigurationPanel() {
  const [devices, setDevices] = useState<{ id: string; name: string; config: Record<string, unknown> }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [tab, setTab] = useState<"experience" | "standby" | "offer">("experience");
  const [config, setConfig] = useState<Record<string, unknown>>({ template: "simple", liveFaces: true, lookTime: 3, standbyDuration: 8, standbyEnabled: true, transition: "auto", transitionSpeed: 1, offerLink: "https://adsense.davidpetrea.ro/offer", headline: "", subtext: "", caption: "aici poza cu mâncare", qrSize: 220, offerBackground: "#111827", playlist: [] });
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState("");
  const [assets, setAssets] = useState<{ id: string; filename: string }[]>([]);
  const refresh = () => { void fetch("/api/devices", { headers: authHeaders() }).then((response) => response.json() as Promise<{ devices: typeof devices }>).then((payload) => { setDevices(payload.devices); if (!deviceId && payload.devices[0]) { setDeviceId(payload.devices[0].id); setConfig({ ...config, ...payload.devices[0].config }); } }); };
  useEffect(() => { refresh(); void fetch("/api/assets", { headers: authHeaders() }).then((response) => response.json() as Promise<{ assets: typeof assets }>).then((payload) => setAssets(payload.assets)); }, []);
  const update = (key: string, value: unknown) => { setSaved(false); setConfig((current) => ({ ...current, [key]: value })); };
  const publish = async () => { if (!deviceId) return; const response = await fetch(`/api/devices/${deviceId}/config`, { method: "POST", headers: { ...authHeaders(), "content-type": "application/json" }, body: JSON.stringify(config) }); if (response.ok) { setSaved(true); setNotice("Publicat"); setTimeout(() => setNotice(""), 2500); } };
  return <section className="panel configuration-panel"><div className="panel-heading"><h2>Configurarea afișajului</h2>{notice && <span className="notice">{notice}</span>}</div><label>Afișaj<select value={deviceId} onChange={(event) => { const id = event.target.value; setDeviceId(id); const selected = devices.find((device) => device.id === id); if (selected) setConfig({ ...config, ...selected.config }); }}>{devices.map((device) => <option value={device.id} key={device.id}>{device.name}</option>)}</select></label><div className="tabs"><button className={tab === "experience" ? "active" : ""} onClick={() => setTab("experience")}>Experiență</button><button className={tab === "standby" ? "active" : ""} onClick={() => setTab("standby")}>Standby</button><button className={tab === "offer" ? "active" : ""} onClick={() => setTab("offer")}>Ofertă</button></div>{tab === "experience" && <div className="form-grid"><label>Șablon<select value={String(config.template)} onChange={(event) => update("template", event.target.value)}><option value="simple">Simple</option><option value="recruit">Recruit</option></select></label><label>Timp de privire: {Number(config.lookTime)} s<input type="range" min="1" max="10" step="1" value={Number(config.lookTime)} onChange={(event) => update("lookTime", Number(event.target.value))} /></label><label className="checkbox"><input type="checkbox" checked={Boolean(config.liveFaces)} onChange={(event) => update("liveFaces", event.target.checked)} /> Arată fețele în timp real</label></div>}{tab === "standby" && <div className="form-grid"><label>Durată foto/GIF (secunde)<input type="number" min="1" value={Number(config.standbyDuration)} onChange={(event) => update("standbyDuration", Number(event.target.value))} /></label><label>Tranziție<select value={String(config.transition)} onChange={(event) => update("transition", event.target.value)}><option value="auto">Auto</option><option value="fade">Fade</option><option value="iris">Iris</option></select></label><label>Viteză<input type="number" min="0.25" max="3" step="0.25" value={Number(config.transitionSpeed)} onChange={(event) => update("transitionSpeed", Number(event.target.value))} /></label><label className="checkbox"><input type="checkbox" checked={Boolean(config.standbyEnabled)} onChange={(event) => update("standbyEnabled", event.target.checked)} /> Activ</label><div className="playlist-picker"><strong>Adaugă media</strong>{assets.map((asset) => { const playlist = Array.isArray(config.playlist) ? config.playlist as string[] : []; const selected = playlist.includes(asset.id); return <label key={asset.id} className="checkbox"><input type="checkbox" checked={selected} onChange={() => update("playlist", selected ? playlist.filter((id) => id !== asset.id) : [...playlist, asset.id])} /> {asset.filename}</label>; })}</div></div>}{tab === "offer" && <div className="form-grid"><label>Link QR<input value={String(config.offerLink ?? "")} onChange={(event) => update("offerLink", event.target.value)} /></label><label>Titlu<input value={String(config.headline ?? "")} onChange={(event) => update("headline", event.target.value)} /></label><label>Subtitlu<input value={String(config.subtext ?? "")} onChange={(event) => update("subtext", event.target.value)} /></label><label>Text imagine<input value={String(config.caption ?? "")} onChange={(event) => update("caption", event.target.value)} /></label><label>Mărime QR<select value={String(config.qrSize)} onChange={(event) => update("qrSize", Number(event.target.value))}><option value="160">S</option><option value="220">M</option><option value="300">L</option></select></label><label>Culoare fundal<input type="color" value={String(config.offerBackground)} onChange={(event) => update("offerBackground", event.target.value)} /></label><div className="offer-preview" style={{ background: String(config.offerBackground) }}><strong>{String(config.headline || "Ofertă")}</strong><span>QR</span></div></div>}{!saved && <div className="sticky-save"><button className="button primary" onClick={() => void publish()}>Salvează și publică</button></div>}</section>;
}

function App() {
  const route = useRoute();
  const [locale, setLocale] = useLocale();
  const t = (key: TranslationKey) => translate(locale, key);
  useEffect(() => { document.documentElement.lang = locale; document.title = t("appName"); }, [locale]);
  if (route === "offer") return <OfferPage locale={locale} />;
  if (route === "privacy") return <PublicPage locale={locale} title="privacyTitle" body="privacyBody" />;
  return <Dashboard locale={locale} setLocale={setLocale} route={route} t={t} />;
}

function Dashboard({ locale, setLocale, route, t }: { locale: Locale; setLocale: (locale: Locale) => void; route: Route; t: (key: TranslationKey) => string }) {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(window.localStorage.getItem("adsense-session")));
  const [health, setHealth] = useState<ApiState>("loading");
  useEffect(() => { void getApiState(() => fetch(API_PATHS.health)).then(setHealth); }, []);
  const nav = useMemo(() => Object.entries(routeKeys) as [Exclude<Route, "offer" | "privacy">, TranslationKey][], []);
  if (!loggedIn) return <LoginShell locale={locale} />;
  return <div className="app-shell"><a className="skip-link" href="#content">{t("skipToContent")}</a><aside className="sidebar"><div className="brand"><div className="brand-mark">A</div><div><strong>{t("appName")}</strong><span>{t("workspace")}</span></div></div><p className="nav-label">{t("navigation")}</p><nav aria-label={t("navigation")}>{nav.map(([key, label]) => <a className={route === key ? "active" : ""} href={`#/${key}`} key={key}>{t(label)}</a>)}</nav><div className="sidebar-bottom"><a href="/privacy">{t("privacyTitle")}</a><button className="text-button" onClick={() => { window.localStorage.removeItem("adsense-session"); setLoggedIn(false); }}>{t("signOut")}</button></div></aside><main className="content" id="content"><header className="topbar"><div><p className="eyebrow">{t("appName")}</p><h1>{t(routeKeys[route as Exclude<Route, "offer" | "privacy">] ?? "dashboard")}</h1></div><label className="language-select">{t("language")}<select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>{SUPPORTED_LOCALES.map((item) => <option value={item} key={item}>{t(item === "ro" ? "romanian" : "english")}</option>)}</select></label></header><PageContent route={route} t={t} health={health} locale={locale} /></main></div>;
}

function PageContent({ route, t, health, locale }: { route: Route; t: (key: TranslationKey) => string; health: ApiState; locale: Locale }) {
  if (route === "dashboard") return <><section className="hero"><p className="eyebrow">{t("welcome")}</p><p className="lead">{t("dashboardIntro")}</p></section><div className="metric-grid">{[["activeDisplays", "0"], ["pendingLeads", "0"], ["impressions", "-"], ["conversionRate", "-"]].map(([label, value]) => <article className="metric-card" key={label}><span>{t(label as TranslationKey)}</span><strong>{value}</strong></article>)}</div><section className="panel-grid"><article className="panel"><div className="panel-heading"><h2>{t("serviceStatus")}</h2><span className={`status-dot ${health}`}>{health === "healthy" ? t("healthy") : health === "loading" ? "..." : t("unavailable")}</span></div><p>{health === "healthy" ? t("healthOk") : t("unavailable")}</p></article><article className="panel"><h2>{t("recentActivity")}</h2><p className="muted">{t("noActivity")}</p></article></section></>;
  const descriptions: Partial<Record<Route, TranslationKey>> = { displays: "displaysIntro", media: "mediaIntro", leads: "leadsIntro", stats: "statsIntro", help: "helpIntro", account: "accountIntro" };
  return <section className="page-section"><p className="lead">{t(descriptions[route] ?? "dashboardIntro")}</p>{route === "media" && <MediaUploader locale={locale} />}{route === "displays" && <><DisplaysPanel locale={locale} /><ConfigurationPanel /></>}{route === "leads" && <LeadsPanel locale={locale} />}</section>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
