import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
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

type Route = "dashboard" | "displays" | "media" | "leads" | "stats" | "help" | "account" | "offer" | "privacy" | "preview";
const routeKeys: Record<Exclude<Route, "offer" | "privacy" | "preview">, TranslationKey> = {
  dashboard: "dashboard",
  displays: "displays",
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
  if (path === "/preview") return "preview";
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

function RemoteLivePreviewPage({ locale }: { locale: Locale }) {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const deviceId = searchParams.get("d") || "";
  const isEmbed = searchParams.get("embed") === "1";

  const [device, setDevice] = useState<{ id: string; name: string; online: boolean; config: Record<string, unknown> } | null>(null);
  const [phase, setPhase] = useState<"STANDBY" | "GREETING" | "OFFER">("STANDBY");
  const [greetingAnim, setGreetingAnim] = useState({ scale: 0.8, opacity: 0 });
  const [offerProgress, setOfferProgress] = useState(0);
  const [faceX, setFaceX] = useState(38);
  const [faceY, setFaceY] = useState(48);
  const [autoLoop, setAutoLoop] = useState(true);

  // Poll device config
  useEffect(() => {
    if (!deviceId) return;
    const fetchInfo = () => {
      fetch(`/api/public/display/${encodeURIComponent(deviceId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setDevice(data);
        })
        .catch(() => {});
    };
    fetchInfo();
    const interval = setInterval(fetchInfo, 5000);
    return () => clearInterval(interval);
  }, [deviceId]);

  // Subtle face float animation in STANDBY
  useEffect(() => {
    if (phase !== "STANDBY") return;
    const interval = setInterval(() => {
      setFaceX(35 + Math.sin(Date.now() / 1400) * 8);
      setFaceY(46 + Math.cos(Date.now() / 1800) * 6);
    }, 50);
    return () => clearInterval(interval);
  }, [phase]);

  // Auto loop simulation
  useEffect(() => {
    if (!autoLoop) return;
    let timer: NodeJS.Timeout;

    if (phase === "STANDBY") {
      timer = setTimeout(() => {
        setPhase("GREETING");
      }, 5500);
    } else if (phase === "GREETING") {
      setGreetingAnim({ scale: 0.6, opacity: 0 });
      const inTimer = setTimeout(() => setGreetingAnim({ scale: 1.05, opacity: 1 }), 40);
      const settleTimer = setTimeout(() => setGreetingAnim({ scale: 1.0, opacity: 1 }), 320);
      timer = setTimeout(() => {
        setPhase("OFFER");
      }, 1400);
      return () => {
        clearTimeout(timer);
        clearTimeout(inTimer);
        clearTimeout(settleTimer);
      };
    } else if (phase === "OFFER") {
      const startTime = Date.now();
      const duration = 850;
      const animInterval = setInterval(() => {
        const p = Math.min(1.0, (Date.now() - startTime) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setOfferProgress(eased);
        // Face glides smoothly to the left half (media/people side) - NO teleportation!
        setFaceX(35 - eased * 12);
        if (p >= 1.0) clearInterval(animInterval);
      }, 20);

      timer = setTimeout(() => {
        clearInterval(animInterval);
        setOfferProgress(0);
        setPhase("STANDBY");
      }, 7000);

      return () => {
        clearTimeout(timer);
        clearInterval(animInterval);
      };
    }

    return () => clearTimeout(timer);
  }, [phase, autoLoop]);

  const triggerLook = () => {
    if (phase === "STANDBY") {
      setPhase("GREETING");
    }
  };

  const resetToStandby = () => {
    setOfferProgress(0);
    setPhase("STANDBY");
  };

  const cfg = device?.config || {};
  const bgColor = String(cfg.offerBackground || "#1c130e");
  const accentColor = String(cfg.accentColor || "#f59e0b");
  const greetingText = String(cfg.greetingText || "Hei!");
  const headline = String(cfg.headline || "20% reducere");
  const subtext = String(cfg.subtext || "Completează formularul pentru a revendica oferta");
  const playlist = Array.isArray(cfg.playlist) ? (cfg.playlist as string[]) : [];
  const activeMediaId = playlist.length > 0 ? playlist[0] : null;
  const qrLink = String(cfg.offerLink || "https://adsense.davidpetrea.ro/offer");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrLink)}`;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0a0a0c",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Top Header if not embedded */}
      {!isEmbed && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            padding: "12px 20px",
            background: "rgba(18, 10, 6, 0.88)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(245, 158, 11, 0.25)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#fff",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>📺</span>
            <div>
              <strong style={{ fontSize: "16px", color: "#fffbeb" }}>{device?.name || "Ecran AdSense"}</strong>
              <span style={{ fontSize: "12px", color: device?.online ? "#4ade80" : "#94a3b8", marginLeft: "10px" }}>
                ● {device?.online ? (locale === "ro" ? "Online (Conectat)" : "Online") : "Offline"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="button primary"
              style={{ background: "#f59e0b", color: "#1c130e", fontWeight: 700, padding: "8px 16px", fontSize: "13px" }}
              onClick={triggerLook}
              disabled={phase !== "STANDBY"}
            >
              👁 {locale === "ro" ? "Simulează privire (Trigger Look)" : "Simulate Look"}
            </button>
            <button
              className="button secondary"
              style={{ padding: "8px 14px", fontSize: "13px" }}
              onClick={resetToStandby}
            >
              🔄 Standby
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", color: "#e6d5c3" }}>
              <input type="checkbox" checked={autoLoop} onChange={(e) => setAutoLoop(e.target.checked)} />
              {locale === "ro" ? "Buclă automată" : "Auto Loop"}
            </label>
            <a href="/#displays" className="button secondary" style={{ padding: "8px 14px", fontSize: "13px" }}>
              ← {locale === "ro" ? "Înapoi la panou" : "Back to dashboard"}
            </a>
          </div>
        </div>
      )}

      {/* Main Screen Container */}
      <div
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          background: "#000",
        }}
      >
        {/* Layer 1: Standby Media (Video / Image) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: phase === "OFFER" ? "blur(14px) brightness(0.65)" : "none",
            opacity: phase === "OFFER" ? 0.8 : 1.0,
            transition: "filter 0.8s ease, opacity 0.8s ease",
            overflow: "hidden",
          }}
        >
          {activeMediaId ? (
            <video
              src={`/api/public/media/${activeMediaId}`}
              autoPlay
              loop
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "radial-gradient(circle at 50% 40%, #2a1a12, #120a06 75%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                textAlign: "center",
                padding: "20px",
              }}
            >
              <h1
                style={{
                  fontSize: "clamp(3rem, 7vw, 6rem)",
                  fontWeight: 900,
                  margin: 0,
                  color: "#f59e0b",
                  textShadow: "0 6px 30px rgba(245, 158, 11, 0.35)",
                }}
              >
                {device?.name || "AdSense"}
              </h1>
              <p style={{ fontSize: "clamp(1.2rem, 2.5vw, 2rem)", color: "#e6d5c3", marginTop: "1rem" }}>
                {locale === "ro" ? "Afișaj inteligent interactiv" : "Interactive Smart Display"}
              </p>
            </div>
          )}
        </div>

        {/* Layer 2: Live Face Avatar (Smoothly glides into media half, NO teleportation!) */}
        <div
          style={{
            position: "absolute",
            left: `${faceX}%`,
            top: `${faceY}%`,
            transform: "translate(-50%, -50%)",
            width: "clamp(120px, 14vw, 190px)",
            height: "clamp(120px, 14vw, 190px)",
            borderRadius: "50%",
            border: `3px solid ${accentColor}`,
            boxShadow: `0 0 35px ${accentColor}60, inset 0 0 25px rgba(0,0,0,0.6)`,
            pointerEvents: "none",
            zIndex: 40,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.25)",
            backdropFilter: "contrast(1.1) brightness(1.05)",
            transition: phase === "STANDBY" ? "transform 0.1s linear" : "left 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle, transparent 55%, ${bgColor} 95%)`,
            }}
          />
          <span style={{ fontSize: "2.5rem", opacity: 0.8 }}>👤</span>
        </div>

        {/* Layer 3: Centered "Hei!" Greeting Animation */}
        {phase === "GREETING" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
              pointerEvents: "none",
              background: "rgba(18, 10, 6, 0.35)",
              backdropFilter: "blur(4px)",
              opacity: greetingAnim.opacity,
              transform: `scale(${greetingAnim.scale})`,
              transition: "transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease",
            }}
          >
            <span
              style={{
                fontSize: "clamp(5.8rem, 13vw, 11rem)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: accentColor,
                textShadow: `0 16px 60px ${accentColor}80, 0 4px 16px rgba(0,0,0,0.7)`,
                lineHeight: 1,
                textAlign: "center",
              }}
            >
              {greetingText}
            </span>
          </div>
        )}

        {/* Layer 4: 50/50 Split Offer with QR Code */}
        {phase === "OFFER" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              zIndex: 60,
              pointerEvents: "none",
            }}
          >
            {/* Left: Media & Face Half */}
            <div style={{ flex: 1, height: "100%", position: "relative" }} />

            {/* Right: Slide-in Offer Half with warm espresso & amber styling */}
            <div
              style={{
                flex: 1,
                height: "100%",
                background: `linear-gradient(to right, transparent 0%, rgba(28, 19, 14, 0.45) 8%, rgba(28, 19, 14, 0.92) 24%, ${bgColor} 44%, ${bgColor} 100%)`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "clamp(24px, 4vw, 60px)",
                transform: `translate3d(${(1 - offerProgress) * 60}%, 0, 0)`,
                opacity: offerProgress,
                transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease",
              }}
            >
              <div style={{ maxWidth: "560px", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <span
                  style={{
                    fontSize: "clamp(1.1rem, 2vw, 1.6rem)",
                    fontWeight: 800,
                    color: accentColor,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {greetingText}
                </span>
                <h1
                  style={{
                    fontSize: "clamp(2.4rem, 5vw, 4.4rem)",
                    fontWeight: 900,
                    lineHeight: 1.08,
                    letterSpacing: "-0.03em",
                    margin: 0,
                    color: "#fffbeb",
                    textShadow: "0 4px 20px rgba(0,0,0,0.6)",
                  }}
                >
                  {headline}
                </h1>
                <p
                  style={{
                    fontSize: "clamp(1.2rem, 2.2vw, 1.9rem)",
                    lineHeight: 1.35,
                    margin: 0,
                    fontWeight: 500,
                    color: "#e6d5c3",
                  }}
                >
                  {subtext}
                </p>
                <div style={{ marginTop: "0.5rem", display: "inline-flex" }}>
                  <div
                    style={{
                      background: "#ffffff",
                      padding: "clamp(14px, 2vw, 24px)",
                      borderRadius: "clamp(18px, 2.5vw, 28px)",
                      boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(245, 158, 11, 0.25)",
                      display: "inline-flex",
                    }}
                  >
                    <img
                      src={qrUrl}
                      alt="QR Code"
                      style={{
                        width: "clamp(140px, 18vw, 230px)",
                        height: "clamp(140px, 18vw, 230px)",
                        display: "block",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating trigger button when embedded */}
        {isEmbed && (
          <button
            onClick={triggerLook}
            disabled={phase !== "STANDBY"}
            style={{
              position: "absolute",
              bottom: "12px",
              right: "12px",
              zIndex: 90,
              background: "rgba(18, 10, 6, 0.85)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              color: "#f59e0b",
              borderRadius: "20px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: phase === "STANDBY" ? "pointer" : "default",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>👁</span>
            <span>{phase === "STANDBY" ? (locale === "ro" ? "Simulează privire" : "Simulate look") : (locale === "ro" ? "Activ..." : "Active...")}</span>
          </button>
        )}
      </div>
    </div>
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

async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = window.localStorage.getItem("adsense-session");
  const headers = new Headers(init?.headers);
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    window.localStorage.removeItem("adsense-session");
    window.dispatchEvent(new CustomEvent("adsense:unauthorized"));
  }
  return res;
}

async function digestFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function MediaUploader({ locale }: { locale: Locale }) {
  const t = (key: TranslationKey) => translate(locale, key);
  const [items, setItems] = useState<{ name: string; progress: number; done: boolean; error?: string }[]>([]);
  const [assets, setAssets] = useState<{ id: string; filename: string; size_bytes: number }[]>([]);
  const refresh = () => { void authFetch("/api/assets").then((response) => response.ok ? response.json() as Promise<{ assets: typeof assets }> : { assets: [] }).then((payload) => setAssets(payload.assets)); };
  useEffect(refresh, []);
  const upload = async (file: File, itemIndex: number) => {
    try {
      if (file.size > 2 * 1024 * 1024 * 1024) throw new Error("upload_too_large");
      const created = await authFetch("/api/assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }) });
      if (!created.ok) throw new Error("upload_failed");
      const asset = await created.json() as { assetId: string; uploadUrl: string; chunkBytes: number };
      const uploadUrl = new URL(asset.uploadUrl, window.location.origin);
      const token = uploadUrl.searchParams.get("token") ?? "";
      const chunkBytes = asset.chunkBytes;
      const totalChunks = Math.ceil(file.size / chunkBytes);
      const status = await authFetch(`/api/assets/${asset.assetId}/upload-status?token=${encodeURIComponent(token)}`);
      const statusPayload = status.ok ? await status.json() as { nextIndex: number } : { nextIndex: 0 };
      let nextIndex = statusPayload.nextIndex;
      while (nextIndex < totalChunks) {
        const index = nextIndex;
        const chunk = file.slice(index * chunkBytes, Math.min(file.size, (index + 1) * chunkBytes));
        let sent = false;
        for (let attempt = 0; attempt < 3 && !sent; attempt++) {
          const response = await authFetch(`/api/assets/${asset.assetId}/chunks/${index}?token=${encodeURIComponent(token)}`, { method: "PUT", body: chunk });
          sent = response.ok;
          if (!sent && response.status === 409) {
            const latest = await authFetch(`/api/assets/${asset.assetId}/upload-status?token=${encodeURIComponent(token)}`);
            nextIndex = (await latest.json() as { nextIndex: number }).nextIndex;
            break;
          }
        }
        if (!sent) throw new Error("upload_failed");
        nextIndex++;
        setItems((current) => current.map((item, indexToUpdate) => indexToUpdate === itemIndex ? { ...item, progress: Math.round(nextIndex / totalChunks * 100) } : item));
      }
      const sha256 = await digestFile(file);
      const complete = await authFetch(`/api/assets/${asset.assetId}/complete?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ totalSize: file.size, sha256 }) });
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
  return <div className="panel media-uploader"><label className="button primary file-picker">{t("chooseFiles")}<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm,video/x-matroska,image/gif" onChange={chooseFiles} /></label>{items.map((item) => <div className="upload-row" key={item.name}><div className="upload-heading"><span>{item.name}</span><strong>{item.error ?? (item.done ? t("uploadDone") : `${item.progress}%`)}</strong></div><progress max="100" value={item.progress} /></div>)}<div className="asset-list">{assets.map((asset) => <div className="upload-heading" key={asset.id}><span>{asset.filename}</span><button className="text-button" onClick={() => { void authFetch(`/api/assets/${asset.id}`, { method: "DELETE" }).then(refresh); }}>{t("delete")}</button></div>)}</div></div>;
}

// DisplaysPanel removed in favor of unified DisplaysView

function LeadsPanel({ locale }: { locale: Locale }) {
  const t = (key: TranslationKey) => translate(locale, key);
  const [leads, setLeads] = useState<{ id: string; name: string; email: string; created_at: string; device_id?: string; device_name?: string }[]>([]);
  const [query, setQuery] = useState("");
  const refresh = () => {
    void authFetch("/api/leads")
      .then((response) => response.json() as Promise<{ leads: typeof leads }>)
      .then((payload) => setLeads(payload.leads || []));
  };
  useEffect(refresh, []);

  const visible = leads.filter((lead) =>
    `${lead.name} ${lead.email} ${lead.device_name || ""}`.toLowerCase().includes(query.toLowerCase())
  );

  const exportCsv = () => {
    const headers = locale === "ro" ? "Nume,Email,Ecran,Data\n" : "Name,Email,Display,Date\n";
    const rows = visible
      .map((lead) => [lead.name, lead.email, lead.device_name || (locale === "ro" ? "Pagină directă" : "Direct page"), lead.created_at].map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const deleteLead = async (id: string) => {
    if (!window.confirm(locale === "ro" ? "Sigur vrei să ștergi acest contact? Acțiunea nu poate fi anulată." : "Are you sure you want to delete this lead? This action cannot be undone.")) return;
    const response = await authFetch(`/api/leads/${id}`, { method: "DELETE" });
    if (response.ok) {
      refresh();
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{t("leads")}</h2>
        {leads.length > 0 && (
          <button className="button secondary" onClick={exportCsv}>
            {t("exportCsv")}
          </button>
        )}
      </div>
      <input
        className="search-input"
        placeholder={locale === "ro" ? "Caută contacte după nume, email sau ecran…" : "Search leads by name, email or display…"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {visible.length === 0 ? (
        <p className="muted">{leads.length === 0 ? t("noLeads") : (locale === "ro" ? "Niciun rezultat găsit." : "No matching results.")}</p>
      ) : (
        <div className="table-responsive">
          <table className="leads-table">
            <thead>
              <tr>
                <th>{locale === "ro" ? "Nume" : "Name"}</th>
                <th>Email</th>
                <th>{locale === "ro" ? "Ecran captură" : "Display"}</th>
                <th>{locale === "ro" ? "Data înregistrării" : "Date"}</th>
                <th style={{ textAlign: "right" }}>{locale === "ro" ? "Acțiuni" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((lead) => (
                <tr key={lead.id}>
                  <td><strong>{lead.name}</strong></td>
                  <td><a href={`mailto:${lead.email}`} style={{ color: "#146b55" }}>{lead.email}</a></td>
                  <td>{lead.device_name || <em className="muted">{locale === "ro" ? "Pagină directă" : "Direct page"}</em>}</td>
                  <td>
                    <small className="muted">
                      {new Date(lead.created_at).toLocaleString(locale === "ro" ? "ro-RO" : "en-US")}
                    </small>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="text-button danger" onClick={() => void deleteLead(lead.id)}>
                      {t("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DisplaysView({ locale }: { locale: Locale }) {
  const [devices, setDevices] = useState<{ id: string; name: string; online: boolean; last_seen_at?: string; config: Record<string, unknown>; config_version?: number; applied_config_version?: number }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [code, setCode] = useState("");
  const [pairName, setPairName] = useState("");
  const [pairNotice, setPairNotice] = useState("");
  const [pairLoading, setPairLoading] = useState(false);
  const [tab, setTab] = useState<"experience" | "standby" | "offer">("experience");
  const [previewKey, setPreviewKey] = useState(0);

  const defaultConfig: Record<string, unknown> = {
    template: "simple",
    greetingText: "Hei!",
    offerAnimationPace: 1.0,
    liveFaces: true,
    lookTime: 3,
    standbyDuration: 8,
    standbyEnabled: true,
    transition: "auto",
    transitionSpeed: "normal",
    offerLink: "https://adsense.davidpetrea.ro/offer",
    headline: "20% reducere",
    subtext: "Completează formularul pentru a revendica oferta",
    caption: "",
    qrSize: "M",
    offerBackground: "#1c130e",
    accentColor: "#f59e0b",
    playlist: [],
  };

  const [config, setConfig] = useState<Record<string, unknown>>(defaultConfig);
  const [saved, setSaved] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "syncing" | "synced" | "error">("idle");
  const [toast, setToast] = useState<{ message: string; type: "info" | "syncing" | "success" | "error" } | null>(null);
  const [assets, setAssets] = useState<{ id: string; filename: string }[]>([]);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const showToast = (message: string, type: "info" | "syncing" | "success" | "error", durationMs?: number) => {
    setToast({ message, type });
    if (durationMs) {
      setTimeout(() => {
        setToast((cur) => (cur?.message === message ? null : cur));
      }, durationMs);
    }
  };

  const refresh = () => {
    void authFetch("/api/devices")
      .then((response) => response.json() as Promise<{ devices: typeof devices }>)
      .then((payload) => {
        const list = payload.devices || [];
        setDevices(list);
        if (list.length > 0) {
          setSelectedDeviceId((currentId) => {
            const exists = list.some((d) => d.id === currentId);
            const targetId = exists ? currentId : list[0].id;
            const targetDevice = list.find((d) => d.id === targetId);
            if (targetDevice) {
              setConfig((cur) => ({ ...defaultConfig, ...targetDevice.config, ...(targetId === currentId ? cur : targetDevice.config) }));
            }
            return targetId;
          });
        } else {
          setSelectedDeviceId("");
        }
      });
  };

  useEffect(() => {
    refresh();
    const handleChanged = () => refresh();
    window.addEventListener("adsense:devices-changed", handleChanged);
    void authFetch("/api/assets")
      .then((response) => response.json() as Promise<{ assets: typeof assets }>)
      .then((payload) => setAssets(payload.assets || []));
    return () => window.removeEventListener("adsense:devices-changed", handleChanged);
  }, []);

  const selectDevice = (id: string) => {
    setSelectedDeviceId(id);
    const target = devices.find((d) => d.id === id);
    if (target) {
      setConfig({ ...defaultConfig, ...target.config });
      setSaved(true);
    }
  };

  const pair = async (event: FormEvent) => {
    event.preventDefault();
    setPairLoading(true);
    setPairNotice("");
    const effectiveName = pairName.trim() || `Ecran ${devices.length + 1}`;
    try {
      const response = await authFetch("/api/devices/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, name: effectiveName }),
      });
      if (!response.ok) {
        setPairNotice(locale === "ro" ? "Codul nu este valid sau a expirat." : "That code is invalid or expired.");
        setPairLoading(false);
        return;
      }
      const data = (await response.json()) as { deviceId?: string };
      setShowAddModal(false);
      setCode("");
      setPairName("");
      setPairLoading(false);
      showToast(locale === "ro" ? "Ecranul a fost adăugat cu succes!" : "Display paired successfully!", "success", 4000);
      refresh();
      if (data.deviceId) selectDevice(data.deviceId);
      window.dispatchEvent(new CustomEvent("adsense:devices-changed"));
    } catch {
      setPairNotice(locale === "ro" ? "Eroare de conexiune la server." : "Server connection error.");
      setPairLoading(false);
    }
  };

  const deleteDevice = async (id: string) => {
    if (!id) return;
    if (!window.confirm(locale === "ro" ? "Sigur vrei să elimini acest ecran? Acțiunea nu poate fi anulată." : "Are you sure you want to delete this display?")) return;
    const response = await authFetch(`/api/devices/${id}`, { method: "DELETE" });
    if (response.ok) {
      showToast(locale === "ro" ? "Ecranul a fost eliminat." : "Display removed.", "info", 3000);
      refresh();
      window.dispatchEvent(new CustomEvent("adsense:devices-changed"));
    }
  };

  const update = (key: string, value: unknown) => {
    setSaved(false);
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const publish = async () => {
    if (!selectedDeviceId || syncStatus === "saving" || syncStatus === "syncing") return;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    setSyncStatus("saving");
    showToast(locale === "ro" ? "Se salvează…" : "Saving…", "info");

    try {
      const response = await authFetch(`/api/devices/${selectedDeviceId}/config`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        setSyncStatus("error");
        showToast(locale === "ro" ? "Eroare la salvare." : "Failed to save.", "error", 4000);
        return;
      }

      const { version } = (await response.json()) as { version: number };
      setSaved(true);
      setSyncStatus("syncing");
      showToast(locale === "ro" ? "Se sincronizează…" : "Syncing to display…", "syncing");

      const startAt = Date.now();
      pollTimerRef.current = setInterval(async () => {
        try {
          const cfgRes = await authFetch(`/api/devices/${selectedDeviceId}/config`);
          if (!cfgRes.ok) return;
          const cfgData = (await cfgRes.json()) as { appliedConfigVersion?: number; configVersion?: number };
          if (typeof cfgData.appliedConfigVersion === "number" && cfgData.appliedConfigVersion >= version) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setSyncStatus("synced");
            showToast(locale === "ro" ? "Actualizat pe ecran ✓" : "Updated on display ✓", "success", 3000);
            refresh();
            setTimeout(() => {
              setSyncStatus("idle");
            }, 3000);
            return;
          }
          if (Date.now() - startAt > 25_000) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setSyncStatus("idle");
            showToast(locale === "ro" ? "Salvat. Se va actualiza când ecranul e online." : "Saved. Will update when display connects.", "info", 4000);
            refresh();
          }
        } catch {
          // ignore transient poll error
        }
      }, 1500);
    } catch {
      setSyncStatus("error");
      showToast(locale === "ro" ? "Eroare de rețea." : "Network error.", "error", 4000);
    }
  };

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === "syncing" && <span className="spinner"></span>}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header with Green + Add Display Button */}
      <div className="displays-header">
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: "22px" }}>
            {locale === "ro" ? "Ecrane conectate" : "Connected displays"}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: "14px" }}>
            {locale === "ro"
              ? "Selectează un ecran pentru a-l monitoriza în timp real și a-i configura conținutul."
              : "Select a display to monitor it in real-time and configure its content."}
          </p>
        </div>
        <button
          className="button success"
          onClick={() => {
            setShowAddModal(true);
            setPairNotice("");
            setCode("");
            setPairName("");
          }}
        >
          <span style={{ fontSize: "16px", fontWeight: "bold" }}>+</span>
          {locale === "ro" ? "Adaugă ecran" : "Add display"}
        </button>
      </div>

      {/* Add Display Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddModal(false)} aria-label="Close">
              ✕
            </button>
            <h3 style={{ margin: "0 0 8px", fontSize: "19px" }}>
              {locale === "ro" ? "Adaugă ecran nou" : "Add new display"}
            </h3>
            <p className="muted" style={{ fontSize: "14px", margin: "0 0 20px" }}>
              {locale === "ro"
                ? "Introdu codul de 6 cifre afișat pe televizor pentru a asocia dispozitivul."
                : "Enter the 6-digit code shown on the TV to pair your device."}
            </p>
            <form className="offer-form" onSubmit={pair}>
              <label>
                {locale === "ro" ? "Cod din 6 cifre de pe TV" : "6-digit code from TV"}
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="ex: 123456"
                  value={code}
                  autoFocus
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  required
                />
              </label>
              <label>
                {locale === "ro" ? "Nume ecran (opțional)" : "Display name (optional)"}
                <input
                  value={pairName}
                  placeholder={`Ecran ${devices.length + 1}`}
                  onChange={(event) => setPairName(event.target.value)}
                />
              </label>
              {pairNotice && <p className="notice">{pairNotice}</p>}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" }}>
                <button type="button" className="button secondary" onClick={() => setShowAddModal(false)}>
                  {locale === "ro" ? "Anulează" : "Cancel"}
                </button>
                <button type="submit" className="button success" disabled={pairLoading || code.length < 6}>
                  {pairLoading ? (
                    <span className="spinner"></span>
                  ) : (
                    <span>{locale === "ro" ? "Asociază ecranul" : "Pair display"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Displays Cards List */}
      {devices.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "12px" }}>📺</div>
          <h3 style={{ margin: "0 0 8px" }}>{locale === "ro" ? "Niciun ecran conectat" : "No displays connected yet"}</h3>
          <p className="muted" style={{ maxWidth: "460px", margin: "0 auto 20px", fontSize: "14px" }}>
            {locale === "ro"
              ? "Pornește Raspberry Pi conectat la TV și introdu codul din 6 cifre pentru a-l asocia cu această platformă."
              : "Boot the Raspberry Pi connected to your TV and enter the 6-digit code to pair it."}
          </p>
          <button className="button success" onClick={() => setShowAddModal(true)}>
            + {locale === "ro" ? "Adaugă primul ecran" : "Add first display"}
          </button>
        </div>
      ) : (
        <div className="display-cards-grid">
          {devices.map((device) => {
            const isSelected = device.id === selectedDeviceId;
            return (
              <div
                key={device.id}
                className={`display-card ${isSelected ? "selected" : ""}`}
                onClick={() => selectDevice(device.id)}
                role="button"
                tabIndex={0}
              >
                <div className="display-card-top">
                  <div className="display-icon-name">
                    <span className="display-icon">📺</span>
                    <span className="display-title">{device.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`status-pill ${device.online ? "online" : "offline"}`}>
                      <span className="status-dot-pulse"></span>
                      {device.online ? "Online" : "Offline"}
                    </span>
                    <button
                      type="button"
                      className="card-delete-btn"
                      title={locale === "ro" ? "Elimină ecranul" : "Delete display"}
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteDevice(device.id);
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div className="display-card-meta">
                  <span>
                    {device.last_seen_at
                      ? `${locale === "ro" ? "Conectat:" : "Seen:"} ${new Date(device.last_seen_at).toLocaleTimeString(locale === "ro" ? "ro-RO" : "en-US", { hour: "2-digit", minute: "2-digit" })}`
                      : (locale === "ro" ? "Nu s-a conectat" : "Never")}
                  </span>
                  <span style={{ fontWeight: 600, color: isSelected ? "#146b55" : "#64748b" }}>
                    {isSelected ? (locale === "ro" ? "Selectat ✓" : "Selected ✓") : (locale === "ro" ? "Apasă pt. configurare" : "Click to edit")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Display Workspace: Live TV Preview & Configuration Panel */}
      {selectedDevice && (
        <div className="display-workspace">
          {/* Left: Live TV Preview */}
          <div className="live-preview-card">
            <div className="live-preview-header">
              <h3 className="live-preview-title">
                <span>📺 {locale === "ro" ? "Previzualizare în direct (Live TV)" : "Live Display Preview"}</span>
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="live-preview-btn"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  title={locale === "ro" ? "Reîncarcă fluxul" : "Reload feed"}
                >
                  🔄 {locale === "ro" ? "Reîmprospătează" : "Refresh"}
                </button>
                <a
                  href={`/preview?d=${encodeURIComponent(selectedDevice.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="live-preview-btn"
                  title={locale === "ro" ? "Deschide în tab nou" : "Open in new tab"}
                >
                  ↗ {locale === "ro" ? "Ecran complet" : "Fullscreen"}
                </a>
              </div>
            </div>
            <div className="live-preview-tv-frame">
              <iframe
                key={previewKey}
                src={`/preview?d=${encodeURIComponent(selectedDevice.id)}&embed=1`}
                className="live-preview-iframe"
                title="TV Display Preview"
              />
            </div>
            <div className="live-preview-footer">
              <span>● {selectedDevice.name} ({selectedDevice.online ? "Online" : "Offline"})</span>
              <span style={{ color: "#94a3b8" }}>
                {locale === "ro" ? "Transmisie Cloud (fără dependență de rețeaua locală)" : "Cloud Stream (No local agent dependency)"}
              </span>
            </div>
          </div>

          {/* Right: Configuration Settings */}
          <section className="panel configuration-panel" style={{ margin: 0 }}>
            <div className="panel-heading">
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "17px" }}>
                  {locale === "ro" ? "Configurare: " : "Settings: "}
                  <strong>{selectedDevice.name}</strong>
                </h3>
                <span className="muted" style={{ fontSize: "12px" }}>
                  ID: {selectedDevice.id.slice(0, 8)}…
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {syncStatus === "saving" && (
                  <span className="status-badge saving">
                    <span className="spinner"></span> {locale === "ro" ? "Se salvează…" : "Saving…"}
                  </span>
                )}
                {syncStatus === "syncing" && (
                  <span className="status-badge syncing">
                    <span className="spinner"></span> {locale === "ro" ? "Se sincronizează…" : "Syncing to display…"}
                  </span>
                )}
                {syncStatus === "synced" && (
                  <span className="status-badge synced">
                    {locale === "ro" ? "Actualizat pe ecran ✓" : "Updated on display ✓"}
                  </span>
                )}
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() => void deleteDevice(selectedDevice.id)}
                >
                  {locale === "ro" ? "Elimină ecranul" : "Delete display"}
                </button>
              </div>
            </div>

            <div className="tabs">
              <button className={tab === "experience" ? "active" : ""} onClick={() => setTab("experience")}>
                {locale === "ro" ? "Experiență" : "Experience"}
              </button>
              <button className={tab === "standby" ? "active" : ""} onClick={() => setTab("standby")}>
                Standby
              </button>
              <button className={tab === "offer" ? "active" : ""} onClick={() => setTab("offer")}>
                {locale === "ro" ? "Ofertă & QR" : "Offer & QR"}
              </button>
            </div>

            {tab === "experience" && (
              <div className="form-grid">
                <label style={{ gridColumn: "1 / -1" }}>
                  {locale === "ro" ? "Mesaj de întâmpinare (afișat la privire)" : "Greeting message (shown on look)"}
                  <input
                    value={String(config.greetingText ?? "Hei!")}
                    placeholder="Hei!"
                    onChange={(event) => update("greetingText", event.target.value)}
                  />
                  <small className="muted" style={{ fontSize: "12px", marginTop: "4px" }}>
                    {locale === "ro"
                      ? "Apare cu o animație dinamică (bounce) pe ecran înainte de tranziția ofertei și codul QR."
                      : "Appears with an animated bounce before transitioning into the offer and QR code."}
                  </small>
                </label>
                <label>
                  {locale === "ro" ? "Șablon interactiv" : "Template"}
                  <select
                    value={String(config.template || "simple")}
                    onChange={(event) => update("template", event.target.value)}
                  >
                    <option value="simple">Simple (Soft Reveal)</option>
                    <option value="recruit">Recruit (Iris Blend + Side Locking)</option>
                  </select>
                </label>
                <label>
                  {locale === "ro" ? "Timp minim de privire:" : "Looking dwell time:"} {Number(config.lookTime || 3)} s
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={Number(config.lookTime || 3)}
                    onChange={(event) => update("lookTime", Number(event.target.value))}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span>{locale === "ro" ? "Ritm animație ofertă:" : "Offer animation pace:"}</span>
                    <strong style={{ color: "#146b55" }}>
                      {Number(config.offerAnimationPace || 1.0) <= 0.8
                        ? (locale === "ro" ? "Dinamism rapid (2.4s)" : "Fast (2.4s)")
                        : Number(config.offerAnimationPace || 1.0) >= 1.3
                          ? (locale === "ro" ? "Relaxat & Fluid (4.4s)" : "Relaxed & Fluid (4.4s)")
                          : (locale === "ro" ? "Normal & Elegant (3.4s)" : "Normal & Elegant (3.4s)")}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.1"
                    value={Number(config.offerAnimationPace || 1.0)}
                    onChange={(event) => update("offerAnimationPace", Number(event.target.value))}
                  />
                  <small className="muted" style={{ fontSize: "12px", marginTop: "4px" }}>
                    {locale === "ro"
                      ? "Controlează viteza întregii tranziții: apariția mesajului Hei!, tranziția lină și intrarea ofertei cu codul QR."
                      : "Controls the pacing of the sequence: greeting entrance, smooth transition, and offer reveal."}
                  </small>
                </label>
                <label className="checkbox" style={{ gridColumn: "1 / -1" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(config.liveFaces ?? true)}
                    onChange={(event) => update("liveFaces", event.target.checked)}
                  />
                  {locale === "ro" ? "Arată fețele decupate în timp real" : "Show soft blended faces in real time"}
                </label>
              </div>
            )}

            {tab === "standby" && (
              <div className="form-grid">
                <label>
                  {locale === "ro" ? "Durată foto/GIF (secunde)" : "Photo/GIF duration (seconds)"}
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={Number(config.standbyDuration || 8)}
                    onChange={(event) => update("standbyDuration", Number(event.target.value))}
                  />
                </label>
                <label>
                  {locale === "ro" ? "Tranziție standby" : "Standby transition"}
                  <select
                    value={String(config.transition || "auto")}
                    onChange={(event) => update("transition", event.target.value)}
                  >
                    <option value="auto">Auto (random fără repetare)</option>
                    <option value="crossfade">Crossfade</option>
                    <option value="zoom dissolve">Zoom dissolve</option>
                    <option value="push">Push</option>
                    <option value="soft wipe">Soft wipe</option>
                    <option value="dip to black">Dip to black</option>
                  </select>
                </label>
                <label>
                  {locale === "ro" ? "Viteză tranziție" : "Transition speed"}
                  <select
                    value={
                      typeof config.transitionSpeed === "number"
                        ? config.transitionSpeed <= 0.6
                          ? "fast"
                          : config.transitionSpeed >= 1.2
                            ? "slow"
                            : "normal"
                        : String(config.transitionSpeed || "normal")
                    }
                    onChange={(event) => update("transitionSpeed", event.target.value)}
                  >
                    <option value="fast">{locale === "ro" ? "Rapidă (0.5s)" : "Fast (0.5s)"}</option>
                    <option value="normal">{locale === "ro" ? "Normală (0.9s)" : "Normal (0.9s)"}</option>
                    <option value="slow">{locale === "ro" ? "Lentă (1.4s)" : "Slow (1.4s)"}</option>
                  </select>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(config.standbyEnabled ?? true)}
                    onChange={(event) => update("standbyEnabled", event.target.checked)}
                  />
                  {locale === "ro" ? "Redare standby activată" : "Standby playback enabled"}
                </label>
                <div className="playlist-picker" style={{ gridColumn: "1 / -1" }}>
                  <strong>
                    {locale === "ro"
                      ? "Playlist media (bifează fișierele de afișat în standby)"
                      : "Media playlist (check items to show in standby)"}
                  </strong>
                  {assets.length === 0 ? (
                    <p className="muted" style={{ margin: "8px 0" }}>
                      {locale === "ro" ? "Nu ai încărcat niciun fișier media încă." : "No media uploaded yet."}
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: "8px",
                        marginTop: "10px",
                      }}
                    >
                      {assets.map((asset) => {
                        const playlist = Array.isArray(config.playlist) ? (config.playlist as string[]) : [];
                        const selected = playlist.includes(asset.id);
                        return (
                          <label
                            key={asset.id}
                            className="checkbox"
                            style={{
                              margin: 0,
                              padding: "6px 10px",
                              background: "#f8fafc",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                update(
                                  "playlist",
                                  selected ? playlist.filter((id) => id !== asset.id) : [...playlist, asset.id]
                                )
                              }
                            />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {asset.filename}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "offer" && (
              <div className="form-grid">
                <label>
                  {locale === "ro" ? "Link QR" : "QR Link"}
                  <input
                    value={String(config.offerLink ?? "")}
                    placeholder="https://adsense.davidpetrea.ro/offer"
                    onChange={(event) => update("offerLink", event.target.value)}
                  />
                </label>
                <label>
                  {locale === "ro" ? "Titlu ofertă (Headline)" : "Offer headline"}
                  <input
                    value={String(config.headline ?? "")}
                    placeholder="20% reducere"
                    onChange={(event) => update("headline", event.target.value)}
                  />
                </label>
                <label>
                  {locale === "ro" ? "Subtitlu ofertă (Subtext)" : "Offer subtext"}
                  <input
                    value={String(config.subtext ?? "")}
                    placeholder="Completează formularul pentru a revendica oferta"
                    onChange={(event) => update("subtext", event.target.value)}
                  />
                </label>
                <label>
                  {locale === "ro" ? "Text imagine (opțional)" : "Media caption"}
                  <input
                    value={String(config.caption ?? "")}
                    placeholder="Text peste imaginea ofertei"
                    onChange={(event) => update("caption", event.target.value)}
                  />
                </label>
                <label>
                  {locale === "ro" ? "Mărime cod QR" : "QR Size"}
                  <select
                    value={
                      config.qrSize === 160 ? "S" : config.qrSize === 300 ? "L" : typeof config.qrSize === "string" ? config.qrSize : "M"
                    }
                    onChange={(event) => update("qrSize", event.target.value)}
                  >
                    <option value="S">{locale === "ro" ? "Mic (S - 32%)" : "Small (S - 32%)"}</option>
                    <option value="M">{locale === "ro" ? "Mediu (M - 40%)" : "Medium (M - 40%)"}</option>
                    <option value="L">{locale === "ro" ? "Mare (L - 48%)" : "Large (L - 48%)"}</option>
                  </select>
                </label>
                <div style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                    {locale === "ro" ? "Temă culori & aspect ecran" : "Screen color theme & presets"}
                  </span>
                  <div className="theme-presets-grid">
                    {[
                      { id: "espresso", name: "Gourmet Espresso", bg: "#1c130e", accent: "#f59e0b" },
                      { id: "caramel", name: "Caramel Cald", bg: "#261810", accent: "#d97706" },
                      { id: "terracotta", name: "Teracotă Artizanală", bg: "#2c1810", accent: "#ea580c" },
                      { id: "slate", name: "Dark Slate", bg: "#0f172a", accent: "#10b981" },
                      { id: "midnight", name: "Midnight Gold", bg: "#0b1329", accent: "#facc15" },
                    ].map((preset) => {
                      const active = (config.offerBackground === preset.bg && config.accentColor === preset.accent);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`theme-preset-btn ${active ? "active" : ""}`}
                          onClick={() => {
                            setSaved(false);
                            setConfig((c) => ({ ...c, offerBackground: preset.bg, accentColor: preset.accent }));
                          }}
                        >
                          <div className="theme-preset-preview" style={{ background: preset.bg, color: preset.accent, border: `1px solid ${preset.accent}40` }}>
                            Hei! Aa
                          </div>
                          <span className="theme-preset-name">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label>
                  {locale === "ro" ? "Culoare fundal ecran ofertă" : "Offer background color"}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="color"
                      value={String(config.offerBackground || "#1c130e")}
                      onChange={(event) => update("offerBackground", event.target.value)}
                      style={{ width: "48px", height: "38px", padding: "2px", cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={String(config.offerBackground || "#1c130e")}
                      onChange={(event) => update("offerBackground", event.target.value)}
                      style={{ width: "110px", fontFamily: "monospace" }}
                    />
                  </div>
                </label>
                <label>
                  {locale === "ro" ? "Culoare accent (Hei! & QR)" : "Accent color (Greeting & highlights)"}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="color"
                      value={String(config.accentColor || "#f59e0b")}
                      onChange={(event) => update("accentColor", event.target.value)}
                      style={{ width: "48px", height: "38px", padding: "2px", cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={String(config.accentColor || "#f59e0b")}
                      onChange={(event) => update("accentColor", event.target.value)}
                      style={{ width: "110px", fontFamily: "monospace" }}
                    />
                  </div>
                </label>
                <div
                  className="offer-preview"
                  style={{
                    background: String(config.offerBackground || "#1c130e"),
                    gridColumn: "1 / -1",
                    padding: "20px",
                    borderRadius: "10px",
                    color: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: `1px solid ${String(config.accentColor || "#f59e0b")}40`,
                  }}
                >
                  <div>
                    <span style={{ color: String(config.accentColor || "#f59e0b"), fontWeight: 800, fontSize: "14px", display: "block", marginBottom: "4px" }}>
                      {String(config.greetingText || "Hei!")}
                    </span>
                    <strong style={{ display: "block", fontSize: "20px", marginBottom: "4px", color: "#fffbeb" }}>
                      {String(config.headline || "20% reducere")}
                    </strong>
                    <span style={{ fontSize: "14px", color: "#e6d5c3" }}>
                      {String(config.subtext || "Completează formularul pentru a revendica oferta")}
                    </span>
                  </div>
                  <div
                    style={{
                      background: "#fff",
                      color: "#000",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}
                  >
                    QR [{String(config.qrSize || "M")}]
                  </div>
                </div>
              </div>
            )}

            {(!saved || syncStatus === "saving" || syncStatus === "syncing") && (
              <div
                className="sticky-save"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  justifyContent: "flex-end",
                  marginTop: "16px",
                  paddingTop: "14px",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                {syncStatus === "saving" && (
                  <span className="status-badge saving">
                    <span className="spinner"></span> {locale === "ro" ? "Se salvează…" : "Saving…"}
                  </span>
                )}
                {syncStatus === "syncing" && (
                  <span className="status-badge syncing">
                    <span className="spinner"></span> {locale === "ro" ? "Se sincronizează…" : "Syncing to display…"}
                  </span>
                )}
                {syncStatus === "synced" && (
                  <span className="status-badge synced">
                    {locale === "ro" ? "Actualizat pe ecran ✓" : "Updated on display ✓"}
                  </span>
                )}
                <button
                  className="button primary"
                  disabled={syncStatus === "saving" || syncStatus === "syncing"}
                  onClick={() => void publish()}
                >
                  {syncStatus === "saving"
                    ? (locale === "ro" ? "Se salvează…" : "Saving…")
                    : (locale === "ro" ? "Salvează și publică" : "Save and publish")}
                </button>
              </div>
            )}

            <div className="danger-zone-card">
              <div>
                <h4>{locale === "ro" ? "Zonă de pericol: Ștergere ecran" : "Danger Zone: Delete display"}</h4>
                <p>{locale === "ro" ? "Elimină complet acest ecran și setările asociate." : "Permanently remove this display and all paired configurations."}</p>
              </div>
              <button
                type="button"
                className="button danger"
                onClick={() => void deleteDevice(selectedDevice.id)}
              >
                {locale === "ro" ? "Elimină ecranul definitiv" : "Delete display"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DashboardOverview({ locale, t, health }: { locale: Locale; t: (key: TranslationKey) => string; health: ApiState }) {
  const [devices, setDevices] = useState<{ id: string; name: string; online: boolean; last_seen_at?: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string; email: string; created_at: string; device_name?: string }[]>([]);

  useEffect(() => {
    void authFetch("/api/devices")
      .then((res) => res.json() as Promise<{ devices: typeof devices }>)
      .then((p) => setDevices(p.devices || []));
    void authFetch("/api/leads")
      .then((res) => res.json() as Promise<{ leads: typeof leads }>)
      .then((p) => setLeads(p.leads || []));
  }, []);

  const activeCount = devices.filter((d) => d.online).length;
  const leadsCount = leads.length;
  const estimatedImpressions = leadsCount > 0 ? String(leadsCount * 6 + activeCount * 12) : activeCount > 0 ? String(activeCount * 8) : "0";
  const conversionRate = leadsCount > 0 ? `${Math.min(100, Math.round((leadsCount / Math.max(leadsCount * 3.5, 10)) * 100))}%` : "—";

  return (
    <>
      <section className="hero">
        <p className="eyebrow">{t("welcome")}</p>
        <p className="lead">{t("dashboardIntro")}</p>
      </section>

      <div className="metric-grid">
        <article className="metric-card">
          <span>{t("activeDisplays")}</span>
          <strong>{activeCount}</strong>
          <small className="muted" style={{ fontSize: "12px", marginTop: "4px", display: "block" }}>
            {devices.length} {locale === "ro" ? "total înregistrate" : "total registered"}
          </small>
        </article>
        <article className="metric-card">
          <span>{t("pendingLeads")}</span>
          <strong>{leadsCount}</strong>
          <small className="muted" style={{ fontSize: "12px", marginTop: "4px", display: "block" }}>
            {locale === "ro" ? "contacte colectate" : "collected leads"}
          </small>
        </article>
        <article className="metric-card">
          <span>{t("impressions")}</span>
          <strong>{estimatedImpressions}</strong>
          <small className="muted" style={{ fontSize: "12px", marginTop: "4px", display: "block" }}>
            {locale === "ro" ? "priviri directe estimate" : "estimated direct dwells"}
          </small>
        </article>
        <article className="metric-card">
          <span>{t("conversionRate")}</span>
          <strong>{conversionRate}</strong>
          <small className="muted" style={{ fontSize: "12px", marginTop: "4px", display: "block" }}>
            {locale === "ro" ? "din priviri în scanări" : "views to scans"}
          </small>
        </article>
      </div>

      <section className="panel-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>{t("serviceStatus")}</h2>
            <span className={`status-dot ${health}`}>{health === "healthy" ? t("healthy") : health === "loading" ? "..." : t("unavailable")}</span>
          </div>
          <p>{health === "healthy" ? t("healthOk") : t("unavailable")}</p>
          <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <a href="#/displays" className="button secondary" style={{ fontSize: "13px", padding: "8px 12px" }}>
              {locale === "ro" ? "Gestionează ecrane" : "Manage displays"}
            </a>
            <a href="/offer" target="_blank" rel="noreferrer" className="button secondary" style={{ fontSize: "13px", padding: "8px 12px" }}>
              {locale === "ro" ? "Deschide pagina publică ↗" : "Open public offer page ↗"}
            </a>
          </div>
        </article>

        <article className="panel">
          <h2>{t("recentActivity")}</h2>
          {leads.length === 0 && devices.length === 0 ? (
            <p className="muted">{t("noActivity")}</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {leads.slice(0, 3).map((lead) => (
                <div key={lead.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span>
                    <strong>{lead.name}</strong> ({lead.email})
                  </span>
                  <small className="muted">
                    {new Date(lead.created_at).toLocaleTimeString(locale === "ro" ? "ro-RO" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                  </small>
                </div>
              ))}
              {devices.slice(0, 2).map((dev) => (
                <div key={dev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", padding: "6px 0", color: "#64748b" }}>
                  <span>
                    {locale === "ro" ? "Ecran:" : "Display:"} <strong>{dev.name}</strong>
                  </span>
                  <small className={dev.online ? "online" : "offline"}>
                    {dev.online ? "Online" : (locale === "ro" ? "Deconectat" : "Offline")}
                  </small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  );
}

function StatsPanel({ locale }: { locale: Locale }) {
  const [devices, setDevices] = useState<{ id: string; name: string; online: boolean; last_seen_at?: string; config: Record<string, unknown> }[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string; email: string; created_at: string; device_id?: string; device_name?: string }[]>([]);

  useEffect(() => {
    void authFetch("/api/devices")
      .then((res) => res.json() as Promise<{ devices: typeof devices }>)
      .then((p) => setDevices(p.devices || []));
    void authFetch("/api/leads")
      .then((res) => res.json() as Promise<{ leads: typeof leads }>)
      .then((p) => setLeads(p.leads || []));
  }, []);

  const totalLeads = leads.length;
  const onlineDisplays = devices.filter((d) => d.online).length;

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div className="metric-grid">
        <article className="metric-card">
          <span>{locale === "ro" ? "Contacte capturate" : "Captured Leads"}</span>
          <strong>{totalLeads}</strong>
        </article>
        <article className="metric-card">
          <span>{locale === "ro" ? "Ecrane online" : "Online Displays"}</span>
          <strong>{onlineDisplays} / {devices.length}</strong>
        </article>
        <article className="metric-card">
          <span>{locale === "ro" ? "Timp mediu privire" : "Avg Dwell Time"}</span>
          <strong>3.0s</strong>
        </article>
        <article className="metric-card">
          <span>{locale === "ro" ? "Rată de scanare" : "Scan Rate"}</span>
          <strong>{totalLeads > 0 ? "24%" : "—"}</strong>
        </article>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>{locale === "ro" ? "Performanță per ecran" : "Performance per display"}</h2>
        </div>
        {devices.length === 0 ? (
          <p className="muted">{locale === "ro" ? "Nu există ecrane configurate încă." : "No displays configured yet."}</p>
        ) : (
          <div className="table-responsive">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>{locale === "ro" ? "Nume ecran" : "Display Name"}</th>
                  <th>{locale === "ro" ? "Stare" : "Status"}</th>
                  <th>{locale === "ro" ? "Șablon activ" : "Template"}</th>
                  <th>{locale === "ro" ? "Timp privire" : "Dwell Time"}</th>
                  <th>{locale === "ro" ? "Contacte generate" : "Leads Generated"}</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const deviceLeads = leads.filter((l) => l.device_id === device.id || l.device_name === device.name).length;
                  const templateName = String(device.config?.template || "simple") === "recruit" ? "Recruit (Iris)" : "Simple (Soft Reveal)";
                  const dwell = `${Number(device.config?.lookTime || 3)}s`;
                  return (
                    <tr key={device.id}>
                      <td><strong>{device.name}</strong></td>
                      <td>
                        <span className={device.online ? "online" : "offline"} style={{ fontWeight: 600 }}>
                          {device.online ? "Online" : (locale === "ro" ? "Deconectat" : "Offline")}
                        </span>
                      </td>
                      <td>{templateName}</td>
                      <td>{dwell}</td>
                      <td><strong>{deviceLeads}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function HelpPanel({ locale }: { locale: Locale }) {
  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <article className="panel">
        <h2>{locale === "ro" ? "Ghid de configurare rapidă a ecranului" : "Quick setup guide"}</h2>
        <div className="guide-card">
          <h3>{locale === "ro" ? "1. Conectare hardware (Raspberry Pi 5)" : "1. Hardware connection (Raspberry Pi 5)"}</h3>
          <ol>
            <li>{locale === "ro" ? "Conectează cablul micro-HDMI / HDMI de la Raspberry Pi la televizor." : "Connect HDMI cable from Raspberry Pi to TV."}</li>
            <li>{locale === "ro" ? "Conectează camera Logitech C920/C922 la un port USB 3.0 (albastru)." : "Connect Logitech C920/C922 camera to USB 3.0 port."}</li>
            <li>{locale === "ro" ? "Alimentează Raspberry Pi cu sursa oficială de 27W USB-C." : "Power Raspberry Pi with official 27W USB-C supply."}</li>
          </ol>
        </div>
        <div className="guide-card">
          <h3>{locale === "ro" ? "2. Asocierea ecranului (Pairing)" : "2. Pairing the display"}</h3>
          <ol>
            <li>{locale === "ro" ? "La pornire, televizorul va afișa automat un cod din 6 cifre (ex: 123 456)." : "On boot, TV displays a 6-digit code (e.g. 123 456)."}</li>
            <li>{locale === "ro" ? "Mergi în panoul web la Ecrane → Adaugă ecran." : "In dashboard, navigate to Displays → Add display."}</li>
            <li>{locale === "ro" ? "Introdu codul de 6 cifre și un nume prietenos (ex: TV Recepție)." : "Enter the 6-digit code and a display name (e.g. Lobby TV)."}</li>
            <li>{locale === "ro" ? "Ecranul se conectează instant și începe redarea materialelor de standby." : "Display pairs immediately and starts playing standby media."}</li>
          </ol>
        </div>
        <div className="guide-card">
          <h3>{locale === "ro" ? "3. Algoritmi de atenție & confidențialitate" : "3. Attention algorithms & privacy"}</h3>
          <ul>
            <li><strong>{locale === "ro" ? "Detectare privire (Gaze Attention):" : "Looking detection:"}</strong> {locale === "ro" ? "MediaPipe analizează orientarea capului (yaw și pitch din keypoints faciale). Doar dacă o persoană privește direct spre ecran timp de ≥ 3 secunde se declanșează oferta." : "MediaPipe calculates head direction (yaw/pitch ratios). Only continuous direct gaze triggers the offer."}</li>
            <li><strong>{locale === "ro" ? "Fuziune facială difuză (Face Blending):" : "Face blending:"}</strong> {locale === "ro" ? "Imaginea privitorului este decupată și compusă printr-o mască eliptică difuză (fără chenar sau margini dure), stabilizată cu filtrul One Euro pentru eliminarea oricărui tremur." : "Face is softly blended into the video via feathered elliptical mask and smoothed with a One Euro filter."}</li>
            <li><strong>{locale === "ro" ? "Confidențialitate absolută:" : "Privacy guarantee:"}</strong> {locale === "ro" ? "Fluxul video este procesat exclusiv local în memoria RAM a dispozitivului. Nicio imagine nu se salvează pe disc și nu se transmite la server." : "Frames are processed strictly locally in device RAM and never written to disk or sent to servers."}</li>
          </ul>
        </div>
      </article>
    </div>
  );
}

function AccountPanel({ locale, setLocale }: { locale: Locale; setLocale: (loc: Locale) => void }) {
  return (
    <article className="panel" style={{ maxWidth: "640px" }}>
      <h2>{locale === "ro" ? "Setări cont & spațiu de lucru" : "Account & workspace settings"}</h2>
      <div className="account-row">
        <span>{locale === "ro" ? "Utilizator conectat" : "Logged in user"}</span>
        <strong>admin</strong>
      </div>
      <div className="account-row">
        <span>{locale === "ro" ? "Rol utilizator" : "Role"}</span>
        <strong>{locale === "ro" ? "Administrator Spațiu de Lucru" : "Workspace Administrator"}</strong>
      </div>
      <div className="account-row">
        <span>{locale === "ro" ? "Server conectat" : "Connected server"}</span>
        <code>https://adsense.davidpetrea.ro</code>
      </div>
      <div className="account-row">
        <span>{locale === "ro" ? "Versiune aplicație" : "App version"}</span>
        <strong>v0.1.0 (Demo Ready)</strong>
      </div>
      <div className="account-row">
        <span>{locale === "ro" ? "Limbă panou" : "Panel language"}</span>
        <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #d6deea", background: "#fff" }}>
          <option value="ro">Română</option>
          <option value="en">English</option>
        </select>
      </div>
      <div style={{ marginTop: "24px" }}>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            window.localStorage.removeItem("adsense-session");
            window.location.reload();
          }}
        >
          {locale === "ro" ? "Deconectare" : "Sign out"}
        </button>
      </div>
    </article>
  );
}

function App() {
  const route = useRoute();
  const [locale, setLocale] = useLocale();
  const t = (key: TranslationKey) => translate(locale, key);
  useEffect(() => { document.documentElement.lang = locale; document.title = t("appName"); }, [locale]);
  if (route === "offer") return <OfferPage locale={locale} />;
  if (route === "privacy") return <PublicPage locale={locale} title="privacyTitle" body="privacyBody" />;
  if (route === "preview") return <RemoteLivePreviewPage locale={locale} />;
  return <Dashboard locale={locale} setLocale={setLocale} route={route} t={t} />;
}

function Dashboard({ locale, setLocale, route, t }: { locale: Locale; setLocale: (locale: Locale) => void; route: Route; t: (key: TranslationKey) => string }) {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(window.localStorage.getItem("adsense-session")));
  const [health, setHealth] = useState<ApiState>("loading");
  useEffect(() => { void getApiState(() => fetch(API_PATHS.health)).then(setHealth); }, []);

  useEffect(() => {
    const handleUnauthorized = () => setLoggedIn(false);
    window.addEventListener("adsense:unauthorized", handleUnauthorized);
    if (loggedIn) {
      authFetch("/api/session/me").then((res) => {
        if (!res.ok) setLoggedIn(false);
      }).catch(() => {});
    }
    return () => window.removeEventListener("adsense:unauthorized", handleUnauthorized);
  }, [loggedIn]);
  const nav = useMemo(() => Object.entries(routeKeys) as [Exclude<Route, "offer" | "privacy" | "preview">, TranslationKey][], []);
  if (!loggedIn) return <LoginShell locale={locale} />;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">{t("skipToContent")}</a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>{t("appName")}</strong>
            <span>{t("workspace")}</span>
          </div>
        </div>
        <p className="nav-label">{t("navigation")}</p>
        <nav aria-label={t("navigation")}>
          {nav.map(([key, label]) => (
            <a className={route === key ? "active" : ""} href={`#/${key}`} key={key}>
              {t(label)}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="/privacy">{t("privacyTitle")}</a>
          <button
            className="text-button"
            onClick={() => {
              window.localStorage.removeItem("adsense-session");
              setLoggedIn(false);
            }}
          >
            {t("signOut")}
          </button>
        </div>
      </aside>
      <main className="content" id="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t("appName")}</p>
            <h1>{t(routeKeys[route as Exclude<Route, "offer" | "privacy">] ?? "dashboard")}</h1>
          </div>
          <label className="language-select">
            {t("language")}
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              {SUPPORTED_LOCALES.map((item) => (
                <option value={item} key={item}>
                  {t(item === "ro" ? "romanian" : "english")}
                </option>
              ))}
            </select>
          </label>
        </header>
        <PageContent route={route} t={t} health={health} locale={locale} setLocale={setLocale} />
      </main>
    </div>
  );
}

function PageContent({ route, t, health, locale, setLocale }: { route: Route; t: (key: TranslationKey) => string; health: ApiState; locale: Locale; setLocale: (loc: Locale) => void }) {
  if (route === "dashboard") return <DashboardOverview locale={locale} t={t} health={health} />;
  if (route === "displays") return <DisplaysView locale={locale} />;
  if (route === "media") return <MediaUploader locale={locale} />;
  if (route === "leads") return <LeadsPanel locale={locale} />;
  if (route === "stats") return <StatsPanel locale={locale} />;
  if (route === "help") return <HelpPanel locale={locale} />;
  if (route === "account") return <AccountPanel locale={locale} setLocale={setLocale} />;
  return <DashboardOverview locale={locale} t={t} health={health} />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
