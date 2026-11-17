const root = document.querySelector("#app");
const stateUrl = "/api/state";
let lastPhase = "";
let state = {};

function setup(pairing) {
  const code = String(pairing?.code || "------");
  root.innerHTML = `<section class="setup"><h1>Mergi pe adsense.davidpetrea.ro → Adaugă ecran și introdu codul:</h1><p class="code">${code.slice(0, 3)} ${code.slice(3)}</p></section>`;
}

function standby() {
  root.innerHTML = '<section class="standby"><h1>STANDBY</h1></section>';
}

function offer(config) {
  const link = String(config?.offerLink || `${location.protocol}//${location.host}/offer`);
  root.innerHTML = `<section class="offer"><div class="offer-copy"><h1>${config?.headline || "20% reducere"}</h1><p>${config?.subtext || "Scaneaza codul QR"}</p></div><div class="offer-side"><div class="qr" aria-label="Cod QR"></div><p>${link}</p></div></section>`;
}

function render(next) {
  state = next || {};
  const pairing = state.sync?.pairing;
  const paired = Boolean(state.sync?.device_token);
  const phase = paired ? (state.sync?.phase || "standby") : "setup";
  if (phase === lastPhase && phase !== "setup") return;
  lastPhase = phase;
  if (!paired) setup(pairing);
  else if (phase === "offer") offer(state.sync?.device_config || {});
  else standby();
}

async function poll() {
  try { render(await (await fetch(stateUrl, { cache: "no-store" })).json()); } catch { if (!lastPhase) setup({}); }
}
poll();
setInterval(poll, 3000);
