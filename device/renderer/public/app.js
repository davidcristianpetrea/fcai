var ce = Object.defineProperty;
var le = (o, t, e) => t in o ? ce(o, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : o[t] = e;
var m = (o, t, e) => le(o, typeof t != "symbol" ? t + "" : t, e);
class de {
  constructor(t = {}) {
    m(this, "state", "STANDBY");
    m(this, "stateStartedMs", 0);
    m(this, "offerStartedMs", 0);
    m(this, "lastFaceSeenMs", null);
    m(this, "triggerFaceId", null);
    m(this, "cooldownUntilMs", 0);
    m(this, "config");
    m(this, "tracks", /* @__PURE__ */ new Map());
    m(this, "triggeredTrackIds", /* @__PURE__ */ new Set());
    this.config = {
      dwellSeconds: t.dwellSeconds ?? 3,
      offerMinSeconds: t.offerMinSeconds ?? 20,
      exitAfterNobodySeconds: t.exitAfterNobodySeconds ?? 6,
      maxOfferSeconds: t.maxOfferSeconds,
      cooldownSeconds: t.cooldownSeconds ?? 8,
      lookingResetSeconds: t.lookingResetSeconds ?? 0.4,
      triggeringDurationMs: t.triggeringDurationMs ?? 1e3,
      exitingDurationMs: t.exitingDurationMs ?? 1e3,
      absentToRetriggerSeconds: t.absentToRetriggerSeconds ?? 3
    };
  }
  get isCooldownActive() {
    return this.state === "COOLDOWN";
  }
  get effectivePhase() {
    return this.state === "COOLDOWN" ? "STANDBY" : this.state;
  }
  updateConfig(t) {
    t.dwellSeconds !== void 0 && (this.config.dwellSeconds = t.dwellSeconds), t.offerMinSeconds !== void 0 && (this.config.offerMinSeconds = t.offerMinSeconds), t.exitAfterNobodySeconds !== void 0 && (this.config.exitAfterNobodySeconds = t.exitAfterNobodySeconds), t.maxOfferSeconds !== void 0 && (this.config.maxOfferSeconds = t.maxOfferSeconds), t.cooldownSeconds !== void 0 && (this.config.cooldownSeconds = t.cooldownSeconds), t.lookingResetSeconds !== void 0 && (this.config.lookingResetSeconds = t.lookingResetSeconds), t.triggeringDurationMs !== void 0 && (this.config.triggeringDurationMs = t.triggeringDurationMs), t.exitingDurationMs !== void 0 && (this.config.exitingDurationMs = t.exitingDurationMs), t.absentToRetriggerSeconds !== void 0 && (this.config.absentToRetriggerSeconds = t.absentToRetriggerSeconds);
  }
  forceTrigger(t, e = 1) {
    this.state = "TRIGGERING", this.stateStartedMs = t, this.offerStartedMs = t, this.lastFaceSeenMs = t, this.triggerFaceId = e, this.triggeredTrackIds.add(e);
  }
  update(t, e) {
    const i = /* @__PURE__ */ new Set();
    for (const n of t) {
      i.add(n.id);
      let r = this.tracks.get(n.id);
      r ? (r.lastSeenMs = e, n.looking ? (r.notLookingSinceMs !== void 0 ? (e - r.notLookingSinceMs > this.config.lookingResetSeconds * 1e3 && (r.lookingSinceMs = e), r.notLookingSinceMs = void 0) : r.lookingSinceMs === void 0 && (r.lookingSinceMs = e), r.isLooking = !0) : (r.isLooking = !1, r.notLookingSinceMs === void 0 ? r.notLookingSinceMs = e : e - r.notLookingSinceMs > this.config.lookingResetSeconds * 1e3 && (r.lookingSinceMs = void 0))) : (r = {
        id: n.id,
        firstSeenMs: e,
        lastSeenMs: e,
        isLooking: !!n.looking,
        lookingSinceMs: n.looking ? e : void 0
      }, this.tracks.set(n.id, r));
    }
    for (const [n, r] of this.tracks.entries())
      i.has(n) || (r.isLooking = !1, r.notLookingSinceMs === void 0 ? r.notLookingSinceMs = e : e - r.notLookingSinceMs > this.config.lookingResetSeconds * 1e3 && (r.lookingSinceMs = void 0), e - r.lastSeenMs > this.config.absentToRetriggerSeconds * 1e3 && this.triggeredTrackIds.delete(n), e - r.lastSeenMs > 15e3 && this.tracks.delete(n));
    switch (t.length > 0 && (this.lastFaceSeenMs = e), this.state) {
      case "STANDBY": {
        for (const n of t) {
          const r = this.tracks.get(n.id);
          if (!(!r || this.triggeredTrackIds.has(n.id)) && r.lookingSinceMs !== void 0 && e - r.lookingSinceMs >= this.config.dwellSeconds * 1e3) {
            this.triggeredTrackIds.add(n.id), this.triggerFaceId = n.id, this.state = "TRIGGERING", this.stateStartedMs = e, this.offerStartedMs = e, this.lastFaceSeenMs = e;
            break;
          }
        }
        break;
      }
      case "TRIGGERING": {
        e - this.stateStartedMs >= this.config.triggeringDurationMs && (this.state = "OFFER", this.stateStartedMs = e);
        break;
      }
      case "OFFER": {
        const n = e - this.offerStartedMs >= this.config.offerMinSeconds * 1e3, r = this.lastFaceSeenMs === null || e - this.lastFaceSeenMs >= this.config.exitAfterNobodySeconds * 1e3, a = this.config.maxOfferSeconds !== void 0 && e - this.offerStartedMs >= this.config.maxOfferSeconds * 1e3;
        (n && r || a) && (this.state = "EXITING", this.stateStartedMs = e);
        break;
      }
      case "EXITING": {
        e - this.stateStartedMs >= this.config.exitingDurationMs && (this.state = "COOLDOWN", this.stateStartedMs = e, this.cooldownUntilMs = e + this.config.cooldownSeconds * 1e3);
        break;
      }
      case "COOLDOWN": {
        e >= this.cooldownUntilMs && (this.state = "STANDBY", this.stateStartedMs = e);
        break;
      }
    }
    return this.state;
  }
}
function Tt(o, t) {
  const e = 1 / (2 * Math.PI * t), i = 1 / o;
  return 1 / (1 + e / i);
}
class It {
  constructor() {
    m(this, "y", null);
    m(this, "s", null);
  }
  filter(t, e) {
    return this.y === null ? (this.s = t, this.y = t, t) : (this.y = e * t + (1 - e) * this.s, this.s = this.y, this.y);
  }
  hasLast() {
    return this.y !== null;
  }
  last() {
    return this.y ?? 0;
  }
  reset() {
    this.y = null, this.s = null;
  }
}
class Q {
  constructor(t = 1, e = 7e-3, i = 1) {
    m(this, "minCutoff");
    m(this, "beta");
    m(this, "dCutoff");
    m(this, "xFilter", new It());
    m(this, "dxFilter", new It());
    m(this, "lastTime", null);
    this.minCutoff = t, this.beta = e, this.dCutoff = i;
  }
  filter(t, e) {
    if (this.lastTime === null)
      return this.lastTime = e, this.xFilter.filter(t, 1);
    const i = Math.max((e - this.lastTime) / 1e3, 1e-4);
    this.lastTime = e;
    const n = 1 / i, r = this.xFilter.hasLast() ? (t - this.xFilter.last()) * n : 0, a = this.dxFilter.filter(r, Tt(n, this.dCutoff)), s = this.minCutoff + this.beta * Math.abs(a);
    return this.xFilter.filter(t, Tt(n, s));
  }
  reset() {
    this.lastTime = null, this.xFilter.reset(), this.dxFilter.reset();
  }
}
class ue {
  constructor(t = 4) {
    m(this, "tracks", /* @__PURE__ */ new Map());
    m(this, "maxPeople");
    m(this, "offscreenCanvas", null);
    m(this, "offscreenCtx", null);
    this.maxPeople = t;
  }
  getTrack(t) {
    return this.tracks.get(t);
  }
  getActiveTracks() {
    return Array.from(this.tracks.values()).filter((t) => t.alpha > 0);
  }
  update(t, e, i, n) {
    const r = /* @__PURE__ */ new Set(), a = t.slice(0, this.maxPeople), s = n * 0.1, c = n * 0.28;
    for (const l of a) {
      r.add(l.id);
      const u = (l.x + l.w / 2) * i, h = (l.y + l.h / 2 - 0.04 * l.h) * n, f = Math.max(s, Math.min(c, 1.7 * l.h * n));
      let d = this.tracks.get(l.id);
      if (d) {
        if (d.lastSeenMs = e, d.currentX = d.filterX.filter(u, e), d.currentY = d.filterY.filter(h, e), d.currentSize = d.filterSize.filter(f, e), l.crop_jpeg && l.crop_jpeg !== d.cropJpeg && (d.cropJpeg = l.crop_jpeg, typeof Image < "u")) {
          const g = new Image();
          g.onload = () => {
            d.image = g;
          }, g.src = l.crop_jpeg;
        }
      } else {
        if (d = {
          id: l.id,
          filterX: new Q(0.3, 8e-3),
          filterY: new Q(0.3, 8e-3),
          filterSize: new Q(0.3, 8e-3),
          currentX: u,
          currentY: h,
          currentSize: f,
          firstSeenMs: e,
          lastSeenMs: e,
          alpha: 0,
          scale: 0.85,
          cropJpeg: l.crop_jpeg
        }, d.filterX.filter(u, e), d.filterY.filter(h, e), d.filterSize.filter(f, e), typeof Image < "u" && l.crop_jpeg) {
          const g = new Image();
          g.onload = () => {
            d.image = g;
          }, g.src = l.crop_jpeg;
        }
        this.tracks.set(l.id, d);
      }
      const p = Math.min(1, Math.max(0, (e - d.firstSeenMs) / 250));
      d.alpha = p, d.scale = 0.85 + 0.15 * p;
    }
    for (const [l, u] of this.tracks.entries())
      if (!r.has(l)) {
        const h = e - u.lastSeenMs;
        if (h <= 600)
          u.alpha = 1, u.scale = 1;
        else if (h <= 900) {
          const f = (h - 600) / 300;
          u.alpha = Math.max(0, 1 - f), u.scale = Math.max(0.85, 1 - 0.15 * f);
        } else
          this.tracks.delete(l);
      }
    return this.getActiveTracks();
  }
  render(t, e, i) {
    if (!(typeof document > "u") && (this.offscreenCanvas || (this.offscreenCanvas = document.createElement("canvas"), this.offscreenCtx = this.offscreenCanvas.getContext("2d")), !(!this.offscreenCtx || !this.offscreenCanvas)))
      for (const n of this.getActiveTracks()) {
        const r = n.image;
        if (!r || !r.complete || r.naturalWidth === 0) continue;
        const a = Math.round(n.currentSize * n.scale);
        if (a <= 0) continue;
        (this.offscreenCanvas.width !== a || this.offscreenCanvas.height !== a) && (this.offscreenCanvas.width = a, this.offscreenCanvas.height = a);
        const s = this.offscreenCtx;
        s.clearRect(0, 0, a, a), s.globalCompositeOperation = "source-over", s.drawImage(r, 0, 0, a, a), s.globalCompositeOperation = "destination-in";
        const c = a / 2, l = s.createRadialGradient(c, c, 0, c, c, c);
        l.addColorStop(0, "rgba(0,0,0,1)"), l.addColorStop(0.2, "rgba(0,0,0,0.98)"), l.addColorStop(0.35, "rgba(0,0,0,0.88)"), l.addColorStop(0.5, "rgba(0,0,0,0.70)"), l.addColorStop(0.65, "rgba(0,0,0,0.48)"), l.addColorStop(0.8, "rgba(0,0,0,0.24)"), l.addColorStop(0.92, "rgba(0,0,0,0.07)"), l.addColorStop(1, "rgba(0,0,0,0)"), s.fillStyle = l, s.fillRect(0, 0, a, a), t.save(), t.globalAlpha = n.alpha, t.drawImage(
          this.offscreenCanvas,
          Math.round(n.currentX - a / 2),
          Math.round(n.currentY - a / 2),
          a,
          a
        ), t.restore();
      }
  }
}
function fe(o) {
  return o && o.__esModule && Object.prototype.hasOwnProperty.call(o, "default") ? o.default : o;
}
var Y = {}, W, kt;
function he() {
  return kt || (kt = 1, W = function() {
    return typeof Promise == "function" && Promise.prototype && Promise.prototype.then;
  }), W;
}
var Z = {}, U = {}, xt;
function O() {
  if (xt) return U;
  xt = 1;
  let o;
  const t = [
    0,
    // Not used
    26,
    44,
    70,
    100,
    134,
    172,
    196,
    242,
    292,
    346,
    404,
    466,
    532,
    581,
    655,
    733,
    815,
    901,
    991,
    1085,
    1156,
    1258,
    1364,
    1474,
    1588,
    1706,
    1828,
    1921,
    2051,
    2185,
    2323,
    2465,
    2611,
    2761,
    2876,
    3034,
    3196,
    3362,
    3532,
    3706
  ];
  return U.getSymbolSize = function(i) {
    if (!i) throw new Error('"version" cannot be null or undefined');
    if (i < 1 || i > 40) throw new Error('"version" should be in range from 1 to 40');
    return i * 4 + 17;
  }, U.getSymbolTotalCodewords = function(i) {
    return t[i];
  }, U.getBCHDigit = function(e) {
    let i = 0;
    for (; e !== 0; )
      i++, e >>>= 1;
    return i;
  }, U.setToSJISFunction = function(i) {
    if (typeof i != "function")
      throw new Error('"toSJISFunc" is not a valid function.');
    o = i;
  }, U.isKanjiModeEnabled = function() {
    return typeof o < "u";
  }, U.toSJIS = function(i) {
    return o(i);
  }, U;
}
var tt = {}, At;
function Mt() {
  return At || (At = 1, function(o) {
    o.L = { bit: 1 }, o.M = { bit: 0 }, o.Q = { bit: 3 }, o.H = { bit: 2 };
    function t(e) {
      if (typeof e != "string")
        throw new Error("Param is not a string");
      switch (e.toLowerCase()) {
        case "l":
        case "low":
          return o.L;
        case "m":
        case "medium":
          return o.M;
        case "q":
        case "quartile":
          return o.Q;
        case "h":
        case "high":
          return o.H;
        default:
          throw new Error("Unknown EC Level: " + e);
      }
    }
    o.isValid = function(i) {
      return i && typeof i.bit < "u" && i.bit >= 0 && i.bit < 4;
    }, o.from = function(i, n) {
      if (o.isValid(i))
        return i;
      try {
        return t(i);
      } catch {
        return n;
      }
    };
  }(tt)), tt;
}
var et, Rt;
function ge() {
  if (Rt) return et;
  Rt = 1;
  function o() {
    this.buffer = [], this.length = 0;
  }
  return o.prototype = {
    get: function(t) {
      const e = Math.floor(t / 8);
      return (this.buffer[e] >>> 7 - t % 8 & 1) === 1;
    },
    put: function(t, e) {
      for (let i = 0; i < e; i++)
        this.putBit((t >>> e - i - 1 & 1) === 1);
    },
    getLengthInBits: function() {
      return this.length;
    },
    putBit: function(t) {
      const e = Math.floor(this.length / 8);
      this.buffer.length <= e && this.buffer.push(0), t && (this.buffer[e] |= 128 >>> this.length % 8), this.length++;
    }
  }, et = o, et;
}
var nt, Bt;
function me() {
  if (Bt) return nt;
  Bt = 1;
  function o(t) {
    if (!t || t < 1)
      throw new Error("BitMatrix size must be defined and greater than 0");
    this.size = t, this.data = new Uint8Array(t * t), this.reservedBit = new Uint8Array(t * t);
  }
  return o.prototype.set = function(t, e, i, n) {
    const r = t * this.size + e;
    this.data[r] = i, n && (this.reservedBit[r] = !0);
  }, o.prototype.get = function(t, e) {
    return this.data[t * this.size + e];
  }, o.prototype.xor = function(t, e, i) {
    this.data[t * this.size + e] ^= i;
  }, o.prototype.isReserved = function(t, e) {
    return this.reservedBit[t * this.size + e];
  }, nt = o, nt;
}
var it = {}, Lt;
function pe() {
  return Lt || (Lt = 1, function(o) {
    const t = O().getSymbolSize;
    o.getRowColCoords = function(i) {
      if (i === 1) return [];
      const n = Math.floor(i / 7) + 2, r = t(i), a = r === 145 ? 26 : Math.ceil((r - 13) / (2 * n - 2)) * 2, s = [r - 7];
      for (let c = 1; c < n - 1; c++)
        s[c] = s[c - 1] - a;
      return s.push(6), s.reverse();
    }, o.getPositions = function(i) {
      const n = [], r = o.getRowColCoords(i), a = r.length;
      for (let s = 0; s < a; s++)
        for (let c = 0; c < a; c++)
          s === 0 && c === 0 || // top-left
          s === 0 && c === a - 1 || // bottom-left
          s === a - 1 && c === 0 || n.push([r[s], r[c]]);
      return n;
    };
  }(it)), it;
}
var rt = {}, Nt;
function ye() {
  if (Nt) return rt;
  Nt = 1;
  const o = O().getSymbolSize, t = 7;
  return rt.getPositions = function(i) {
    const n = o(i);
    return [
      // top-left
      [0, 0],
      // top-right
      [n - t, 0],
      // bottom-left
      [0, n - t]
    ];
  }, rt;
}
var ot = {}, Pt;
function Ce() {
  return Pt || (Pt = 1, function(o) {
    o.Patterns = {
      PATTERN000: 0,
      PATTERN001: 1,
      PATTERN010: 2,
      PATTERN011: 3,
      PATTERN100: 4,
      PATTERN101: 5,
      PATTERN110: 6,
      PATTERN111: 7
    };
    const t = {
      N1: 3,
      N2: 3,
      N3: 40,
      N4: 10
    };
    o.isValid = function(n) {
      return n != null && n !== "" && !isNaN(n) && n >= 0 && n <= 7;
    }, o.from = function(n) {
      return o.isValid(n) ? parseInt(n, 10) : void 0;
    }, o.getPenaltyN1 = function(n) {
      const r = n.size;
      let a = 0, s = 0, c = 0, l = null, u = null;
      for (let h = 0; h < r; h++) {
        s = c = 0, l = u = null;
        for (let f = 0; f < r; f++) {
          let d = n.get(h, f);
          d === l ? s++ : (s >= 5 && (a += t.N1 + (s - 5)), l = d, s = 1), d = n.get(f, h), d === u ? c++ : (c >= 5 && (a += t.N1 + (c - 5)), u = d, c = 1);
        }
        s >= 5 && (a += t.N1 + (s - 5)), c >= 5 && (a += t.N1 + (c - 5));
      }
      return a;
    }, o.getPenaltyN2 = function(n) {
      const r = n.size;
      let a = 0;
      for (let s = 0; s < r - 1; s++)
        for (let c = 0; c < r - 1; c++) {
          const l = n.get(s, c) + n.get(s, c + 1) + n.get(s + 1, c) + n.get(s + 1, c + 1);
          (l === 4 || l === 0) && a++;
        }
      return a * t.N2;
    }, o.getPenaltyN3 = function(n) {
      const r = n.size;
      let a = 0, s = 0, c = 0;
      for (let l = 0; l < r; l++) {
        s = c = 0;
        for (let u = 0; u < r; u++)
          s = s << 1 & 2047 | n.get(l, u), u >= 10 && (s === 1488 || s === 93) && a++, c = c << 1 & 2047 | n.get(u, l), u >= 10 && (c === 1488 || c === 93) && a++;
      }
      return a * t.N3;
    }, o.getPenaltyN4 = function(n) {
      let r = 0;
      const a = n.data.length;
      for (let c = 0; c < a; c++) r += n.data[c];
      return Math.abs(Math.ceil(r * 100 / a / 5) - 10) * t.N4;
    };
    function e(i, n, r) {
      switch (i) {
        case o.Patterns.PATTERN000:
          return (n + r) % 2 === 0;
        case o.Patterns.PATTERN001:
          return n % 2 === 0;
        case o.Patterns.PATTERN010:
          return r % 3 === 0;
        case o.Patterns.PATTERN011:
          return (n + r) % 3 === 0;
        case o.Patterns.PATTERN100:
          return (Math.floor(n / 2) + Math.floor(r / 3)) % 2 === 0;
        case o.Patterns.PATTERN101:
          return n * r % 2 + n * r % 3 === 0;
        case o.Patterns.PATTERN110:
          return (n * r % 2 + n * r % 3) % 2 === 0;
        case o.Patterns.PATTERN111:
          return (n * r % 3 + (n + r) % 2) % 2 === 0;
        default:
          throw new Error("bad maskPattern:" + i);
      }
    }
    o.applyMask = function(n, r) {
      const a = r.size;
      for (let s = 0; s < a; s++)
        for (let c = 0; c < a; c++)
          r.isReserved(c, s) || r.xor(c, s, e(n, c, s));
    }, o.getBestMask = function(n, r) {
      const a = Object.keys(o.Patterns).length;
      let s = 0, c = 1 / 0;
      for (let l = 0; l < a; l++) {
        r(l), o.applyMask(l, n);
        const u = o.getPenaltyN1(n) + o.getPenaltyN2(n) + o.getPenaltyN3(n) + o.getPenaltyN4(n);
        o.applyMask(l, n), u < c && (c = u, s = l);
      }
      return s;
    };
  }(ot)), ot;
}
var H = {}, Ft;
function ne() {
  if (Ft) return H;
  Ft = 1;
  const o = Mt(), t = [
    // L  M  Q  H
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    2,
    2,
    1,
    2,
    2,
    4,
    1,
    2,
    4,
    4,
    2,
    4,
    4,
    4,
    2,
    4,
    6,
    5,
    2,
    4,
    6,
    6,
    2,
    5,
    8,
    8,
    4,
    5,
    8,
    8,
    4,
    5,
    8,
    11,
    4,
    8,
    10,
    11,
    4,
    9,
    12,
    16,
    4,
    9,
    16,
    16,
    6,
    10,
    12,
    18,
    6,
    10,
    17,
    16,
    6,
    11,
    16,
    19,
    6,
    13,
    18,
    21,
    7,
    14,
    21,
    25,
    8,
    16,
    20,
    25,
    8,
    17,
    23,
    25,
    9,
    17,
    23,
    34,
    9,
    18,
    25,
    30,
    10,
    20,
    27,
    32,
    12,
    21,
    29,
    35,
    12,
    23,
    34,
    37,
    12,
    25,
    34,
    40,
    13,
    26,
    35,
    42,
    14,
    28,
    38,
    45,
    15,
    29,
    40,
    48,
    16,
    31,
    43,
    51,
    17,
    33,
    45,
    54,
    18,
    35,
    48,
    57,
    19,
    37,
    51,
    60,
    19,
    38,
    53,
    63,
    20,
    40,
    56,
    66,
    21,
    43,
    59,
    70,
    22,
    45,
    62,
    74,
    24,
    47,
    65,
    77,
    25,
    49,
    68,
    81
  ], e = [
    // L  M  Q  H
    7,
    10,
    13,
    17,
    10,
    16,
    22,
    28,
    15,
    26,
    36,
    44,
    20,
    36,
    52,
    64,
    26,
    48,
    72,
    88,
    36,
    64,
    96,
    112,
    40,
    72,
    108,
    130,
    48,
    88,
    132,
    156,
    60,
    110,
    160,
    192,
    72,
    130,
    192,
    224,
    80,
    150,
    224,
    264,
    96,
    176,
    260,
    308,
    104,
    198,
    288,
    352,
    120,
    216,
    320,
    384,
    132,
    240,
    360,
    432,
    144,
    280,
    408,
    480,
    168,
    308,
    448,
    532,
    180,
    338,
    504,
    588,
    196,
    364,
    546,
    650,
    224,
    416,
    600,
    700,
    224,
    442,
    644,
    750,
    252,
    476,
    690,
    816,
    270,
    504,
    750,
    900,
    300,
    560,
    810,
    960,
    312,
    588,
    870,
    1050,
    336,
    644,
    952,
    1110,
    360,
    700,
    1020,
    1200,
    390,
    728,
    1050,
    1260,
    420,
    784,
    1140,
    1350,
    450,
    812,
    1200,
    1440,
    480,
    868,
    1290,
    1530,
    510,
    924,
    1350,
    1620,
    540,
    980,
    1440,
    1710,
    570,
    1036,
    1530,
    1800,
    570,
    1064,
    1590,
    1890,
    600,
    1120,
    1680,
    1980,
    630,
    1204,
    1770,
    2100,
    660,
    1260,
    1860,
    2220,
    720,
    1316,
    1950,
    2310,
    750,
    1372,
    2040,
    2430
  ];
  return H.getBlocksCount = function(n, r) {
    switch (r) {
      case o.L:
        return t[(n - 1) * 4 + 0];
      case o.M:
        return t[(n - 1) * 4 + 1];
      case o.Q:
        return t[(n - 1) * 4 + 2];
      case o.H:
        return t[(n - 1) * 4 + 3];
      default:
        return;
    }
  }, H.getTotalCodewordsCount = function(n, r) {
    switch (r) {
      case o.L:
        return e[(n - 1) * 4 + 0];
      case o.M:
        return e[(n - 1) * 4 + 1];
      case o.Q:
        return e[(n - 1) * 4 + 2];
      case o.H:
        return e[(n - 1) * 4 + 3];
      default:
        return;
    }
  }, H;
}
var st = {}, G = {}, Dt;
function Se() {
  if (Dt) return G;
  Dt = 1;
  const o = new Uint8Array(512), t = new Uint8Array(256);
  return function() {
    let i = 1;
    for (let n = 0; n < 255; n++)
      o[n] = i, t[i] = n, i <<= 1, i & 256 && (i ^= 285);
    for (let n = 255; n < 512; n++)
      o[n] = o[n - 255];
  }(), G.log = function(i) {
    if (i < 1) throw new Error("log(" + i + ")");
    return t[i];
  }, G.exp = function(i) {
    return o[i];
  }, G.mul = function(i, n) {
    return i === 0 || n === 0 ? 0 : o[t[i] + t[n]];
  }, G;
}
var qt;
function we() {
  return qt || (qt = 1, function(o) {
    const t = Se();
    o.mul = function(i, n) {
      const r = new Uint8Array(i.length + n.length - 1);
      for (let a = 0; a < i.length; a++)
        for (let s = 0; s < n.length; s++)
          r[a + s] ^= t.mul(i[a], n[s]);
      return r;
    }, o.mod = function(i, n) {
      let r = new Uint8Array(i);
      for (; r.length - n.length >= 0; ) {
        const a = r[0];
        for (let c = 0; c < n.length; c++)
          r[c] ^= t.mul(n[c], a);
        let s = 0;
        for (; s < r.length && r[s] === 0; ) s++;
        r = r.slice(s);
      }
      return r;
    }, o.generateECPolynomial = function(i) {
      let n = new Uint8Array([1]);
      for (let r = 0; r < i; r++)
        n = o.mul(n, new Uint8Array([1, t.exp(r)]));
      return n;
    };
  }(st)), st;
}
var at, Ut;
function ve() {
  if (Ut) return at;
  Ut = 1;
  const o = we();
  function t(e) {
    this.genPoly = void 0, this.degree = e, this.degree && this.initialize(this.degree);
  }
  return t.prototype.initialize = function(i) {
    this.degree = i, this.genPoly = o.generateECPolynomial(this.degree);
  }, t.prototype.encode = function(i) {
    if (!this.genPoly)
      throw new Error("Encoder not initialized");
    const n = new Uint8Array(i.length + this.degree);
    n.set(i);
    const r = o.mod(n, this.genPoly), a = this.degree - r.length;
    if (a > 0) {
      const s = new Uint8Array(this.degree);
      return s.set(r, a), s;
    }
    return r;
  }, at = t, at;
}
var ct = {}, lt = {}, dt = {}, _t;
function ie() {
  return _t || (_t = 1, dt.isValid = function(t) {
    return !isNaN(t) && t >= 1 && t <= 40;
  }), dt;
}
var N = {}, Ot;
function re() {
  if (Ot) return N;
  Ot = 1;
  const o = "[0-9]+", t = "[A-Z $%*+\\-./:]+";
  let e = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
  e = e.replace(/u/g, "\\u");
  const i = "(?:(?![A-Z0-9 $%*+\\-./:]|" + e + `)(?:.|[\r
]))+`;
  N.KANJI = new RegExp(e, "g"), N.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g"), N.BYTE = new RegExp(i, "g"), N.NUMERIC = new RegExp(o, "g"), N.ALPHANUMERIC = new RegExp(t, "g");
  const n = new RegExp("^" + e + "$"), r = new RegExp("^" + o + "$"), a = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
  return N.testKanji = function(c) {
    return n.test(c);
  }, N.testNumeric = function(c) {
    return r.test(c);
  }, N.testAlphanumeric = function(c) {
    return a.test(c);
  }, N;
}
var $t;
function $() {
  return $t || ($t = 1, function(o) {
    const t = ie(), e = re();
    o.NUMERIC = {
      id: "Numeric",
      bit: 1,
      ccBits: [10, 12, 14]
    }, o.ALPHANUMERIC = {
      id: "Alphanumeric",
      bit: 2,
      ccBits: [9, 11, 13]
    }, o.BYTE = {
      id: "Byte",
      bit: 4,
      ccBits: [8, 16, 16]
    }, o.KANJI = {
      id: "Kanji",
      bit: 8,
      ccBits: [8, 10, 12]
    }, o.MIXED = {
      bit: -1
    }, o.getCharCountIndicator = function(r, a) {
      if (!r.ccBits) throw new Error("Invalid mode: " + r);
      if (!t.isValid(a))
        throw new Error("Invalid version: " + a);
      return a >= 1 && a < 10 ? r.ccBits[0] : a < 27 ? r.ccBits[1] : r.ccBits[2];
    }, o.getBestModeForData = function(r) {
      return e.testNumeric(r) ? o.NUMERIC : e.testAlphanumeric(r) ? o.ALPHANUMERIC : e.testKanji(r) ? o.KANJI : o.BYTE;
    }, o.toString = function(r) {
      if (r && r.id) return r.id;
      throw new Error("Invalid mode");
    }, o.isValid = function(r) {
      return r && r.bit && r.ccBits;
    };
    function i(n) {
      if (typeof n != "string")
        throw new Error("Param is not a string");
      switch (n.toLowerCase()) {
        case "numeric":
          return o.NUMERIC;
        case "alphanumeric":
          return o.ALPHANUMERIC;
        case "kanji":
          return o.KANJI;
        case "byte":
          return o.BYTE;
        default:
          throw new Error("Unknown mode: " + n);
      }
    }
    o.from = function(r, a) {
      if (o.isValid(r))
        return r;
      try {
        return i(r);
      } catch {
        return a;
      }
    };
  }(lt)), lt;
}
var zt;
function Me() {
  return zt || (zt = 1, function(o) {
    const t = O(), e = ne(), i = Mt(), n = $(), r = ie(), a = 7973, s = t.getBCHDigit(a);
    function c(f, d, p) {
      for (let g = 1; g <= 40; g++)
        if (d <= o.getCapacity(g, p, f))
          return g;
    }
    function l(f, d) {
      return n.getCharCountIndicator(f, d) + 4;
    }
    function u(f, d) {
      let p = 0;
      return f.forEach(function(g) {
        const R = l(g.mode, d);
        p += R + g.getBitsLength();
      }), p;
    }
    function h(f, d) {
      for (let p = 1; p <= 40; p++)
        if (u(f, p) <= o.getCapacity(p, d, n.MIXED))
          return p;
    }
    o.from = function(d, p) {
      return r.isValid(d) ? parseInt(d, 10) : p;
    }, o.getCapacity = function(d, p, g) {
      if (!r.isValid(d))
        throw new Error("Invalid QR Code version");
      typeof g > "u" && (g = n.BYTE);
      const R = t.getSymbolTotalCodewords(d), v = e.getTotalCodewordsCount(d, p), A = (R - v) * 8;
      if (g === n.MIXED) return A;
      const k = A - l(g, d);
      switch (g) {
        case n.NUMERIC:
          return Math.floor(k / 10 * 3);
        case n.ALPHANUMERIC:
          return Math.floor(k / 11 * 2);
        case n.KANJI:
          return Math.floor(k / 13);
        case n.BYTE:
        default:
          return Math.floor(k / 8);
      }
    }, o.getBestVersionForData = function(d, p) {
      let g;
      const R = i.from(p, i.M);
      if (Array.isArray(d)) {
        if (d.length > 1)
          return h(d, R);
        if (d.length === 0)
          return 1;
        g = d[0];
      } else
        g = d;
      return c(g.mode, g.getLength(), R);
    }, o.getEncodedBits = function(d) {
      if (!r.isValid(d) || d < 7)
        throw new Error("Invalid QR Code version");
      let p = d << 12;
      for (; t.getBCHDigit(p) - s >= 0; )
        p ^= a << t.getBCHDigit(p) - s;
      return d << 12 | p;
    };
  }(ct)), ct;
}
var ut = {}, Yt;
function be() {
  if (Yt) return ut;
  Yt = 1;
  const o = O(), t = 1335, e = 21522, i = o.getBCHDigit(t);
  return ut.getEncodedBits = function(r, a) {
    const s = r.bit << 3 | a;
    let c = s << 10;
    for (; o.getBCHDigit(c) - i >= 0; )
      c ^= t << o.getBCHDigit(c) - i;
    return (s << 10 | c) ^ e;
  }, ut;
}
var ft = {}, ht, Gt;
function Ee() {
  if (Gt) return ht;
  Gt = 1;
  const o = $();
  function t(e) {
    this.mode = o.NUMERIC, this.data = e.toString();
  }
  return t.getBitsLength = function(i) {
    return 10 * Math.floor(i / 3) + (i % 3 ? i % 3 * 3 + 1 : 0);
  }, t.prototype.getLength = function() {
    return this.data.length;
  }, t.prototype.getBitsLength = function() {
    return t.getBitsLength(this.data.length);
  }, t.prototype.write = function(i) {
    let n, r, a;
    for (n = 0; n + 3 <= this.data.length; n += 3)
      r = this.data.substr(n, 3), a = parseInt(r, 10), i.put(a, 10);
    const s = this.data.length - n;
    s > 0 && (r = this.data.substr(n), a = parseInt(r, 10), i.put(a, s * 3 + 1));
  }, ht = t, ht;
}
var gt, Vt;
function Te() {
  if (Vt) return gt;
  Vt = 1;
  const o = $(), t = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    " ",
    "$",
    "%",
    "*",
    "+",
    "-",
    ".",
    "/",
    ":"
  ];
  function e(i) {
    this.mode = o.ALPHANUMERIC, this.data = i;
  }
  return e.getBitsLength = function(n) {
    return 11 * Math.floor(n / 2) + 6 * (n % 2);
  }, e.prototype.getLength = function() {
    return this.data.length;
  }, e.prototype.getBitsLength = function() {
    return e.getBitsLength(this.data.length);
  }, e.prototype.write = function(n) {
    let r;
    for (r = 0; r + 2 <= this.data.length; r += 2) {
      let a = t.indexOf(this.data[r]) * 45;
      a += t.indexOf(this.data[r + 1]), n.put(a, 11);
    }
    this.data.length % 2 && n.put(t.indexOf(this.data[r]), 6);
  }, gt = e, gt;
}
var mt, Ht;
function Ie() {
  if (Ht) return mt;
  Ht = 1;
  const o = $();
  function t(e) {
    this.mode = o.BYTE, typeof e == "string" ? this.data = new TextEncoder().encode(e) : this.data = new Uint8Array(e);
  }
  return t.getBitsLength = function(i) {
    return i * 8;
  }, t.prototype.getLength = function() {
    return this.data.length;
  }, t.prototype.getBitsLength = function() {
    return t.getBitsLength(this.data.length);
  }, t.prototype.write = function(e) {
    for (let i = 0, n = this.data.length; i < n; i++)
      e.put(this.data[i], 8);
  }, mt = t, mt;
}
var pt, jt;
function ke() {
  if (jt) return pt;
  jt = 1;
  const o = $(), t = O();
  function e(i) {
    this.mode = o.KANJI, this.data = i;
  }
  return e.getBitsLength = function(n) {
    return n * 13;
  }, e.prototype.getLength = function() {
    return this.data.length;
  }, e.prototype.getBitsLength = function() {
    return e.getBitsLength(this.data.length);
  }, e.prototype.write = function(i) {
    let n;
    for (n = 0; n < this.data.length; n++) {
      let r = t.toSJIS(this.data[n]);
      if (r >= 33088 && r <= 40956)
        r -= 33088;
      else if (r >= 57408 && r <= 60351)
        r -= 49472;
      else
        throw new Error(
          "Invalid SJIS character: " + this.data[n] + `
Make sure your charset is UTF-8`
        );
      r = (r >>> 8 & 255) * 192 + (r & 255), i.put(r, 13);
    }
  }, pt = e, pt;
}
var yt = { exports: {} }, Jt;
function xe() {
  return Jt || (Jt = 1, function(o) {
    var t = {
      single_source_shortest_paths: function(e, i, n) {
        var r = {}, a = {};
        a[i] = 0;
        var s = t.PriorityQueue.make();
        s.push(i, 0);
        for (var c, l, u, h, f, d, p, g, R; !s.empty(); ) {
          c = s.pop(), l = c.value, h = c.cost, f = e[l] || {};
          for (u in f)
            f.hasOwnProperty(u) && (d = f[u], p = h + d, g = a[u], R = typeof a[u] > "u", (R || g > p) && (a[u] = p, s.push(u, p), r[u] = l));
        }
        if (typeof n < "u" && typeof a[n] > "u") {
          var v = ["Could not find a path from ", i, " to ", n, "."].join("");
          throw new Error(v);
        }
        return r;
      },
      extract_shortest_path_from_predecessor_list: function(e, i) {
        for (var n = [], r = i; r; )
          n.push(r), e[r], r = e[r];
        return n.reverse(), n;
      },
      find_path: function(e, i, n) {
        var r = t.single_source_shortest_paths(e, i, n);
        return t.extract_shortest_path_from_predecessor_list(
          r,
          n
        );
      },
      /**
       * A very naive priority queue implementation.
       */
      PriorityQueue: {
        make: function(e) {
          var i = t.PriorityQueue, n = {}, r;
          e = e || {};
          for (r in i)
            i.hasOwnProperty(r) && (n[r] = i[r]);
          return n.queue = [], n.sorter = e.sorter || i.default_sorter, n;
        },
        default_sorter: function(e, i) {
          return e.cost - i.cost;
        },
        /**
         * Add a new item to the queue and ensure the highest priority element
         * is at the front of the queue.
         */
        push: function(e, i) {
          var n = { value: e, cost: i };
          this.queue.push(n), this.queue.sort(this.sorter);
        },
        /**
         * Return the highest priority element in the queue.
         */
        pop: function() {
          return this.queue.shift();
        },
        empty: function() {
          return this.queue.length === 0;
        }
      }
    };
    o.exports = t;
  }(yt)), yt.exports;
}
var Kt;
function Ae() {
  return Kt || (Kt = 1, function(o) {
    const t = $(), e = Ee(), i = Te(), n = Ie(), r = ke(), a = re(), s = O(), c = xe();
    function l(v) {
      return unescape(encodeURIComponent(v)).length;
    }
    function u(v, A, k) {
      const T = [];
      let B;
      for (; (B = v.exec(k)) !== null; )
        T.push({
          data: B[0],
          index: B.index,
          mode: A,
          length: B[0].length
        });
      return T;
    }
    function h(v) {
      const A = u(a.NUMERIC, t.NUMERIC, v), k = u(a.ALPHANUMERIC, t.ALPHANUMERIC, v);
      let T, B;
      return s.isKanjiModeEnabled() ? (T = u(a.BYTE, t.BYTE, v), B = u(a.KANJI, t.KANJI, v)) : (T = u(a.BYTE_KANJI, t.BYTE, v), B = []), A.concat(k, T, B).sort(function(E, M) {
        return E.index - M.index;
      }).map(function(E) {
        return {
          data: E.data,
          mode: E.mode,
          length: E.length
        };
      });
    }
    function f(v, A) {
      switch (A) {
        case t.NUMERIC:
          return e.getBitsLength(v);
        case t.ALPHANUMERIC:
          return i.getBitsLength(v);
        case t.KANJI:
          return r.getBitsLength(v);
        case t.BYTE:
          return n.getBitsLength(v);
      }
    }
    function d(v) {
      return v.reduce(function(A, k) {
        const T = A.length - 1 >= 0 ? A[A.length - 1] : null;
        return T && T.mode === k.mode ? (A[A.length - 1].data += k.data, A) : (A.push(k), A);
      }, []);
    }
    function p(v) {
      const A = [];
      for (let k = 0; k < v.length; k++) {
        const T = v[k];
        switch (T.mode) {
          case t.NUMERIC:
            A.push([
              T,
              { data: T.data, mode: t.ALPHANUMERIC, length: T.length },
              { data: T.data, mode: t.BYTE, length: T.length }
            ]);
            break;
          case t.ALPHANUMERIC:
            A.push([
              T,
              { data: T.data, mode: t.BYTE, length: T.length }
            ]);
            break;
          case t.KANJI:
            A.push([
              T,
              { data: T.data, mode: t.BYTE, length: l(T.data) }
            ]);
            break;
          case t.BYTE:
            A.push([
              { data: T.data, mode: t.BYTE, length: l(T.data) }
            ]);
        }
      }
      return A;
    }
    function g(v, A) {
      const k = {}, T = { start: {} };
      let B = ["start"];
      for (let C = 0; C < v.length; C++) {
        const E = v[C], M = [];
        for (let y = 0; y < E.length; y++) {
          const I = E[y], w = "" + C + y;
          M.push(w), k[w] = { node: I, lastCount: 0 }, T[w] = {};
          for (let S = 0; S < B.length; S++) {
            const b = B[S];
            k[b] && k[b].node.mode === I.mode ? (T[b][w] = f(k[b].lastCount + I.length, I.mode) - f(k[b].lastCount, I.mode), k[b].lastCount += I.length) : (k[b] && (k[b].lastCount = I.length), T[b][w] = f(I.length, I.mode) + 4 + t.getCharCountIndicator(I.mode, A));
          }
        }
        B = M;
      }
      for (let C = 0; C < B.length; C++)
        T[B[C]].end = 0;
      return { map: T, table: k };
    }
    function R(v, A) {
      let k;
      const T = t.getBestModeForData(v);
      if (k = t.from(A, T), k !== t.BYTE && k.bit < T.bit)
        throw new Error('"' + v + '" cannot be encoded with mode ' + t.toString(k) + `.
 Suggested mode is: ` + t.toString(T));
      switch (k === t.KANJI && !s.isKanjiModeEnabled() && (k = t.BYTE), k) {
        case t.NUMERIC:
          return new e(v);
        case t.ALPHANUMERIC:
          return new i(v);
        case t.KANJI:
          return new r(v);
        case t.BYTE:
          return new n(v);
      }
    }
    o.fromArray = function(A) {
      return A.reduce(function(k, T) {
        return typeof T == "string" ? k.push(R(T, null)) : T.data && k.push(R(T.data, T.mode)), k;
      }, []);
    }, o.fromString = function(A, k) {
      const T = h(A, s.isKanjiModeEnabled()), B = p(T), C = g(B, k), E = c.find_path(C.map, "start", "end"), M = [];
      for (let y = 1; y < E.length - 1; y++)
        M.push(C.table[E[y]].node);
      return o.fromArray(d(M));
    }, o.rawSplit = function(A) {
      return o.fromArray(
        h(A, s.isKanjiModeEnabled())
      );
    };
  }(ft)), ft;
}
var Xt;
function Re() {
  if (Xt) return Z;
  Xt = 1;
  const o = O(), t = Mt(), e = ge(), i = me(), n = pe(), r = ye(), a = Ce(), s = ne(), c = ve(), l = Me(), u = be(), h = $(), f = Ae();
  function d(C, E) {
    const M = C.size, y = r.getPositions(E);
    for (let I = 0; I < y.length; I++) {
      const w = y[I][0], S = y[I][1];
      for (let b = -1; b <= 7; b++)
        if (!(w + b <= -1 || M <= w + b))
          for (let x = -1; x <= 7; x++)
            S + x <= -1 || M <= S + x || (b >= 0 && b <= 6 && (x === 0 || x === 6) || x >= 0 && x <= 6 && (b === 0 || b === 6) || b >= 2 && b <= 4 && x >= 2 && x <= 4 ? C.set(w + b, S + x, !0, !0) : C.set(w + b, S + x, !1, !0));
    }
  }
  function p(C) {
    const E = C.size;
    for (let M = 8; M < E - 8; M++) {
      const y = M % 2 === 0;
      C.set(M, 6, y, !0), C.set(6, M, y, !0);
    }
  }
  function g(C, E) {
    const M = n.getPositions(E);
    for (let y = 0; y < M.length; y++) {
      const I = M[y][0], w = M[y][1];
      for (let S = -2; S <= 2; S++)
        for (let b = -2; b <= 2; b++)
          S === -2 || S === 2 || b === -2 || b === 2 || S === 0 && b === 0 ? C.set(I + S, w + b, !0, !0) : C.set(I + S, w + b, !1, !0);
    }
  }
  function R(C, E) {
    const M = C.size, y = l.getEncodedBits(E);
    let I, w, S;
    for (let b = 0; b < 18; b++)
      I = Math.floor(b / 3), w = b % 3 + M - 8 - 3, S = (y >> b & 1) === 1, C.set(I, w, S, !0), C.set(w, I, S, !0);
  }
  function v(C, E, M) {
    const y = C.size, I = u.getEncodedBits(E, M);
    let w, S;
    for (w = 0; w < 15; w++)
      S = (I >> w & 1) === 1, w < 6 ? C.set(w, 8, S, !0) : w < 8 ? C.set(w + 1, 8, S, !0) : C.set(y - 15 + w, 8, S, !0), w < 8 ? C.set(8, y - w - 1, S, !0) : w < 9 ? C.set(8, 15 - w - 1 + 1, S, !0) : C.set(8, 15 - w - 1, S, !0);
    C.set(y - 8, 8, 1, !0);
  }
  function A(C, E) {
    const M = C.size;
    let y = -1, I = M - 1, w = 7, S = 0;
    for (let b = M - 1; b > 0; b -= 2)
      for (b === 6 && b--; ; ) {
        for (let x = 0; x < 2; x++)
          if (!C.isReserved(I, b - x)) {
            let L = !1;
            S < E.length && (L = (E[S] >>> w & 1) === 1), C.set(I, b - x, L), w--, w === -1 && (S++, w = 7);
          }
        if (I += y, I < 0 || M <= I) {
          I -= y, y = -y;
          break;
        }
      }
  }
  function k(C, E, M) {
    const y = new e();
    M.forEach(function(x) {
      y.put(x.mode.bit, 4), y.put(x.getLength(), h.getCharCountIndicator(x.mode, C)), x.write(y);
    });
    const I = o.getSymbolTotalCodewords(C), w = s.getTotalCodewordsCount(C, E), S = (I - w) * 8;
    for (y.getLengthInBits() + 4 <= S && y.put(0, 4); y.getLengthInBits() % 8 !== 0; )
      y.putBit(0);
    const b = (S - y.getLengthInBits()) / 8;
    for (let x = 0; x < b; x++)
      y.put(x % 2 ? 17 : 236, 8);
    return T(y, C, E);
  }
  function T(C, E, M) {
    const y = o.getSymbolTotalCodewords(E), I = s.getTotalCodewordsCount(E, M), w = y - I, S = s.getBlocksCount(E, M), b = y % S, x = S - b, L = Math.floor(y / S), P = Math.floor(w / S), _ = P + 1, q = L - P, se = new c(q);
    let j = 0;
    const V = new Array(S), bt = new Array(S);
    let J = 0;
    const ae = new Uint8Array(C.buffer);
    for (let z = 0; z < S; z++) {
      const X = z < x ? P : _;
      V[z] = ae.slice(j, j + X), bt[z] = se.encode(V[z]), j += X, J = Math.max(J, X);
    }
    const K = new Uint8Array(y);
    let Et = 0, F, D;
    for (F = 0; F < J; F++)
      for (D = 0; D < S; D++)
        F < V[D].length && (K[Et++] = V[D][F]);
    for (F = 0; F < q; F++)
      for (D = 0; D < S; D++)
        K[Et++] = bt[D][F];
    return K;
  }
  function B(C, E, M, y) {
    let I;
    if (Array.isArray(C))
      I = f.fromArray(C);
    else if (typeof C == "string") {
      let L = E;
      if (!L) {
        const P = f.rawSplit(C);
        L = l.getBestVersionForData(P, M);
      }
      I = f.fromString(C, L || 40);
    } else
      throw new Error("Invalid data");
    const w = l.getBestVersionForData(I, M);
    if (!w)
      throw new Error("The amount of data is too big to be stored in a QR Code");
    if (!E)
      E = w;
    else if (E < w)
      throw new Error(
        `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ` + w + `.
`
      );
    const S = k(E, M, I), b = o.getSymbolSize(E), x = new i(b);
    return d(x, E), p(x), g(x, E), v(x, M, 0), E >= 7 && R(x, E), A(x, S), isNaN(y) && (y = a.getBestMask(
      x,
      v.bind(null, x, M)
    )), a.applyMask(y, x), v(x, M, y), {
      modules: x,
      version: E,
      errorCorrectionLevel: M,
      maskPattern: y,
      segments: I
    };
  }
  return Z.create = function(E, M) {
    if (typeof E > "u" || E === "")
      throw new Error("No input text");
    let y = t.M, I, w;
    return typeof M < "u" && (y = t.from(M.errorCorrectionLevel, t.M), I = l.from(M.version), w = a.from(M.maskPattern), M.toSJISFunc && o.setToSJISFunction(M.toSJISFunc)), B(E, I, y, w);
  }, Z;
}
var Ct = {}, St = {}, Qt;
function oe() {
  return Qt || (Qt = 1, function(o) {
    function t(e) {
      if (typeof e == "number" && (e = e.toString()), typeof e != "string")
        throw new Error("Color should be defined as hex string");
      let i = e.slice().replace("#", "").split("");
      if (i.length < 3 || i.length === 5 || i.length > 8)
        throw new Error("Invalid hex color: " + e);
      (i.length === 3 || i.length === 4) && (i = Array.prototype.concat.apply([], i.map(function(r) {
        return [r, r];
      }))), i.length === 6 && i.push("F", "F");
      const n = parseInt(i.join(""), 16);
      return {
        r: n >> 24 & 255,
        g: n >> 16 & 255,
        b: n >> 8 & 255,
        a: n & 255,
        hex: "#" + i.slice(0, 6).join("")
      };
    }
    o.getOptions = function(i) {
      i || (i = {}), i.color || (i.color = {});
      const n = typeof i.margin > "u" || i.margin === null || i.margin < 0 ? 4 : i.margin, r = i.width && i.width >= 21 ? i.width : void 0, a = i.scale || 4;
      return {
        width: r,
        scale: r ? 4 : a,
        margin: n,
        color: {
          dark: t(i.color.dark || "#000000ff"),
          light: t(i.color.light || "#ffffffff")
        },
        type: i.type,
        rendererOpts: i.rendererOpts || {}
      };
    }, o.getScale = function(i, n) {
      return n.width && n.width >= i + n.margin * 2 ? n.width / (i + n.margin * 2) : n.scale;
    }, o.getImageWidth = function(i, n) {
      const r = o.getScale(i, n);
      return Math.floor((i + n.margin * 2) * r);
    }, o.qrToImageData = function(i, n, r) {
      const a = n.modules.size, s = n.modules.data, c = o.getScale(a, r), l = Math.floor((a + r.margin * 2) * c), u = r.margin * c, h = [r.color.light, r.color.dark];
      for (let f = 0; f < l; f++)
        for (let d = 0; d < l; d++) {
          let p = (f * l + d) * 4, g = r.color.light;
          if (f >= u && d >= u && f < l - u && d < l - u) {
            const R = Math.floor((f - u) / c), v = Math.floor((d - u) / c);
            g = h[s[R * a + v] ? 1 : 0];
          }
          i[p++] = g.r, i[p++] = g.g, i[p++] = g.b, i[p] = g.a;
        }
    };
  }(St)), St;
}
var Wt;
function Be() {
  return Wt || (Wt = 1, function(o) {
    const t = oe();
    function e(n, r, a) {
      n.clearRect(0, 0, r.width, r.height), r.style || (r.style = {}), r.height = a, r.width = a, r.style.height = a + "px", r.style.width = a + "px";
    }
    function i() {
      try {
        return document.createElement("canvas");
      } catch {
        throw new Error("You need to specify a canvas element");
      }
    }
    o.render = function(r, a, s) {
      let c = s, l = a;
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), a || (l = i()), c = t.getOptions(c);
      const u = t.getImageWidth(r.modules.size, c), h = l.getContext("2d"), f = h.createImageData(u, u);
      return t.qrToImageData(f.data, r, c), e(h, l, u), h.putImageData(f, 0, 0), l;
    }, o.renderToDataURL = function(r, a, s) {
      let c = s;
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), c || (c = {});
      const l = o.render(r, a, c), u = c.type || "image/png", h = c.rendererOpts || {};
      return l.toDataURL(u, h.quality);
    };
  }(Ct)), Ct;
}
var wt = {}, Zt;
function Le() {
  if (Zt) return wt;
  Zt = 1;
  const o = oe();
  function t(n, r) {
    const a = n.a / 255, s = r + '="' + n.hex + '"';
    return a < 1 ? s + " " + r + '-opacity="' + a.toFixed(2).slice(1) + '"' : s;
  }
  function e(n, r, a) {
    let s = n + r;
    return typeof a < "u" && (s += " " + a), s;
  }
  function i(n, r, a) {
    let s = "", c = 0, l = !1, u = 0;
    for (let h = 0; h < n.length; h++) {
      const f = Math.floor(h % r), d = Math.floor(h / r);
      !f && !l && (l = !0), n[h] ? (u++, h > 0 && f > 0 && n[h - 1] || (s += l ? e("M", f + a, 0.5 + d + a) : e("m", c, 0), c = 0, l = !1), f + 1 < r && n[h + 1] || (s += e("h", u), u = 0)) : c++;
    }
    return s;
  }
  return wt.render = function(r, a, s) {
    const c = o.getOptions(a), l = r.modules.size, u = r.modules.data, h = l + c.margin * 2, f = c.color.light.a ? "<path " + t(c.color.light, "fill") + ' d="M0 0h' + h + "v" + h + 'H0z"/>' : "", d = "<path " + t(c.color.dark, "stroke") + ' d="' + i(u, l, c.margin) + '"/>', p = 'viewBox="0 0 ' + h + " " + h + '"', R = '<svg xmlns="http://www.w3.org/2000/svg" ' + (c.width ? 'width="' + c.width + '" height="' + c.width + '" ' : "") + p + ' shape-rendering="crispEdges">' + f + d + `</svg>
`;
    return typeof s == "function" && s(null, R), R;
  }, wt;
}
var te;
function Ne() {
  if (te) return Y;
  te = 1;
  const o = he(), t = Re(), e = Be(), i = Le();
  function n(r, a, s, c, l) {
    const u = [].slice.call(arguments, 1), h = u.length, f = typeof u[h - 1] == "function";
    if (!f && !o())
      throw new Error("Callback required as last argument");
    if (f) {
      if (h < 2)
        throw new Error("Too few arguments provided");
      h === 2 ? (l = s, s = a, a = c = void 0) : h === 3 && (a.getContext && typeof l > "u" ? (l = c, c = void 0) : (l = c, c = s, s = a, a = void 0));
    } else {
      if (h < 1)
        throw new Error("Too few arguments provided");
      return h === 1 ? (s = a, a = c = void 0) : h === 2 && !a.getContext && (c = s, s = a, a = void 0), new Promise(function(d, p) {
        try {
          const g = t.create(s, c);
          d(r(g, a, c));
        } catch (g) {
          p(g);
        }
      });
    }
    try {
      const d = t.create(s, c);
      l(null, r(d, a, c));
    } catch (d) {
      l(d);
    }
  }
  return Y.create = t.create, Y.toCanvas = n.bind(null, e.render), Y.toDataURL = n.bind(null, e.renderToDataURL), Y.toString = n.bind(null, function(r, a, s) {
    return i.render(r, s);
  }), Y;
}
var Pe = Ne();
const Fe = /* @__PURE__ */ fe(Pe);
function De(o, t) {
  let e = (o || "").trim();
  (!e || e === "undefined" || e.includes("localhost") || e.includes("127.0.0.1") || e.startsWith("file:")) && (e = "https://adsense.davidpetrea.ro/offer");
  try {
    const i = new URL(e);
    return (i.hostname === "adsense.davidpetrea.ro" || i.hostname.endsWith(".davidpetrea.ro") || i.pathname.startsWith("/offer")) && (t && t !== "undefined" && t !== "display" && i.searchParams.set("d", t), i.searchParams.set("src", "tv")), i.toString();
  } catch {
    const i = t && t !== "undefined" && t !== "display" ? t : "";
    return i ? `https://adsense.davidpetrea.ro/offer?d=${encodeURIComponent(i)}&src=tv` : "https://adsense.davidpetrea.ro/offer?src=tv";
  }
}
function qe(o, t, e) {
  const i = Math.min(t, e);
  if (typeof o == "number" && !isNaN(o) && o > 50)
    return Math.max(Math.round(i * 0.25), Math.min(Math.round(i * 0.6), o));
  switch (o) {
    case "S":
    case "160":
      return Math.round(i * 0.32);
    case "L":
    case "300":
      return Math.round(i * 0.48);
    case "M":
    case "220":
    default:
      return Math.round(i * 0.4);
  }
}
async function Ue(o, t) {
  return Fe.toDataURL(o, {
    errorCorrectionLevel: "M",
    margin: 4,
    color: {
      dark: "#0a0d14",
      light: "#ffffff"
    },
    width: t
  });
}
function _e(o) {
  if (o.length === 0)
    return { peopleSide: "left", contentSide: "right" };
  const e = o.reduce((n, r) => n + r.x, 0) / o.length < 0.5 ? "left" : "right";
  return { peopleSide: e, contentSide: e === "left" ? "right" : "left" };
}
function Oe(o, t, e, i, n, r = 0.03) {
  const a = Math.round(i * r), s = e + a, c = n - e - a, l = e + a, u = i - e - a, h = Math.max(l, Math.min(u, o)), f = Math.max(s, Math.min(c, t));
  return { cx: h, cy: f };
}
function $e(o, t, e, i, n, r, a = 0.03) {
  const s = Math.round(n * a), c = e + s, l = r - e - s, u = Math.max(c, Math.min(l, t));
  let h, f;
  return i === "left" ? (h = e + s, f = n / 2 - e - s) : (h = n / 2 + e + s, f = n - e - s), h > f ? { cx: i === "left" ? n * 0.25 : n * 0.75, cy: u } : { cx: Math.max(h, Math.min(f, o)), cy: u };
}
function ze(o, t, e, i, n = !1, r = 4) {
  const a = o.map((s) => ({ ...s }));
  for (let s = 0; s < r; s++) {
    for (let c = 0; c < a.length; c++)
      for (let l = c + 1; l < a.length; l++) {
        const u = a[c], h = a[l], f = h.cx - u.cx, d = h.cy - u.cy, p = Math.hypot(f, d) || 1, g = u.radius + h.radius;
        if (p < g) {
          const R = (g - p) / 2, v = f / p, A = d / p;
          u.cx -= v * R, u.cy -= A * R, h.cx += v * R, h.cy += A * R;
        }
      }
    for (const c of a) {
      const l = n ? $e(
        c.cx,
        c.cy,
        c.radius,
        t,
        e,
        i
      ) : Oe(
        c.cx,
        c.cy,
        c.radius,
        e,
        i
      );
      c.cx = l.cx, c.cy = l.cy;
    }
  }
  return a;
}
class Ye {
  constructor() {
    m(this, "enabled", !1);
    m(this, "activeFaceId", 1);
    m(this, "faces", /* @__PURE__ */ new Map());
    m(this, "indicator", null);
    m(this, "listenersAttached", !1);
    if (typeof window < "u") {
      const t = new URLSearchParams(window.location.search);
      this.enabled = t.get("sim") === "1" || t.get("simulator") === "1";
    }
  }
  init(t) {
    !this.enabled || this.listenersAttached || (this.listenersAttached = !0, this.createSyntheticFace(1, 0.35, 0.45, !0), this.indicator = document.createElement("div"), this.indicator.className = "simulator-badge", this.updateBadge(), t.appendChild(this.indicator), window.addEventListener("mousemove", (e) => {
      if (!this.enabled) return;
      const i = Math.max(0.05, Math.min(0.95, e.clientX / window.innerWidth)), n = Math.max(0.05, Math.min(0.95, e.clientY / window.innerHeight)), r = this.faces.get(this.activeFaceId);
      r && (r.x = i - r.w / 2, r.y = n - r.h / 2);
    }), window.addEventListener("keydown", (e) => {
      if (this.enabled) {
        if (e.key === " " || e.key.toLowerCase() === "l") {
          e.preventDefault();
          const i = this.faces.get(this.activeFaceId);
          i && (i.looking = !i.looking, this.updateBadge());
        } else if (["1", "2", "3", "4"].includes(e.key)) {
          const i = Number(e.key);
          if (this.activeFaceId = i, !this.faces.has(i)) {
            const n = 0.2 + (i - 1) * 0.18;
            this.createSyntheticFace(i, n, 0.45, !0);
          }
          this.updateBadge();
        } else if (e.key.toLowerCase() === "c")
          this.faces.clear(), this.updateBadge();
        else if (e.key.toLowerCase() === "a") {
          const i = this.faces.size + 1;
          i <= 4 && (this.createSyntheticFace(i, 0.2 + (i - 1) * 0.18, 0.45, !0), this.activeFaceId = i, this.updateBadge());
        }
      }
    }));
  }
  createSyntheticFace(t, e, i, n) {
    let r;
    if (typeof document < "u") {
      const a = document.createElement("canvas");
      a.width = 320, a.height = 320;
      const s = a.getContext("2d");
      if (s) {
        const c = s.createLinearGradient(0, 0, 320, 320);
        c.addColorStop(0, "#334155"), c.addColorStop(1, "#1e293b"), s.fillStyle = c, s.fillRect(0, 0, 320, 320), s.fillStyle = t % 2 === 0 ? "#0284c7" : "#059669", s.beginPath(), s.ellipse(160, 330, 110, 80, 0, 0, Math.PI * 2), s.fill(), s.fillStyle = "#fbcfe8", s.fillRect(140, 200, 40, 60), s.fillStyle = t % 2 === 0 ? "#fed7aa" : "#fcd34d", s.beginPath(), s.ellipse(160, 150, 65, 80, 0, 0, Math.PI * 2), s.fill(), s.fillStyle = t % 2 === 0 ? "#3b2f2f" : "#1e1e1e", s.beginPath(), s.ellipse(160, 110, 70, 50, 0, 0, Math.PI * 2), s.fill(), s.fillStyle = "#1e293b", s.beginPath(), s.arc(140, 145, 6, 0, Math.PI * 2), s.arc(180, 145, 6, 0, Math.PI * 2), s.fill(), s.strokeStyle = "#be123c", s.lineWidth = 3, s.beginPath(), s.arc(160, 175, 20, 0.2 * Math.PI, 0.8 * Math.PI), s.stroke(), r = a.toDataURL("image/jpeg", 0.85);
      }
    }
    this.faces.set(t, {
      x: e,
      y: i,
      w: 0.15,
      h: 0.22,
      looking: n,
      crop_jpeg: r
    });
  }
  updateBadge() {
    if (!this.indicator) return;
    const t = this.faces.get(this.activeFaceId), e = t ? t.looking ? "👀 LOOKING (ACTIVE)" : "🙈 LOOKING AWAY" : "NO FACE";
    this.indicator.innerHTML = `
      <div style="font-family: monospace; font-size: 13px; background: rgba(15,23,42,0.92); color: #38bdf8; padding: 8px 12px; border-radius: 8px; border: 1px solid #0284c7; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        <div>🎮 <strong>SIMULATOR ACTIVE</strong> (Face #${this.activeFaceId} / Total: ${this.faces.size})</div>
        <div style="color: ${t != null && t.looking ? "#4ade80" : "#f87171"}; font-weight: bold; margin-top: 2px;">${e}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Move mouse = move face | Space/L = toggle look | 1-4 = select | A = add | C = clear</div>
      </div>
    `;
  }
  getFaces() {
    return this.enabled ? Array.from(this.faces.entries()).map(([t, e]) => ({
      id: t,
      x: e.x,
      y: e.y,
      w: e.w,
      h: e.h,
      looking: e.looking,
      crop_jpeg: e.crop_jpeg,
      score: 0.95
    })) : [];
  }
}
const ee = [
  "crossfade",
  "zoom dissolve",
  "push",
  "soft wipe",
  "dip to black"
];
function Ge(o) {
  if (typeof o == "number")
    return o <= 0.6 ? 500 : o >= 1.2 ? 1400 : 900;
  switch (o) {
    case "fast":
      return 500;
    case "slow":
      return 1400;
    case "normal":
    default:
      return 900;
  }
}
class Ve {
  constructor() {
    m(this, "lastType", null);
  }
  resolve(t) {
    let e = (t || "crossfade").toLowerCase().replace(/_/g, " ");
    if (e === "auto") {
      const n = ee.filter((a) => a !== this.lastType), r = n[Math.floor(Math.random() * n.length)] || "crossfade";
      return this.lastType = r, r;
    }
    ee.includes(e) || (e = "crossfade");
    const i = e;
    return this.lastType = i, i;
  }
}
function He(o) {
  const t = -(Math.cos(Math.PI * o) - 1) / 2;
  return t === 0 ? 0 : t;
}
function je(o, t) {
  const e = Math.max(0, Math.min(1, t)), i = He(e);
  switch (o) {
    case "crossfade":
      return {
        outgoing: {
          opacity: 1 - i,
          transform: "none"
        },
        incoming: {
          opacity: i,
          transform: "none"
        }
      };
    case "zoom dissolve": {
      const n = 1 + 0.06 * i, r = 1.04 - 0.04 * i;
      return {
        outgoing: {
          opacity: 1 - i,
          transform: `scale(${n.toFixed(4)})`
        },
        incoming: {
          opacity: i,
          transform: `scale(${r.toFixed(4)})`
        }
      };
    }
    case "push": {
      const n = (1 - i) * 100, r = -i * 30, a = 1 - 0.4 * i;
      return {
        outgoing: {
          opacity: 1,
          transform: `translate3d(${r.toFixed(2)}%, 0, 0)`,
          filter: `brightness(${a.toFixed(3)})`
        },
        incoming: {
          opacity: 1,
          transform: `translate3d(${n.toFixed(2)}%, 0, 0)`
        }
      };
    }
    case "soft wipe": {
      const n = e * 115, a = `linear-gradient(to right, #000 0%, #000 ${Math.max(0, n - 15).toFixed(1)}%, transparent ${n.toFixed(1)}%)`;
      return {
        outgoing: {
          opacity: 1,
          transform: "none"
        },
        incoming: {
          opacity: 1,
          transform: "none",
          maskImage: a
        }
      };
    }
    case "dip to black": {
      if (e < 0.5)
        return {
          outgoing: {
            opacity: 1 - e * 2,
            transform: "none"
          },
          incoming: {
            opacity: 0,
            transform: "none"
          }
        };
      {
        const n = (e - 0.5) * 2;
        return {
          outgoing: {
            opacity: 0,
            transform: "none"
          },
          incoming: {
            opacity: n,
            transform: "none"
          }
        };
      }
    }
  }
}
function Je(o) {
  let t = (o || "#111827").replace("#", "");
  t.length === 3 && (t = t.split("").map((a) => a + a).join(""));
  const e = parseInt(t.slice(0, 2), 16) || 17, i = parseInt(t.slice(2, 4), 16) || 24, n = parseInt(t.slice(4, 6), 16) || 39;
  return (0.2126 * e + 0.7152 * i + 0.0722 * n) / 255 > 0.55 ? { text: "#0f172a", muted: "#475569" } : { text: "#f8fafc", muted: "#cbd5e1" };
}
function vt(o) {
  return o < 0.5 ? 4 * o * o * o : 1 - Math.pow(-2 * o + 2, 3) / 2;
}
class Ke {
  constructor(t) {
    m(this, "root");
    m(this, "simulator", new Ye());
    m(this, "stateMachine", new de());
    m(this, "blender", new ue(4));
    m(this, "transitionSelector", new Ve());
    m(this, "state", {});
    m(this, "activeFaces", []);
    m(this, "lockedPeopleSide", "left");
    m(this, "qrDataUrl", "");
    m(this, "lastGeneratedQrUrl", "");
    // Standby playlist state
    m(this, "mediaList", []);
    m(this, "currentMediaIndex", 0);
    m(this, "currentItemStartedMs", 0);
    m(this, "isTransitioning", !1);
    m(this, "transitionStartMs", 0);
    m(this, "activeTransitionType", "crossfade");
    m(this, "activeTransitionDuration", 900);
    m(this, "nextMediaPreloaded", !1);
    // Canvas elements
    m(this, "faceCanvas");
    m(this, "faceCtx");
    m(this, "irisCanvas");
    m(this, "irisCtx");
    // DOM containers
    m(this, "standbyContainer");
    m(this, "offerContainer");
    m(this, "setupContainer");
    m(this, "debugOverlay");
    m(this, "isDebugMode", !1);
    m(this, "fps", 0);
    m(this, "frameCount", 0);
    m(this, "lastFpsTime", 0);
    m(this, "pendingConfig", {});
    m(this, "activeConfig", {});
    m(this, "pendingMediaList", []);
    this.root = t, this.root.innerHTML = "";
    const e = new URLSearchParams(window.location.search);
    this.isDebugMode = e.get("debug") === "1", this.standbyContainer = document.createElement("div"), this.standbyContainer.className = "layer standby-layer", this.root.appendChild(this.standbyContainer), this.faceCanvas = document.createElement("canvas"), this.faceCanvas.className = "layer canvas-layer", this.root.appendChild(this.faceCanvas), this.faceCtx = this.faceCanvas.getContext("2d"), this.irisCanvas = document.createElement("canvas"), this.irisCanvas.className = "layer iris-layer", this.root.appendChild(this.irisCanvas), this.irisCtx = this.irisCanvas.getContext("2d"), this.offerContainer = document.createElement("div"), this.offerContainer.className = "layer offer-layer", this.root.appendChild(this.offerContainer), this.setupContainer = document.createElement("div"), this.setupContainer.className = "layer setup-layer", this.root.appendChild(this.setupContainer), this.debugOverlay = document.createElement("div"), this.debugOverlay.className = "debug-overlay", this.debugOverlay.style.display = this.isDebugMode ? "block" : "none", this.root.appendChild(this.debugOverlay), this.simulator.init(this.root), this.resizeCanvas(), window.addEventListener("resize", () => this.resizeCanvas()), this.connectVision(), this.pollState(), setInterval(() => this.pollState(), 2500), requestAnimationFrame((i) => this.renderLoop(i));
  }
  resizeCanvas() {
    const t = window.innerWidth, e = window.innerHeight;
    this.faceCanvas.width = t, this.faceCanvas.height = e, this.irisCanvas.width = t, this.irisCanvas.height = e;
  }
  connectVision() {
    const t = `ws://${location.hostname || "127.0.0.1"}:8766`;
    let e;
    const i = () => {
      e = new WebSocket(t), e.onmessage = (n) => {
        try {
          const r = JSON.parse(n.data);
          r && r.t === "faces" && Array.isArray(r.faces) && (this.simulator.enabled || (this.activeFaces = r.faces));
        } catch {
        }
      }, e.onclose = () => setTimeout(i, 3e3), e.onerror = () => e.close();
    };
    i();
  }
  async pollState() {
    try {
      const t = await fetch("/api/state", { cache: "no-store" });
      if (t.ok) {
        const e = await t.json();
        this.updateState(e);
      }
    } catch {
    }
  }
  updateState(t) {
    var s, c, l, u, h;
    this.state = t;
    const e = ((s = this.state.sync) == null ? void 0 : s.device_config) || {};
    this.pendingConfig = e, this.currentItemStartedMs || (this.activeConfig = { ...e }), this.stateMachine.updateConfig({
      dwellSeconds: e.lookTime || 2.5,
      offerMinSeconds: 8,
      exitAfterNobodySeconds: 4,
      maxOfferSeconds: 22,
      cooldownSeconds: 6,
      triggeringDurationMs: 1800,
      exitingDurationMs: 800
    });
    const i = ((c = this.state.sync) == null ? void 0 : c.media) || [], n = ((l = this.state.sync) == null ? void 0 : l.playlist) || [];
    n.length > 0 ? this.pendingMediaList = n.map((f) => i.find((d) => d.id === f)).filter(Boolean) : this.pendingMediaList = i, this.currentItemStartedMs || (this.mediaList = this.pendingMediaList);
    const r = (h = (u = this.state.sync) == null ? void 0 : u.pairing) != null && h.code ? "display" : this.state.device_id || "", a = De(e.offerLink, r);
    if (a !== this.lastGeneratedQrUrl) {
      this.lastGeneratedQrUrl = a;
      const f = qe(e.qrSize, window.innerWidth, window.innerHeight);
      Ue(a, f).then((d) => {
        this.qrDataUrl = d;
      });
    }
  }
  preloadNextMedia() {
    var i;
    if (this.mediaList.length <= 1) return;
    const t = (this.currentMediaIndex + 1) % this.mediaList.length, e = this.mediaList[t];
    if (e)
      if ((i = e.content_type) != null && i.startsWith("video/")) {
        const n = document.createElement("video");
        n.preload = "auto", n.src = e.local;
      } else {
        const n = new Image();
        n.src = e.local;
      }
  }
  renderLoop(t) {
    var i;
    if (this.frameCount++, t - this.lastFpsTime >= 1e3 && (this.fps = Math.round(this.frameCount * 1e3 / (t - this.lastFpsTime)), this.frameCount = 0, this.lastFpsTime = t), !!!((i = this.state.sync) != null && i.device_token))
      this.renderSetup(), this.standbyContainer.style.display = "none", this.offerContainer.style.display = "none", this.faceCanvas.style.display = "none", this.irisCanvas.style.display = "none";
    else {
      this.setupContainer.style.display = "none", this.standbyContainer.style.display = "block", this.faceCanvas.style.display = "block", this.irisCanvas.style.display = "block", this.offerContainer.style.display = "block";
      const n = this.simulator.enabled ? this.simulator.getFaces() : this.activeFaces, r = this.stateMachine.state, a = this.stateMachine.update(n, t);
      if (r === "STANDBY" && a === "TRIGGERING") {
        const s = _e(n);
        this.lockedPeopleSide = s.peopleSide;
      }
      this.renderMedia(t), this.renderFaceBlending(n, t, a), this.renderTemplate(a, t);
    }
    this.isDebugMode && this.renderDebug(t), requestAnimationFrame((n) => this.renderLoop(n));
  }
  renderSetup() {
    var r;
    this.setupContainer.style.display = "flex";
    const t = (r = this.state.sync) == null ? void 0 : r.pairing, e = String((t == null ? void 0 : t.code) || ""), i = e.length === 6 ? `${e.slice(0, 3)} ${e.slice(3)}` : e, n = new URLSearchParams(window.location.search).get("lang") === "en";
    this.setupContainer.innerHTML = `
      <div class="setup-card">
        <div class="brand-badge">AdSense Smart Display</div>
        <h1>${n ? "Connect this display" : "Conectează acest ecran"}</h1>
        <p class="setup-instruction">${n ? "Go to <strong>adsense.davidpetrea.ro</strong> → <em>Add display</em> and enter this code:" : "Mergi pe <strong>adsense.davidpetrea.ro</strong> → <em>Adaugă ecran</em> și introdu codul:"}</p>
        <div class="pairing-code">${i || "••• •••"}</div>
        <p class="setup-footer">${n ? "Waiting for connection…" : "Se așteaptă conectarea…"}</p>
      </div>
    `;
  }
  renderMedia(t) {
    var l, u;
    if (this.mediaList.length === 0) {
      this.standbyContainer.dataset.loaded !== "brand" && (this.standbyContainer.dataset.loaded = "brand", this.standbyContainer.innerHTML = `
          <div class="standby-brand">
            <h1>${((l = this.state.sync) == null ? void 0 : l.display_name) || "AdSense"}</h1>
            <p>Smart Display</p>
          </div>
        `);
      return;
    }
    const e = ((u = this.state.sync) == null ? void 0 : u.device_config) || {}, i = (e.standbyDuration || 8) * 1e3;
    this.currentItemStartedMs || (this.currentItemStartedMs = t, this.renderActiveMediaSlot());
    const n = t - this.currentItemStartedMs, r = this.standbyContainer.querySelector(".media-slot.active"), a = r == null ? void 0 : r.querySelector("video"), s = !!(a && (a.ended || a.duration > 0 && a.currentTime >= a.duration - 0.2));
    if ((n >= i || s) && !this.isTransitioning && this.mediaList.length >= 1 && (this.isTransitioning = !0, this.transitionStartMs = t, this.activeTransitionType = this.transitionSelector.resolve(e.transition), this.activeTransitionDuration = Ge(e.transitionSpeed), this.prepareNextMediaSlot()), this.isTransitioning) {
      const h = t - this.transitionStartMs, f = Math.min(1, h / this.activeTransitionDuration), d = je(this.activeTransitionType, f), p = this.standbyContainer.querySelector(".media-slot.outgoing"), g = this.standbyContainer.querySelector(".media-slot.incoming");
      p && (p.style.opacity = String(d.outgoing.opacity), p.style.transform = d.outgoing.transform, d.outgoing.filter && (p.style.filter = d.outgoing.filter)), g && (g.style.opacity = String(d.incoming.opacity), g.style.transform = d.incoming.transform, d.incoming.filter && (g.style.filter = d.incoming.filter), d.incoming.maskImage ? (g.style.webkitMaskImage = d.incoming.maskImage, g.style.maskImage = d.incoming.maskImage) : (g.style.webkitMaskImage = "none", g.style.maskImage = "none")), f >= 1 && (this.isTransitioning = !1, this.currentMediaIndex = (this.currentMediaIndex + 1) % this.mediaList.length, this.currentItemStartedMs = t, this.finalizeMediaTransition());
    } else {
      const h = this.standbyContainer.querySelector(".media-slot.active");
      if (h && h.dataset.type === "image") {
        const f = Math.min(1, n / i), d = 1 + 0.08 * f, p = -1.5 + 3 * f, g = -0.75 + 1.5 * f;
        h.style.transform = `translate3d(${p.toFixed(2)}%, ${g.toFixed(2)}%, 0) scale(${d.toFixed(4)})`;
      }
    }
  }
  renderActiveMediaSlot() {
    var i;
    const t = this.mediaList[this.currentMediaIndex % this.mediaList.length];
    if (!t) return;
    const e = (i = t.content_type) == null ? void 0 : i.startsWith("video/");
    this.standbyContainer.innerHTML = `
      <div class="media-slot active" data-type="${e ? "video" : "image"}" style="opacity: 1; transform: none;">
        ${e ? `<video src="${t.local}" autoplay muted playsinline></video>` : `<img src="${t.local}" alt="">`}
      </div>
    `;
  }
  prepareNextMediaSlot() {
    var a;
    this.standbyContainer.querySelectorAll(".media-slot.incoming").forEach((s) => s.remove());
    const t = (this.currentMediaIndex + 1) % this.mediaList.length, e = this.mediaList[t];
    if (!e) return;
    const i = (a = e.content_type) == null ? void 0 : a.startsWith("video/"), n = this.standbyContainer.querySelector(".media-slot.active");
    n && (n.className = "media-slot outgoing");
    const r = document.createElement("div");
    if (r.className = "media-slot incoming", r.dataset.type = i ? "video" : "image", r.style.opacity = "0", i) {
      const s = document.createElement("video");
      s.src = e.local, s.autoplay = !0, s.muted = !0, s.playsInline = !0, s.currentTime = 0, s.play().catch(() => {
      }), r.appendChild(s);
    } else {
      const s = document.createElement("img");
      s.src = e.local, s.alt = "", r.appendChild(s);
    }
    this.standbyContainer.appendChild(r);
  }
  finalizeMediaTransition() {
    this.standbyContainer.querySelectorAll(".media-slot.outgoing").forEach((i) => i.remove());
    const e = this.standbyContainer.querySelector(".media-slot.incoming");
    e && (e.className = "media-slot active", e.style.opacity = "1", e.style.transform = "none", e.style.filter = "none", e.style.webkitMaskImage = "none", e.style.maskImage = "none"), this.activeConfig = { ...this.pendingConfig }, this.mediaList = this.pendingMediaList.length > 0 ? this.pendingMediaList : this.mediaList, this.preloadNextMedia();
  }
  renderFaceBlending(t, e, i) {
    var h;
    if (!this.faceCtx) return;
    const n = this.faceCanvas.width, r = this.faceCanvas.height;
    if (this.faceCtx.clearRect(0, 0, n, r), (((h = this.state.sync) == null ? void 0 : h.device_config) || {}).liveFaces === !1) return;
    this.blender.update(t, e, n, r);
    const s = this.blender.getActiveTracks();
    if (s.length === 0) return;
    const c = i === "TRIGGERING" || i === "OFFER" || i === "EXITING", l = s.map((f) => ({
      id: f.id,
      cx: f.currentX,
      cy: f.currentY,
      radius: f.currentSize / 2
    })), u = ze(l, this.lockedPeopleSide, n, r, c);
    for (let f = 0; f < s.length; f++)
      s[f].currentX = u[f].cx, s[f].currentY = u[f].cy;
    this.blender.render(this.faceCtx, n, r);
  }
  renderTemplate(t, e) {
    var L;
    const i = ((L = this.state.sync) == null ? void 0 : L.device_config) || {}, n = Je(i.offerBackground), r = i.offerBackground || "#0f172a", a = window.innerWidth, s = window.innerHeight;
    if (this.irisCtx && this.irisCtx.clearRect(0, 0, a, s), t === "STANDBY" || t === "COOLDOWN") {
      this.standbyContainer.style.filter = "none", this.standbyContainer.style.opacity = "1", this.offerContainer.style.display = "none", this.offerContainer.innerHTML = "";
      return;
    }
    this.offerContainer.style.display = "flex";
    const c = e - this.stateMachine.stateStartedMs, l = 800;
    let u = 1, h = !1, f = 0, d = 1, p = 0, g = 0, R = 1, v = 0;
    if (t === "TRIGGERING") {
      const P = Math.min(1, c / 600);
      if (u = vt(P), c < 1150) {
        h = !0;
        const _ = Math.min(1, c / 600), q = Math.sin(_ * Math.PI * 1.5) * 0.16 * (1 - _);
        d = 0.6 + 0.4 * (_ + q), c > 800 ? (f = Math.max(0, 1 - (c - 800) / 300), p = -(1 - f) * 25) : (f = Math.min(1, c / 200), p = 0);
      }
      if (c >= 950) {
        const _ = Math.min(1, (c - 950) / 700), q = vt(_);
        g = q, R = 0.9 + 0.1 * q, v = (1 - q) * 20;
      }
    } else if (t === "OFFER")
      u = 1, h = !1, g = 1, R = 1, v = 0;
    else if (t === "EXITING") {
      const P = Math.min(1, c / l);
      u = Math.max(0, 1 - vt(P)), h = !1, g = u, R = 0.95 + 0.05 * u, v = 0;
    }
    const A = (7 * u).toFixed(1), k = (1 - 0.22 * u).toFixed(2), T = (1 - 0.15 * u).toFixed(2);
    this.standbyContainer.style.filter = `blur(${A}px) brightness(${k})`, this.standbyContainer.style.opacity = T;
    const B = this.lockedPeopleSide === "left" ? "right" : "left", C = (1 - u) * 100, E = B === "right" ? `translate3d(${C.toFixed(2)}%, 0, 0)` : `translate3d(-${C.toFixed(2)}%, 0, 0)`, M = B === "right" ? `linear-gradient(to right, transparent 0%, rgba(15, 23, 42, 0.40) 10%, rgba(15, 23, 42, 0.85) 24%, ${r} 42%, ${r} 100%)` : `linear-gradient(to left, transparent 0%, rgba(15, 23, 42, 0.40) 10%, rgba(15, 23, 42, 0.85) 24%, ${r} 42%, ${r} 100%)`, y = i.greetingText || "Hei!", I = i.headline || "20% reducere", w = i.subtext || "Scanează codul QR cu telefonul", S = (i.caption || "").trim(), x = S.toLowerCase().includes("poza cu m") || S.toLowerCase().includes("aici poza") || S.toLowerCase().includes("mancare") ? "" : S;
    this.offerContainer.style.flexDirection = B === "right" ? "row" : "row-reverse", this.offerContainer.innerHTML = `
      <div class="offer-half media-half" style="flex: 1; height: 100%; pointer-events: none;"></div>
      <div class="offer-half content-half" style="
        flex: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 5vw;
        background: ${M};
        transform: ${E};
        opacity: ${u.toFixed(2)};
        color: ${n.text};
        will-change: transform, opacity;
        position: relative;
        overflow: hidden;
      ">
        ${h ? `<div class="greeting-box" style="
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 4vw;
                opacity: ${f.toFixed(2)};
                transform: translate3d(0, ${p.toFixed(1)}px, 0) scale(${d.toFixed(3)});
                will-change: transform, opacity;
                pointer-events: none;
              ">
                <span class="greeting-text" style="
                  font-size: clamp(4.5rem, 9.5vw, 8rem);
                  font-weight: 900;
                  letter-spacing: -0.04em;
                  color: #38bdf8;
                  text-shadow: 0 10px 40px rgba(56, 189, 248, 0.45);
                  line-height: 1;
                ">${y}</span>
              </div>` : ""}
        <div class="offer-card" style="
          background: transparent;
          max-width: 660px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          opacity: ${g.toFixed(2)};
          transform: translate3d(0, ${v.toFixed(1)}px, 0) scale(${R.toFixed(3)});
          will-change: transform, opacity;
        ">
          <h1 class="offer-headline" style="
            font-size: clamp(3rem, 6.2vw, 5.25rem);
            font-weight: 800;
            line-height: 1.08;
            letter-spacing: -0.03em;
            margin: 0;
            color: ${n.text};
          ">${I}</h1>
          <p class="offer-subtext" style="
            font-size: clamp(1.4rem, 2.6vw, 2.25rem);
            line-height: 1.35;
            margin: 0;
            font-weight: 500;
            color: ${n.muted};
          ">${w}</p>
          <div class="qr-wrapper" style="margin-top: 0.5rem;">
            <div class="qr-card" style="
              background: #ffffff;
              padding: clamp(18px, 2.5vw, 30px);
              border-radius: clamp(20px, 3vw, 32px);
              box-shadow: 0 24px 50px rgba(0, 0, 0, 0.5);
              display: inline-flex;
            ">
              ${this.qrDataUrl ? `<img src="${this.qrDataUrl}" alt="QR" class="qr-image" style="width: 100%; height: auto; aspect-ratio: 1;">` : ""}
            </div>
            ${x ? `<p class="qr-caption" style="color: ${n.muted}; margin-top: 0.5rem;">${x}</p>` : ""}
          </div>
        </div>
      </div>
    `;
  }
  renderDebug(t) {
    var i, n, r;
    const e = this.stateMachine.state === "STANDBY" && ((i = this.activeFaces[0]) != null && i.looking) ? ((t - ((r = (n = this.stateMachine.tracks) == null ? void 0 : n.get(this.activeFaces[0].id)) == null ? void 0 : r.lookingSinceMs) || 0) / 1e3).toFixed(1) : "0.0";
    this.debugOverlay.innerHTML = `
      <div><strong>AdSense Debug HUD</strong></div>
      <div>FPS: ${this.fps}</div>
      <div>State: ${this.stateMachine.state} (phase: ${this.stateMachine.effectivePhase})</div>
      <div>People Side: ${this.lockedPeopleSide}</div>
      <div>Faces: ${this.activeFaces.length}</div>
      <div>Dwell: ${e}s</div>
      <div>Cooldown: ${this.stateMachine.isCooldownActive ? "ACTIVE" : "none"}</div>
    `;
  }
}
typeof document < "u" && window.addEventListener("DOMContentLoaded", () => {
  const o = document.querySelector("#app");
  o && new Ke(o);
});
export {
  Ke as App
};
