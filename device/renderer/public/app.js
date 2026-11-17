const root = document.querySelector("#app");
const stateUrl = "/api/state";
let lastPhase = "";
let state = {};
let lookingSince = 0;
let offerUntil = 0;

function setup(pairing) {
  const code = String(pairing?.code || "------");
  const english = new URLSearchParams(location.search).get("lang") === "en";
  root.innerHTML = `<section class="setup"><h1>${english ? "Go to adsense.davidpetrea.ro → Add display and enter this code:" : "Mergi pe adsense.davidpetrea.ro → Adaugă ecran și introdu codul:"}</h1><p class="code">${code.slice(0, 3)} ${code.slice(3)}</p></section>`;
}

function standby() {
  root.innerHTML = '<section class="standby"><h1>STANDBY</h1></section><div class="bubbles"></div>';
}

function offer(config) {
  const link = String(config?.offerLink || `${location.protocol}//${location.host}/offer`);
  root.innerHTML = `<section class="offer"><div class="offer-copy"><h1>${config?.headline || "20% reducere"}</h1><p>${config?.subtext || "Scaneaza codul QR"}</p></div><div class="offer-side"><div class="qr" aria-label="Cod QR"></div><p>${link}</p></div></section>`;
}

function render(next) {
  state = next || {};
  const pairing = state.sync?.pairing;
  const paired = Boolean(state.sync?.device_token);
  const phase = paired ? (state.sync?.phase || (Date.now() < offerUntil ? "offer" : "standby")) : "setup";
  if (phase === lastPhase && phase !== "setup") return;
  lastPhase = phase;
  if (!paired) setup(pairing);
  else if (phase === "offer") offer(state.sync?.device_config || {});
  else standby();
}

function renderFaces(message) {
  if (!state.sync?.device_token || !message || message.t !== "faces") return;
  const bubbles = document.querySelector(".bubbles");
  if (!bubbles) return;
  bubbles.innerHTML = message.faces.map((face) => `<span class="bubble" style="left:${face.x * 100}%;top:${face.y * 100}%;width:${face.w * 100}%;height:${face.h * 100}%"></span>`).join("");
  const looking = message.faces.some((face) => face.looking);
  if (looking && !lookingSince) lookingSince = Date.now();
  if (!looking) lookingSince = 0;
  if (lookingSince && Date.now() - lookingSince >= 2000 && !offerUntil) {
    offerUntil = Date.now() + 3000;
    render({ ...state, sync: { ...state.sync, phase: "offer" } });
  }
  if (offerUntil && Date.now() >= offerUntil) {
    offerUntil = 0;
    render({ ...state, sync: { ...state.sync, phase: "standby" } });
  }
}

async function poll() {
  try { render(await (await fetch(stateUrl, { cache: "no-store" })).json()); } catch { if (!lastPhase) setup({}); }
}
poll();
setInterval(poll, 3000);
const vision = new WebSocket(`ws://${location.hostname}:8766`);
vision.onmessage = (event) => {
  try { renderFaces(JSON.parse(event.data)); } catch {}
};
