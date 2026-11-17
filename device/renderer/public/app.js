var ae = Object.defineProperty;
var ce = (s, t, e) => t in s ? ae(s, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : s[t] = e;
var g = (s, t, e) => ce(s, typeof t != "symbol" ? t + "" : t, e);
class le {
  constructor(t = {}) {
    g(this, "state", "STANDBY");
    g(this, "stateStartedMs", 0);
    g(this, "offerStartedMs", 0);
    g(this, "lastFaceSeenMs", null);
    g(this, "triggerFaceId", null);
    g(this, "cooldownUntilMs", 0);
    g(this, "config");
    g(this, "tracks", /* @__PURE__ */ new Map());
    g(this, "triggeredTrackIds", /* @__PURE__ */ new Set());
    this.config = {
      dwellSeconds: t.dwellSeconds ?? 3,
      offerMinSeconds: t.offerMinSeconds ?? 20,
      exitAfterNobodySeconds: t.exitAfterNobodySeconds ?? 6,
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
    t.dwellSeconds !== void 0 && (this.config.dwellSeconds = t.dwellSeconds), t.offerMinSeconds !== void 0 && (this.config.offerMinSeconds = t.offerMinSeconds), t.exitAfterNobodySeconds !== void 0 && (this.config.exitAfterNobodySeconds = t.exitAfterNobodySeconds), t.cooldownSeconds !== void 0 && (this.config.cooldownSeconds = t.cooldownSeconds), t.lookingResetSeconds !== void 0 && (this.config.lookingResetSeconds = t.lookingResetSeconds), t.triggeringDurationMs !== void 0 && (this.config.triggeringDurationMs = t.triggeringDurationMs), t.exitingDurationMs !== void 0 && (this.config.exitingDurationMs = t.exitingDurationMs), t.absentToRetriggerSeconds !== void 0 && (this.config.absentToRetriggerSeconds = t.absentToRetriggerSeconds);
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
        const n = e - this.offerStartedMs >= this.config.offerMinSeconds * 1e3, r = this.lastFaceSeenMs === null || e - this.lastFaceSeenMs >= this.config.exitAfterNobodySeconds * 1e3;
        n && r && (this.state = "EXITING", this.stateStartedMs = e);
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
function bt(s, t) {
  const e = 1 / (2 * Math.PI * t), i = 1 / s;
  return 1 / (1 + e / i);
}
class Et {
  constructor() {
    g(this, "y", null);
    g(this, "s", null);
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
class J {
  constructor(t = 1, e = 7e-3, i = 1) {
    g(this, "minCutoff");
    g(this, "beta");
    g(this, "dCutoff");
    g(this, "xFilter", new Et());
    g(this, "dxFilter", new Et());
    g(this, "lastTime", null);
    this.minCutoff = t, this.beta = e, this.dCutoff = i;
  }
  filter(t, e) {
    if (this.lastTime === null)
      return this.lastTime = e, this.xFilter.filter(t, 1);
    const i = Math.max((e - this.lastTime) / 1e3, 1e-4);
    this.lastTime = e;
    const n = 1 / i, r = this.xFilter.hasLast() ? (t - this.xFilter.last()) * n : 0, a = this.dxFilter.filter(r, bt(n, this.dCutoff)), o = this.minCutoff + this.beta * Math.abs(a);
    return this.xFilter.filter(t, bt(n, o));
  }
  reset() {
    this.lastTime = null, this.xFilter.reset(), this.dxFilter.reset();
  }
}
class de {
  constructor(t = 4) {
    g(this, "tracks", /* @__PURE__ */ new Map());
    g(this, "maxPeople");
    g(this, "offscreenCanvas", null);
    g(this, "offscreenCtx", null);
    this.maxPeople = t;
  }
  getTrack(t) {
    return this.tracks.get(t);
  }
  getActiveTracks() {
    return Array.from(this.tracks.values()).filter((t) => t.alpha > 0);
  }
  update(t, e, i, n) {
    const r = /* @__PURE__ */ new Set(), a = t.slice(0, this.maxPeople), o = n * 0.18, c = n * 0.4;
    for (const l of a) {
      r.add(l.id);
      const u = (l.x + l.w / 2) * i, h = (l.y + l.h / 2 + 0.15 * l.h) * n, f = Math.max(o, Math.min(c, 2.4 * l.h * n));
      let d = this.tracks.get(l.id);
      if (d) {
        if (d.lastSeenMs = e, d.currentX = d.filterX.filter(u, e), d.currentY = d.filterY.filter(h, e), d.currentSize = d.filterSize.filter(f, e), l.crop_jpeg && l.crop_jpeg !== d.cropJpeg) {
          if (d.cropJpeg = l.crop_jpeg, d.image)
            d.image.src = l.crop_jpeg;
          else if (typeof Image < "u") {
            const p = new Image();
            p.src = l.crop_jpeg, d.image = p;
          }
        }
      } else {
        if (d = {
          id: l.id,
          filterX: new J(1, 7e-3),
          filterY: new J(1, 7e-3),
          filterSize: new J(1, 7e-3),
          currentX: u,
          currentY: h,
          currentSize: f,
          firstSeenMs: e,
          lastSeenMs: e,
          alpha: 0,
          scale: 0.85,
          cropJpeg: l.crop_jpeg
        }, d.filterX.filter(u, e), d.filterY.filter(h, e), d.filterSize.filter(f, e), typeof Image < "u" && l.crop_jpeg) {
          const p = new Image();
          p.src = l.crop_jpeg, d.image = p;
        }
        this.tracks.set(l.id, d);
      }
      const y = Math.min(1, Math.max(0, (e - d.firstSeenMs) / 250));
      d.alpha = y, d.scale = 0.85 + 0.15 * y;
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
        const o = this.offscreenCtx;
        o.clearRect(0, 0, a, a), o.globalCompositeOperation = "source-over", o.drawImage(r, 0, 0, a, a), o.globalCompositeOperation = "destination-in";
        const c = a / 2, l = o.createRadialGradient(c, c, 0, c, c, c);
        l.addColorStop(0, "rgba(0,0,0,1)"), l.addColorStop(0.2, "rgba(0,0,0,0.98)"), l.addColorStop(0.35, "rgba(0,0,0,0.88)"), l.addColorStop(0.5, "rgba(0,0,0,0.70)"), l.addColorStop(0.65, "rgba(0,0,0,0.48)"), l.addColorStop(0.8, "rgba(0,0,0,0.24)"), l.addColorStop(0.92, "rgba(0,0,0,0.07)"), l.addColorStop(1, "rgba(0,0,0,0)"), o.fillStyle = l, o.fillRect(0, 0, a, a), t.save(), t.globalAlpha = n.alpha, t.drawImage(
          this.offscreenCanvas,
          Math.round(n.currentX - a / 2),
          Math.round(n.currentY - a / 2),
          a,
          a
        ), t.restore();
      }
  }
}
function ue(s) {
  return s && s.__esModule && Object.prototype.hasOwnProperty.call(s, "default") ? s.default : s;
}
var O = {}, X, It;
function fe() {
  return It || (It = 1, X = function() {
    return typeof Promise == "function" && Promise.prototype && Promise.prototype.then;
  }), X;
}
var Q = {}, D = {}, Tt;
function q() {
  if (Tt) return D;
  Tt = 1;
  let s;
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
  return D.getSymbolSize = function(i) {
    if (!i) throw new Error('"version" cannot be null or undefined');
    if (i < 1 || i > 40) throw new Error('"version" should be in range from 1 to 40');
    return i * 4 + 17;
  }, D.getSymbolTotalCodewords = function(i) {
    return t[i];
  }, D.getBCHDigit = function(e) {
    let i = 0;
    for (; e !== 0; )
      i++, e >>>= 1;
    return i;
  }, D.setToSJISFunction = function(i) {
    if (typeof i != "function")
      throw new Error('"toSJISFunc" is not a valid function.');
    s = i;
  }, D.isKanjiModeEnabled = function() {
    return typeof s < "u";
  }, D.toSJIS = function(i) {
    return s(i);
  }, D;
}
var W = {}, kt;
function St() {
  return kt || (kt = 1, function(s) {
    s.L = { bit: 1 }, s.M = { bit: 0 }, s.Q = { bit: 3 }, s.H = { bit: 2 };
    function t(e) {
      if (typeof e != "string")
        throw new Error("Param is not a string");
      switch (e.toLowerCase()) {
        case "l":
        case "low":
          return s.L;
        case "m":
        case "medium":
          return s.M;
        case "q":
        case "quartile":
          return s.Q;
        case "h":
        case "high":
          return s.H;
        default:
          throw new Error("Unknown EC Level: " + e);
      }
    }
    s.isValid = function(i) {
      return i && typeof i.bit < "u" && i.bit >= 0 && i.bit < 4;
    }, s.from = function(i, n) {
      if (s.isValid(i))
        return i;
      try {
        return t(i);
      } catch {
        return n;
      }
    };
  }(W)), W;
}
var Z, Rt;
function he() {
  if (Rt) return Z;
  Rt = 1;
  function s() {
    this.buffer = [], this.length = 0;
  }
  return s.prototype = {
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
  }, Z = s, Z;
}
var tt, At;
function ge() {
  if (At) return tt;
  At = 1;
  function s(t) {
    if (!t || t < 1)
      throw new Error("BitMatrix size must be defined and greater than 0");
    this.size = t, this.data = new Uint8Array(t * t), this.reservedBit = new Uint8Array(t * t);
  }
  return s.prototype.set = function(t, e, i, n) {
    const r = t * this.size + e;
    this.data[r] = i, n && (this.reservedBit[r] = !0);
  }, s.prototype.get = function(t, e) {
    return this.data[t * this.size + e];
  }, s.prototype.xor = function(t, e, i) {
    this.data[t * this.size + e] ^= i;
  }, s.prototype.isReserved = function(t, e) {
    return this.reservedBit[t * this.size + e];
  }, tt = s, tt;
}
var et = {}, Bt;
function me() {
  return Bt || (Bt = 1, function(s) {
    const t = q().getSymbolSize;
    s.getRowColCoords = function(i) {
      if (i === 1) return [];
      const n = Math.floor(i / 7) + 2, r = t(i), a = r === 145 ? 26 : Math.ceil((r - 13) / (2 * n - 2)) * 2, o = [r - 7];
      for (let c = 1; c < n - 1; c++)
        o[c] = o[c - 1] - a;
      return o.push(6), o.reverse();
    }, s.getPositions = function(i) {
      const n = [], r = s.getRowColCoords(i), a = r.length;
      for (let o = 0; o < a; o++)
        for (let c = 0; c < a; c++)
          o === 0 && c === 0 || // top-left
          o === 0 && c === a - 1 || // bottom-left
          o === a - 1 && c === 0 || n.push([r[o], r[c]]);
      return n;
    };
  }(et)), et;
}
var nt = {}, Nt;
function pe() {
  if (Nt) return nt;
  Nt = 1;
  const s = q().getSymbolSize, t = 7;
  return nt.getPositions = function(i) {
    const n = s(i);
    return [
      // top-left
      [0, 0],
      // top-right
      [n - t, 0],
      // bottom-left
      [0, n - t]
    ];
  }, nt;
}
var it = {}, Pt;
function ye() {
  return Pt || (Pt = 1, function(s) {
    s.Patterns = {
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
    s.isValid = function(n) {
      return n != null && n !== "" && !isNaN(n) && n >= 0 && n <= 7;
    }, s.from = function(n) {
      return s.isValid(n) ? parseInt(n, 10) : void 0;
    }, s.getPenaltyN1 = function(n) {
      const r = n.size;
      let a = 0, o = 0, c = 0, l = null, u = null;
      for (let h = 0; h < r; h++) {
        o = c = 0, l = u = null;
        for (let f = 0; f < r; f++) {
          let d = n.get(h, f);
          d === l ? o++ : (o >= 5 && (a += t.N1 + (o - 5)), l = d, o = 1), d = n.get(f, h), d === u ? c++ : (c >= 5 && (a += t.N1 + (c - 5)), u = d, c = 1);
        }
        o >= 5 && (a += t.N1 + (o - 5)), c >= 5 && (a += t.N1 + (c - 5));
      }
      return a;
    }, s.getPenaltyN2 = function(n) {
      const r = n.size;
      let a = 0;
      for (let o = 0; o < r - 1; o++)
        for (let c = 0; c < r - 1; c++) {
          const l = n.get(o, c) + n.get(o, c + 1) + n.get(o + 1, c) + n.get(o + 1, c + 1);
          (l === 4 || l === 0) && a++;
        }
      return a * t.N2;
    }, s.getPenaltyN3 = function(n) {
      const r = n.size;
      let a = 0, o = 0, c = 0;
      for (let l = 0; l < r; l++) {
        o = c = 0;
        for (let u = 0; u < r; u++)
          o = o << 1 & 2047 | n.get(l, u), u >= 10 && (o === 1488 || o === 93) && a++, c = c << 1 & 2047 | n.get(u, l), u >= 10 && (c === 1488 || c === 93) && a++;
      }
      return a * t.N3;
    }, s.getPenaltyN4 = function(n) {
      let r = 0;
      const a = n.data.length;
      for (let c = 0; c < a; c++) r += n.data[c];
      return Math.abs(Math.ceil(r * 100 / a / 5) - 10) * t.N4;
    };
    function e(i, n, r) {
      switch (i) {
        case s.Patterns.PATTERN000:
          return (n + r) % 2 === 0;
        case s.Patterns.PATTERN001:
          return n % 2 === 0;
        case s.Patterns.PATTERN010:
          return r % 3 === 0;
        case s.Patterns.PATTERN011:
          return (n + r) % 3 === 0;
        case s.Patterns.PATTERN100:
          return (Math.floor(n / 2) + Math.floor(r / 3)) % 2 === 0;
        case s.Patterns.PATTERN101:
          return n * r % 2 + n * r % 3 === 0;
        case s.Patterns.PATTERN110:
          return (n * r % 2 + n * r % 3) % 2 === 0;
        case s.Patterns.PATTERN111:
          return (n * r % 3 + (n + r) % 2) % 2 === 0;
        default:
          throw new Error("bad maskPattern:" + i);
      }
    }
    s.applyMask = function(n, r) {
      const a = r.size;
      for (let o = 0; o < a; o++)
        for (let c = 0; c < a; c++)
          r.isReserved(c, o) || r.xor(c, o, e(n, c, o));
    }, s.getBestMask = function(n, r) {
      const a = Object.keys(s.Patterns).length;
      let o = 0, c = 1 / 0;
      for (let l = 0; l < a; l++) {
        r(l), s.applyMask(l, n);
        const u = s.getPenaltyN1(n) + s.getPenaltyN2(n) + s.getPenaltyN3(n) + s.getPenaltyN4(n);
        s.applyMask(l, n), u < c && (c = u, o = l);
      }
      return o;
    };
  }(it)), it;
}
var G = {}, Lt;
function te() {
  if (Lt) return G;
  Lt = 1;
  const s = St(), t = [
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
  return G.getBlocksCount = function(n, r) {
    switch (r) {
      case s.L:
        return t[(n - 1) * 4 + 0];
      case s.M:
        return t[(n - 1) * 4 + 1];
      case s.Q:
        return t[(n - 1) * 4 + 2];
      case s.H:
        return t[(n - 1) * 4 + 3];
      default:
        return;
    }
  }, G.getTotalCodewordsCount = function(n, r) {
    switch (r) {
      case s.L:
        return e[(n - 1) * 4 + 0];
      case s.M:
        return e[(n - 1) * 4 + 1];
      case s.Q:
        return e[(n - 1) * 4 + 2];
      case s.H:
        return e[(n - 1) * 4 + 3];
      default:
        return;
    }
  }, G;
}
var rt = {}, $ = {}, xt;
function Ce() {
  if (xt) return $;
  xt = 1;
  const s = new Uint8Array(512), t = new Uint8Array(256);
  return function() {
    let i = 1;
    for (let n = 0; n < 255; n++)
      s[n] = i, t[i] = n, i <<= 1, i & 256 && (i ^= 285);
    for (let n = 255; n < 512; n++)
      s[n] = s[n - 255];
  }(), $.log = function(i) {
    if (i < 1) throw new Error("log(" + i + ")");
    return t[i];
  }, $.exp = function(i) {
    return s[i];
  }, $.mul = function(i, n) {
    return i === 0 || n === 0 ? 0 : s[t[i] + t[n]];
  }, $;
}
var Ft;
function Se() {
  return Ft || (Ft = 1, function(s) {
    const t = Ce();
    s.mul = function(i, n) {
      const r = new Uint8Array(i.length + n.length - 1);
      for (let a = 0; a < i.length; a++)
        for (let o = 0; o < n.length; o++)
          r[a + o] ^= t.mul(i[a], n[o]);
      return r;
    }, s.mod = function(i, n) {
      let r = new Uint8Array(i);
      for (; r.length - n.length >= 0; ) {
        const a = r[0];
        for (let c = 0; c < n.length; c++)
          r[c] ^= t.mul(n[c], a);
        let o = 0;
        for (; o < r.length && r[o] === 0; ) o++;
        r = r.slice(o);
      }
      return r;
    }, s.generateECPolynomial = function(i) {
      let n = new Uint8Array([1]);
      for (let r = 0; r < i; r++)
        n = s.mul(n, new Uint8Array([1, t.exp(r)]));
      return n;
    };
  }(rt)), rt;
}
var st, Dt;
function we() {
  if (Dt) return st;
  Dt = 1;
  const s = Se();
  function t(e) {
    this.genPoly = void 0, this.degree = e, this.degree && this.initialize(this.degree);
  }
  return t.prototype.initialize = function(i) {
    this.degree = i, this.genPoly = s.generateECPolynomial(this.degree);
  }, t.prototype.encode = function(i) {
    if (!this.genPoly)
      throw new Error("Encoder not initialized");
    const n = new Uint8Array(i.length + this.degree);
    n.set(i);
    const r = s.mod(n, this.genPoly), a = this.degree - r.length;
    if (a > 0) {
      const o = new Uint8Array(this.degree);
      return o.set(r, a), o;
    }
    return r;
  }, st = t, st;
}
var ot = {}, at = {}, ct = {}, qt;
function ee() {
  return qt || (qt = 1, ct.isValid = function(t) {
    return !isNaN(t) && t >= 1 && t <= 40;
  }), ct;
}
var P = {}, _t;
function ne() {
  if (_t) return P;
  _t = 1;
  const s = "[0-9]+", t = "[A-Z $%*+\\-./:]+";
  let e = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
  e = e.replace(/u/g, "\\u");
  const i = "(?:(?![A-Z0-9 $%*+\\-./:]|" + e + `)(?:.|[\r
]))+`;
  P.KANJI = new RegExp(e, "g"), P.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g"), P.BYTE = new RegExp(i, "g"), P.NUMERIC = new RegExp(s, "g"), P.ALPHANUMERIC = new RegExp(t, "g");
  const n = new RegExp("^" + e + "$"), r = new RegExp("^" + s + "$"), a = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
  return P.testKanji = function(c) {
    return n.test(c);
  }, P.testNumeric = function(c) {
    return r.test(c);
  }, P.testAlphanumeric = function(c) {
    return a.test(c);
  }, P;
}
var Ut;
function _() {
  return Ut || (Ut = 1, function(s) {
    const t = ee(), e = ne();
    s.NUMERIC = {
      id: "Numeric",
      bit: 1,
      ccBits: [10, 12, 14]
    }, s.ALPHANUMERIC = {
      id: "Alphanumeric",
      bit: 2,
      ccBits: [9, 11, 13]
    }, s.BYTE = {
      id: "Byte",
      bit: 4,
      ccBits: [8, 16, 16]
    }, s.KANJI = {
      id: "Kanji",
      bit: 8,
      ccBits: [8, 10, 12]
    }, s.MIXED = {
      bit: -1
    }, s.getCharCountIndicator = function(r, a) {
      if (!r.ccBits) throw new Error("Invalid mode: " + r);
      if (!t.isValid(a))
        throw new Error("Invalid version: " + a);
      return a >= 1 && a < 10 ? r.ccBits[0] : a < 27 ? r.ccBits[1] : r.ccBits[2];
    }, s.getBestModeForData = function(r) {
      return e.testNumeric(r) ? s.NUMERIC : e.testAlphanumeric(r) ? s.ALPHANUMERIC : e.testKanji(r) ? s.KANJI : s.BYTE;
    }, s.toString = function(r) {
      if (r && r.id) return r.id;
      throw new Error("Invalid mode");
    }, s.isValid = function(r) {
      return r && r.bit && r.ccBits;
    };
    function i(n) {
      if (typeof n != "string")
        throw new Error("Param is not a string");
      switch (n.toLowerCase()) {
        case "numeric":
          return s.NUMERIC;
        case "alphanumeric":
          return s.ALPHANUMERIC;
        case "kanji":
          return s.KANJI;
        case "byte":
          return s.BYTE;
        default:
          throw new Error("Unknown mode: " + n);
      }
    }
    s.from = function(r, a) {
      if (s.isValid(r))
        return r;
      try {
        return i(r);
      } catch {
        return a;
      }
    };
  }(at)), at;
}
var Ot;
function ve() {
  return Ot || (Ot = 1, function(s) {
    const t = q(), e = te(), i = St(), n = _(), r = ee(), a = 7973, o = t.getBCHDigit(a);
    function c(f, d, y) {
      for (let p = 1; p <= 40; p++)
        if (d <= s.getCapacity(p, y, f))
          return p;
    }
    function l(f, d) {
      return n.getCharCountIndicator(f, d) + 4;
    }
    function u(f, d) {
      let y = 0;
      return f.forEach(function(p) {
        const B = l(p.mode, d);
        y += B + p.getBitsLength();
      }), y;
    }
    function h(f, d) {
      for (let y = 1; y <= 40; y++)
        if (u(f, y) <= s.getCapacity(y, d, n.MIXED))
          return y;
    }
    s.from = function(d, y) {
      return r.isValid(d) ? parseInt(d, 10) : y;
    }, s.getCapacity = function(d, y, p) {
      if (!r.isValid(d))
        throw new Error("Invalid QR Code version");
      typeof p > "u" && (p = n.BYTE);
      const B = t.getSymbolTotalCodewords(d), E = e.getTotalCodewordsCount(d, y), R = (B - E) * 8;
      if (p === n.MIXED) return R;
      const I = R - l(p, d);
      switch (p) {
        case n.NUMERIC:
          return Math.floor(I / 10 * 3);
        case n.ALPHANUMERIC:
          return Math.floor(I / 11 * 2);
        case n.KANJI:
          return Math.floor(I / 13);
        case n.BYTE:
        default:
          return Math.floor(I / 8);
      }
    }, s.getBestVersionForData = function(d, y) {
      let p;
      const B = i.from(y, i.M);
      if (Array.isArray(d)) {
        if (d.length > 1)
          return h(d, B);
        if (d.length === 0)
          return 1;
        p = d[0];
      } else
        p = d;
      return c(p.mode, p.getLength(), B);
    }, s.getEncodedBits = function(d) {
      if (!r.isValid(d) || d < 7)
        throw new Error("Invalid QR Code version");
      let y = d << 12;
      for (; t.getBCHDigit(y) - o >= 0; )
        y ^= a << t.getBCHDigit(y) - o;
      return d << 12 | y;
    };
  }(ot)), ot;
}
var lt = {}, zt;
function Me() {
  if (zt) return lt;
  zt = 1;
  const s = q(), t = 1335, e = 21522, i = s.getBCHDigit(t);
  return lt.getEncodedBits = function(r, a) {
    const o = r.bit << 3 | a;
    let c = o << 10;
    for (; s.getBCHDigit(c) - i >= 0; )
      c ^= t << s.getBCHDigit(c) - i;
    return (o << 10 | c) ^ e;
  }, lt;
}
var dt = {}, ut, $t;
function be() {
  if ($t) return ut;
  $t = 1;
  const s = _();
  function t(e) {
    this.mode = s.NUMERIC, this.data = e.toString();
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
    const o = this.data.length - n;
    o > 0 && (r = this.data.substr(n), a = parseInt(r, 10), i.put(a, o * 3 + 1));
  }, ut = t, ut;
}
var ft, Yt;
function Ee() {
  if (Yt) return ft;
  Yt = 1;
  const s = _(), t = [
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
    this.mode = s.ALPHANUMERIC, this.data = i;
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
  }, ft = e, ft;
}
var ht, Gt;
function Ie() {
  if (Gt) return ht;
  Gt = 1;
  const s = _();
  function t(e) {
    this.mode = s.BYTE, typeof e == "string" ? this.data = new TextEncoder().encode(e) : this.data = new Uint8Array(e);
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
  }, ht = t, ht;
}
var gt, Ht;
function Te() {
  if (Ht) return gt;
  Ht = 1;
  const s = _(), t = q();
  function e(i) {
    this.mode = s.KANJI, this.data = i;
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
  }, gt = e, gt;
}
var mt = { exports: {} }, Vt;
function ke() {
  return Vt || (Vt = 1, function(s) {
    var t = {
      single_source_shortest_paths: function(e, i, n) {
        var r = {}, a = {};
        a[i] = 0;
        var o = t.PriorityQueue.make();
        o.push(i, 0);
        for (var c, l, u, h, f, d, y, p, B; !o.empty(); ) {
          c = o.pop(), l = c.value, h = c.cost, f = e[l] || {};
          for (u in f)
            f.hasOwnProperty(u) && (d = f[u], y = h + d, p = a[u], B = typeof a[u] > "u", (B || p > y) && (a[u] = y, o.push(u, y), r[u] = l));
        }
        if (typeof n < "u" && typeof a[n] > "u") {
          var E = ["Could not find a path from ", i, " to ", n, "."].join("");
          throw new Error(E);
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
    s.exports = t;
  }(mt)), mt.exports;
}
var jt;
function Re() {
  return jt || (jt = 1, function(s) {
    const t = _(), e = be(), i = Ee(), n = Ie(), r = Te(), a = ne(), o = q(), c = ke();
    function l(E) {
      return unescape(encodeURIComponent(E)).length;
    }
    function u(E, R, I) {
      const S = [];
      let N;
      for (; (N = E.exec(I)) !== null; )
        S.push({
          data: N[0],
          index: N.index,
          mode: R,
          length: N[0].length
        });
      return S;
    }
    function h(E) {
      const R = u(a.NUMERIC, t.NUMERIC, E), I = u(a.ALPHANUMERIC, t.ALPHANUMERIC, E);
      let S, N;
      return o.isKanjiModeEnabled() ? (S = u(a.BYTE, t.BYTE, E), N = u(a.KANJI, t.KANJI, E)) : (S = u(a.BYTE_KANJI, t.BYTE, E), N = []), R.concat(I, S, N).sort(function(v, w) {
        return v.index - w.index;
      }).map(function(v) {
        return {
          data: v.data,
          mode: v.mode,
          length: v.length
        };
      });
    }
    function f(E, R) {
      switch (R) {
        case t.NUMERIC:
          return e.getBitsLength(E);
        case t.ALPHANUMERIC:
          return i.getBitsLength(E);
        case t.KANJI:
          return r.getBitsLength(E);
        case t.BYTE:
          return n.getBitsLength(E);
      }
    }
    function d(E) {
      return E.reduce(function(R, I) {
        const S = R.length - 1 >= 0 ? R[R.length - 1] : null;
        return S && S.mode === I.mode ? (R[R.length - 1].data += I.data, R) : (R.push(I), R);
      }, []);
    }
    function y(E) {
      const R = [];
      for (let I = 0; I < E.length; I++) {
        const S = E[I];
        switch (S.mode) {
          case t.NUMERIC:
            R.push([
              S,
              { data: S.data, mode: t.ALPHANUMERIC, length: S.length },
              { data: S.data, mode: t.BYTE, length: S.length }
            ]);
            break;
          case t.ALPHANUMERIC:
            R.push([
              S,
              { data: S.data, mode: t.BYTE, length: S.length }
            ]);
            break;
          case t.KANJI:
            R.push([
              S,
              { data: S.data, mode: t.BYTE, length: l(S.data) }
            ]);
            break;
          case t.BYTE:
            R.push([
              { data: S.data, mode: t.BYTE, length: l(S.data) }
            ]);
        }
      }
      return R;
    }
    function p(E, R) {
      const I = {}, S = { start: {} };
      let N = ["start"];
      for (let m = 0; m < E.length; m++) {
        const v = E[m], w = [];
        for (let C = 0; C < v.length; C++) {
          const k = v[C], M = "" + m + C;
          w.push(M), I[M] = { node: k, lastCount: 0 }, S[M] = {};
          for (let T = 0; T < N.length; T++) {
            const b = N[T];
            I[b] && I[b].node.mode === k.mode ? (S[b][M] = f(I[b].lastCount + k.length, k.mode) - f(I[b].lastCount, k.mode), I[b].lastCount += k.length) : (I[b] && (I[b].lastCount = k.length), S[b][M] = f(k.length, k.mode) + 4 + t.getCharCountIndicator(k.mode, R));
          }
        }
        N = w;
      }
      for (let m = 0; m < N.length; m++)
        S[N[m]].end = 0;
      return { map: S, table: I };
    }
    function B(E, R) {
      let I;
      const S = t.getBestModeForData(E);
      if (I = t.from(R, S), I !== t.BYTE && I.bit < S.bit)
        throw new Error('"' + E + '" cannot be encoded with mode ' + t.toString(I) + `.
 Suggested mode is: ` + t.toString(S));
      switch (I === t.KANJI && !o.isKanjiModeEnabled() && (I = t.BYTE), I) {
        case t.NUMERIC:
          return new e(E);
        case t.ALPHANUMERIC:
          return new i(E);
        case t.KANJI:
          return new r(E);
        case t.BYTE:
          return new n(E);
      }
    }
    s.fromArray = function(R) {
      return R.reduce(function(I, S) {
        return typeof S == "string" ? I.push(B(S, null)) : S.data && I.push(B(S.data, S.mode)), I;
      }, []);
    }, s.fromString = function(R, I) {
      const S = h(R, o.isKanjiModeEnabled()), N = y(S), m = p(N, I), v = c.find_path(m.map, "start", "end"), w = [];
      for (let C = 1; C < v.length - 1; C++)
        w.push(m.table[v[C]].node);
      return s.fromArray(d(w));
    }, s.rawSplit = function(R) {
      return s.fromArray(
        h(R, o.isKanjiModeEnabled())
      );
    };
  }(dt)), dt;
}
var Kt;
function Ae() {
  if (Kt) return Q;
  Kt = 1;
  const s = q(), t = St(), e = he(), i = ge(), n = me(), r = pe(), a = ye(), o = te(), c = we(), l = ve(), u = Me(), h = _(), f = Re();
  function d(m, v) {
    const w = m.size, C = r.getPositions(v);
    for (let k = 0; k < C.length; k++) {
      const M = C[k][0], T = C[k][1];
      for (let b = -1; b <= 7; b++)
        if (!(M + b <= -1 || w <= M + b))
          for (let A = -1; A <= 7; A++)
            T + A <= -1 || w <= T + A || (b >= 0 && b <= 6 && (A === 0 || A === 6) || A >= 0 && A <= 6 && (b === 0 || b === 6) || b >= 2 && b <= 4 && A >= 2 && A <= 4 ? m.set(M + b, T + A, !0, !0) : m.set(M + b, T + A, !1, !0));
    }
  }
  function y(m) {
    const v = m.size;
    for (let w = 8; w < v - 8; w++) {
      const C = w % 2 === 0;
      m.set(w, 6, C, !0), m.set(6, w, C, !0);
    }
  }
  function p(m, v) {
    const w = n.getPositions(v);
    for (let C = 0; C < w.length; C++) {
      const k = w[C][0], M = w[C][1];
      for (let T = -2; T <= 2; T++)
        for (let b = -2; b <= 2; b++)
          T === -2 || T === 2 || b === -2 || b === 2 || T === 0 && b === 0 ? m.set(k + T, M + b, !0, !0) : m.set(k + T, M + b, !1, !0);
    }
  }
  function B(m, v) {
    const w = m.size, C = l.getEncodedBits(v);
    let k, M, T;
    for (let b = 0; b < 18; b++)
      k = Math.floor(b / 3), M = b % 3 + w - 8 - 3, T = (C >> b & 1) === 1, m.set(k, M, T, !0), m.set(M, k, T, !0);
  }
  function E(m, v, w) {
    const C = m.size, k = u.getEncodedBits(v, w);
    let M, T;
    for (M = 0; M < 15; M++)
      T = (k >> M & 1) === 1, M < 6 ? m.set(M, 8, T, !0) : M < 8 ? m.set(M + 1, 8, T, !0) : m.set(C - 15 + M, 8, T, !0), M < 8 ? m.set(8, C - M - 1, T, !0) : M < 9 ? m.set(8, 15 - M - 1 + 1, T, !0) : m.set(8, 15 - M - 1, T, !0);
    m.set(C - 8, 8, 1, !0);
  }
  function R(m, v) {
    const w = m.size;
    let C = -1, k = w - 1, M = 7, T = 0;
    for (let b = w - 1; b > 0; b -= 2)
      for (b === 6 && b--; ; ) {
        for (let A = 0; A < 2; A++)
          if (!m.isReserved(k, b - A)) {
            let F = !1;
            T < v.length && (F = (v[T] >>> M & 1) === 1), m.set(k, b - A, F), M--, M === -1 && (T++, M = 7);
          }
        if (k += C, k < 0 || w <= k) {
          k -= C, C = -C;
          break;
        }
      }
  }
  function I(m, v, w) {
    const C = new e();
    w.forEach(function(A) {
      C.put(A.mode.bit, 4), C.put(A.getLength(), h.getCharCountIndicator(A.mode, m)), A.write(C);
    });
    const k = s.getSymbolTotalCodewords(m), M = o.getTotalCodewordsCount(m, v), T = (k - M) * 8;
    for (C.getLengthInBits() + 4 <= T && C.put(0, 4); C.getLengthInBits() % 8 !== 0; )
      C.putBit(0);
    const b = (T - C.getLengthInBits()) / 8;
    for (let A = 0; A < b; A++)
      C.put(A % 2 ? 17 : 236, 8);
    return S(C, m, v);
  }
  function S(m, v, w) {
    const C = s.getSymbolTotalCodewords(v), k = o.getTotalCodewordsCount(v, w), M = C - k, T = o.getBlocksCount(v, w), b = C % T, A = T - b, F = Math.floor(C / T), z = Math.floor(M / T), re = z + 1, wt = F - z, se = new c(wt);
    let H = 0;
    const Y = new Array(T), vt = new Array(T);
    let V = 0;
    const oe = new Uint8Array(m.buffer);
    for (let U = 0; U < T; U++) {
      const K = U < A ? z : re;
      Y[U] = oe.slice(H, H + K), vt[U] = se.encode(Y[U]), H += K, V = Math.max(V, K);
    }
    const j = new Uint8Array(C);
    let Mt = 0, L, x;
    for (L = 0; L < V; L++)
      for (x = 0; x < T; x++)
        L < Y[x].length && (j[Mt++] = Y[x][L]);
    for (L = 0; L < wt; L++)
      for (x = 0; x < T; x++)
        j[Mt++] = vt[x][L];
    return j;
  }
  function N(m, v, w, C) {
    let k;
    if (Array.isArray(m))
      k = f.fromArray(m);
    else if (typeof m == "string") {
      let F = v;
      if (!F) {
        const z = f.rawSplit(m);
        F = l.getBestVersionForData(z, w);
      }
      k = f.fromString(m, F || 40);
    } else
      throw new Error("Invalid data");
    const M = l.getBestVersionForData(k, w);
    if (!M)
      throw new Error("The amount of data is too big to be stored in a QR Code");
    if (!v)
      v = M;
    else if (v < M)
      throw new Error(
        `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ` + M + `.
`
      );
    const T = I(v, w, k), b = s.getSymbolSize(v), A = new i(b);
    return d(A, v), y(A), p(A, v), E(A, w, 0), v >= 7 && B(A, v), R(A, T), isNaN(C) && (C = a.getBestMask(
      A,
      E.bind(null, A, w)
    )), a.applyMask(C, A), E(A, w, C), {
      modules: A,
      version: v,
      errorCorrectionLevel: w,
      maskPattern: C,
      segments: k
    };
  }
  return Q.create = function(v, w) {
    if (typeof v > "u" || v === "")
      throw new Error("No input text");
    let C = t.M, k, M;
    return typeof w < "u" && (C = t.from(w.errorCorrectionLevel, t.M), k = l.from(w.version), M = a.from(w.maskPattern), w.toSJISFunc && s.setToSJISFunction(w.toSJISFunc)), N(v, k, C, M);
  }, Q;
}
var pt = {}, yt = {}, Jt;
function ie() {
  return Jt || (Jt = 1, function(s) {
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
    s.getOptions = function(i) {
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
    }, s.getScale = function(i, n) {
      return n.width && n.width >= i + n.margin * 2 ? n.width / (i + n.margin * 2) : n.scale;
    }, s.getImageWidth = function(i, n) {
      const r = s.getScale(i, n);
      return Math.floor((i + n.margin * 2) * r);
    }, s.qrToImageData = function(i, n, r) {
      const a = n.modules.size, o = n.modules.data, c = s.getScale(a, r), l = Math.floor((a + r.margin * 2) * c), u = r.margin * c, h = [r.color.light, r.color.dark];
      for (let f = 0; f < l; f++)
        for (let d = 0; d < l; d++) {
          let y = (f * l + d) * 4, p = r.color.light;
          if (f >= u && d >= u && f < l - u && d < l - u) {
            const B = Math.floor((f - u) / c), E = Math.floor((d - u) / c);
            p = h[o[B * a + E] ? 1 : 0];
          }
          i[y++] = p.r, i[y++] = p.g, i[y++] = p.b, i[y] = p.a;
        }
    };
  }(yt)), yt;
}
var Xt;
function Be() {
  return Xt || (Xt = 1, function(s) {
    const t = ie();
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
    s.render = function(r, a, o) {
      let c = o, l = a;
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), a || (l = i()), c = t.getOptions(c);
      const u = t.getImageWidth(r.modules.size, c), h = l.getContext("2d"), f = h.createImageData(u, u);
      return t.qrToImageData(f.data, r, c), e(h, l, u), h.putImageData(f, 0, 0), l;
    }, s.renderToDataURL = function(r, a, o) {
      let c = o;
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), c || (c = {});
      const l = s.render(r, a, c), u = c.type || "image/png", h = c.rendererOpts || {};
      return l.toDataURL(u, h.quality);
    };
  }(pt)), pt;
}
var Ct = {}, Qt;
function Ne() {
  if (Qt) return Ct;
  Qt = 1;
  const s = ie();
  function t(n, r) {
    const a = n.a / 255, o = r + '="' + n.hex + '"';
    return a < 1 ? o + " " + r + '-opacity="' + a.toFixed(2).slice(1) + '"' : o;
  }
  function e(n, r, a) {
    let o = n + r;
    return typeof a < "u" && (o += " " + a), o;
  }
  function i(n, r, a) {
    let o = "", c = 0, l = !1, u = 0;
    for (let h = 0; h < n.length; h++) {
      const f = Math.floor(h % r), d = Math.floor(h / r);
      !f && !l && (l = !0), n[h] ? (u++, h > 0 && f > 0 && n[h - 1] || (o += l ? e("M", f + a, 0.5 + d + a) : e("m", c, 0), c = 0, l = !1), f + 1 < r && n[h + 1] || (o += e("h", u), u = 0)) : c++;
    }
    return o;
  }
  return Ct.render = function(r, a, o) {
    const c = s.getOptions(a), l = r.modules.size, u = r.modules.data, h = l + c.margin * 2, f = c.color.light.a ? "<path " + t(c.color.light, "fill") + ' d="M0 0h' + h + "v" + h + 'H0z"/>' : "", d = "<path " + t(c.color.dark, "stroke") + ' d="' + i(u, l, c.margin) + '"/>', y = 'viewBox="0 0 ' + h + " " + h + '"', B = '<svg xmlns="http://www.w3.org/2000/svg" ' + (c.width ? 'width="' + c.width + '" height="' + c.width + '" ' : "") + y + ' shape-rendering="crispEdges">' + f + d + `</svg>
`;
    return typeof o == "function" && o(null, B), B;
  }, Ct;
}
var Wt;
function Pe() {
  if (Wt) return O;
  Wt = 1;
  const s = fe(), t = Ae(), e = Be(), i = Ne();
  function n(r, a, o, c, l) {
    const u = [].slice.call(arguments, 1), h = u.length, f = typeof u[h - 1] == "function";
    if (!f && !s())
      throw new Error("Callback required as last argument");
    if (f) {
      if (h < 2)
        throw new Error("Too few arguments provided");
      h === 2 ? (l = o, o = a, a = c = void 0) : h === 3 && (a.getContext && typeof l > "u" ? (l = c, c = void 0) : (l = c, c = o, o = a, a = void 0));
    } else {
      if (h < 1)
        throw new Error("Too few arguments provided");
      return h === 1 ? (o = a, a = c = void 0) : h === 2 && !a.getContext && (c = o, o = a, a = void 0), new Promise(function(d, y) {
        try {
          const p = t.create(o, c);
          d(r(p, a, c));
        } catch (p) {
          y(p);
        }
      });
    }
    try {
      const d = t.create(o, c);
      l(null, r(d, a, c));
    } catch (d) {
      l(d);
    }
  }
  return O.create = t.create, O.toCanvas = n.bind(null, e.render), O.toDataURL = n.bind(null, e.renderToDataURL), O.toString = n.bind(null, function(r, a, o) {
    return i.render(r, o);
  }), O;
}
var Le = Pe();
const xe = /* @__PURE__ */ ue(Le);
function Fe(s, t) {
  let e = (s || "").trim();
  (!e || e === "undefined" || e.includes("localhost") || e.includes("127.0.0.1") || e.startsWith("file:")) && (e = "https://adsense.davidpetrea.ro/offer");
  try {
    const i = new URL(e);
    return (i.hostname === "adsense.davidpetrea.ro" || i.hostname.endsWith(".davidpetrea.ro") || i.pathname.startsWith("/offer")) && (t && t !== "undefined" && t !== "display" && i.searchParams.set("d", t), i.searchParams.set("src", "tv")), i.toString();
  } catch {
    const i = t && t !== "undefined" && t !== "display" ? t : "";
    return i ? `https://adsense.davidpetrea.ro/offer?d=${encodeURIComponent(i)}&src=tv` : "https://adsense.davidpetrea.ro/offer?src=tv";
  }
}
function De(s, t, e) {
  const i = Math.min(t, e);
  if (typeof s == "number" && !isNaN(s) && s > 50)
    return Math.max(Math.round(i * 0.25), Math.min(Math.round(i * 0.6), s));
  switch (s) {
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
async function qe(s, t) {
  return xe.toDataURL(s, {
    errorCorrectionLevel: "M",
    margin: 4,
    color: {
      dark: "#0a0d14",
      light: "#ffffff"
    },
    width: t
  });
}
function _e(s) {
  if (s.length === 0)
    return { peopleSide: "left", contentSide: "right" };
  const e = s.reduce((n, r) => n + r.x, 0) / s.length < 0.5 ? "left" : "right";
  return { peopleSide: e, contentSide: e === "left" ? "right" : "left" };
}
function Ue(s, t, e, i, n, r = 0.03) {
  const a = Math.round(i * r), o = e + a, c = n - e - a, l = e + a, u = i - e - a, h = Math.max(l, Math.min(u, s)), f = Math.max(o, Math.min(c, t));
  return { cx: h, cy: f };
}
function Oe(s, t, e, i, n, r, a = 0.03) {
  const o = Math.round(n * a), c = e + o, l = r - e - o, u = Math.max(c, Math.min(l, t));
  let h, f;
  return i === "left" ? (h = e + o, f = n / 2 - e - o) : (h = n / 2 + e + o, f = n - e - o), h > f ? { cx: i === "left" ? n * 0.25 : n * 0.75, cy: u } : { cx: Math.max(h, Math.min(f, s)), cy: u };
}
function ze(s, t, e, i, n = !1, r = 4) {
  const a = s.map((o) => ({ ...o }));
  for (let o = 0; o < r; o++) {
    for (let c = 0; c < a.length; c++)
      for (let l = c + 1; l < a.length; l++) {
        const u = a[c], h = a[l], f = h.cx - u.cx, d = h.cy - u.cy, y = Math.hypot(f, d) || 1, p = u.radius + h.radius;
        if (y < p) {
          const B = (p - y) / 2, E = f / y, R = d / y;
          u.cx -= E * B, u.cy -= R * B, h.cx += E * B, h.cy += R * B;
        }
      }
    for (const c of a) {
      const l = n ? Oe(
        c.cx,
        c.cy,
        c.radius,
        t,
        e,
        i
      ) : Ue(
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
class $e {
  constructor() {
    g(this, "enabled", !1);
    g(this, "activeFaceId", 1);
    g(this, "faces", /* @__PURE__ */ new Map());
    g(this, "indicator", null);
    g(this, "listenersAttached", !1);
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
      const o = a.getContext("2d");
      if (o) {
        const c = o.createLinearGradient(0, 0, 320, 320);
        c.addColorStop(0, "#334155"), c.addColorStop(1, "#1e293b"), o.fillStyle = c, o.fillRect(0, 0, 320, 320), o.fillStyle = t % 2 === 0 ? "#0284c7" : "#059669", o.beginPath(), o.ellipse(160, 330, 110, 80, 0, 0, Math.PI * 2), o.fill(), o.fillStyle = "#fbcfe8", o.fillRect(140, 200, 40, 60), o.fillStyle = t % 2 === 0 ? "#fed7aa" : "#fcd34d", o.beginPath(), o.ellipse(160, 150, 65, 80, 0, 0, Math.PI * 2), o.fill(), o.fillStyle = t % 2 === 0 ? "#3b2f2f" : "#1e1e1e", o.beginPath(), o.ellipse(160, 110, 70, 50, 0, 0, Math.PI * 2), o.fill(), o.fillStyle = "#1e293b", o.beginPath(), o.arc(140, 145, 6, 0, Math.PI * 2), o.arc(180, 145, 6, 0, Math.PI * 2), o.fill(), o.strokeStyle = "#be123c", o.lineWidth = 3, o.beginPath(), o.arc(160, 175, 20, 0.2 * Math.PI, 0.8 * Math.PI), o.stroke(), r = a.toDataURL("image/jpeg", 0.85);
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
const Zt = [
  "crossfade",
  "zoom dissolve",
  "push",
  "soft wipe",
  "dip to black"
];
function Ye(s) {
  if (typeof s == "number")
    return s <= 0.6 ? 500 : s >= 1.2 ? 1400 : 900;
  switch (s) {
    case "fast":
      return 500;
    case "slow":
      return 1400;
    case "normal":
    default:
      return 900;
  }
}
class Ge {
  constructor() {
    g(this, "lastType", null);
  }
  resolve(t) {
    let e = (t || "crossfade").toLowerCase().replace(/_/g, " ");
    if (e === "auto") {
      const n = Zt.filter((a) => a !== this.lastType), r = n[Math.floor(Math.random() * n.length)] || "crossfade";
      return this.lastType = r, r;
    }
    Zt.includes(e) || (e = "crossfade");
    const i = e;
    return this.lastType = i, i;
  }
}
function He(s) {
  const t = -(Math.cos(Math.PI * s) - 1) / 2;
  return t === 0 ? 0 : t;
}
function Ve(s, t) {
  const e = Math.max(0, Math.min(1, t)), i = He(e);
  switch (s) {
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
function je(s) {
  let t = (s || "#111827").replace("#", "");
  t.length === 3 && (t = t.split("").map((a) => a + a).join(""));
  const e = parseInt(t.slice(0, 2), 16) || 17, i = parseInt(t.slice(2, 4), 16) || 24, n = parseInt(t.slice(4, 6), 16) || 39;
  return (0.2126 * e + 0.7152 * i + 0.0722 * n) / 255 > 0.55 ? { text: "#0f172a", muted: "#475569" } : { text: "#f8fafc", muted: "#cbd5e1" };
}
function Ke(s) {
  return s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
}
function Je(s) {
  if (s === 0) return 0;
  if (s === 1) return 1;
  const t = Ke(s), e = Math.sin(s * Math.PI) * 0.08 * (1 - s);
  return t + e;
}
class Xe {
  constructor(t) {
    g(this, "root");
    g(this, "simulator", new $e());
    g(this, "stateMachine", new le());
    g(this, "blender", new de(4));
    g(this, "transitionSelector", new Ge());
    g(this, "state", {});
    g(this, "activeFaces", []);
    g(this, "lockedPeopleSide", "left");
    g(this, "qrDataUrl", "");
    g(this, "lastGeneratedQrUrl", "");
    // Standby playlist state
    g(this, "mediaList", []);
    g(this, "currentMediaIndex", 0);
    g(this, "currentItemStartedMs", 0);
    g(this, "isTransitioning", !1);
    g(this, "transitionStartMs", 0);
    g(this, "activeTransitionType", "crossfade");
    g(this, "activeTransitionDuration", 900);
    g(this, "nextMediaPreloaded", !1);
    // Canvas elements
    g(this, "faceCanvas");
    g(this, "faceCtx");
    g(this, "irisCanvas");
    g(this, "irisCtx");
    // DOM containers
    g(this, "standbyContainer");
    g(this, "offerContainer");
    g(this, "setupContainer");
    g(this, "debugOverlay");
    g(this, "isDebugMode", !1);
    g(this, "fps", 0);
    g(this, "frameCount", 0);
    g(this, "lastFpsTime", 0);
    g(this, "pendingConfig", {});
    g(this, "activeConfig", {});
    g(this, "pendingMediaList", []);
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
    var o, c, l, u, h;
    this.state = t;
    const e = ((o = this.state.sync) == null ? void 0 : o.device_config) || {};
    this.pendingConfig = e, this.currentItemStartedMs || (this.activeConfig = { ...e }), this.stateMachine.updateConfig({
      dwellSeconds: e.lookTime || 3,
      offerMinSeconds: 20,
      exitAfterNobodySeconds: 6,
      cooldownSeconds: 8
    });
    const i = ((c = this.state.sync) == null ? void 0 : c.media) || [], n = ((l = this.state.sync) == null ? void 0 : l.playlist) || [];
    n.length > 0 ? this.pendingMediaList = n.map((f) => i.find((d) => d.id === f)).filter(Boolean) : this.pendingMediaList = i, this.currentItemStartedMs || (this.mediaList = this.pendingMediaList);
    const r = (h = (u = this.state.sync) == null ? void 0 : u.pairing) != null && h.code ? "display" : this.state.device_id || "", a = Fe(e.offerLink, r);
    if (a !== this.lastGeneratedQrUrl) {
      this.lastGeneratedQrUrl = a;
      const f = De(e.qrSize, window.innerWidth, window.innerHeight);
      qe(a, f).then((d) => {
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
        const o = _e(n);
        this.lockedPeopleSide = o.peopleSide;
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
    const n = t - this.currentItemStartedMs, r = this.standbyContainer.querySelector(".media-slot.active"), a = r == null ? void 0 : r.querySelector("video"), o = !!(a && (a.ended || a.duration > 0 && a.currentTime >= a.duration - 0.2));
    if ((n >= i || o) && !this.isTransitioning && this.mediaList.length >= 1 && (this.isTransitioning = !0, this.transitionStartMs = t, this.activeTransitionType = this.transitionSelector.resolve(e.transition), this.activeTransitionDuration = Ye(e.transitionSpeed), this.prepareNextMediaSlot()), this.isTransitioning) {
      const h = t - this.transitionStartMs, f = Math.min(1, h / this.activeTransitionDuration), d = Ve(this.activeTransitionType, f), y = this.standbyContainer.querySelector(".media-slot.outgoing"), p = this.standbyContainer.querySelector(".media-slot.incoming");
      y && (y.style.opacity = String(d.outgoing.opacity), y.style.transform = d.outgoing.transform, d.outgoing.filter && (y.style.filter = d.outgoing.filter)), p && (p.style.opacity = String(d.incoming.opacity), p.style.transform = d.incoming.transform, d.incoming.filter && (p.style.filter = d.incoming.filter), d.incoming.maskImage ? (p.style.webkitMaskImage = d.incoming.maskImage, p.style.maskImage = d.incoming.maskImage) : (p.style.webkitMaskImage = "none", p.style.maskImage = "none")), f >= 1 && (this.isTransitioning = !1, this.currentMediaIndex = (this.currentMediaIndex + 1) % this.mediaList.length, this.currentItemStartedMs = t, this.finalizeMediaTransition());
    } else {
      const h = this.standbyContainer.querySelector(".media-slot.active");
      if (h && h.dataset.type === "image") {
        const f = Math.min(1, n / i), d = 1 + 0.08 * f, y = -1.5 + 3 * f, p = -0.75 + 1.5 * f;
        h.style.transform = `translate3d(${y.toFixed(2)}%, ${p.toFixed(2)}%, 0) scale(${d.toFixed(4)})`;
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
    this.standbyContainer.querySelectorAll(".media-slot.incoming").forEach((o) => o.remove());
    const t = (this.currentMediaIndex + 1) % this.mediaList.length, e = this.mediaList[t];
    if (!e) return;
    const i = (a = e.content_type) == null ? void 0 : a.startsWith("video/"), n = this.standbyContainer.querySelector(".media-slot.active");
    n && (n.className = "media-slot outgoing");
    const r = document.createElement("div");
    if (r.className = "media-slot incoming", r.dataset.type = i ? "video" : "image", r.style.opacity = "0", i) {
      const o = document.createElement("video");
      o.src = e.local, o.autoplay = !0, o.muted = !0, o.playsInline = !0, o.currentTime = 0, o.play().catch(() => {
      }), r.appendChild(o);
    } else {
      const o = document.createElement("img");
      o.src = e.local, o.alt = "", r.appendChild(o);
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
    this.faceCtx.clearRect(0, 0, n, r);
    const a = ((h = this.state.sync) == null ? void 0 : h.device_config) || {};
    if (a.liveFaces === !1) return;
    this.blender.update(t, e, n, r);
    const o = this.blender.getActiveTracks();
    if (o.length === 0) return;
    const c = (i === "TRIGGERING" || i === "OFFER" || i === "EXITING") && (a.template || "recruit") === "recruit", l = o.map((f) => ({
      id: f.id,
      cx: f.currentX,
      cy: f.currentY,
      radius: f.currentSize / 2
    })), u = ze(l, this.lockedPeopleSide, n, r, c);
    for (let f = 0; f < o.length; f++)
      o[f].currentX = u[f].cx, o[f].currentY = u[f].cy;
    this.blender.render(this.faceCtx, n, r);
  }
  renderTemplate(t, e) {
    var R;
    const i = ((R = this.state.sync) == null ? void 0 : R.device_config) || {}, n = i.template || "simple", r = je(i.offerBackground), a = i.offerBackground || "#111827", o = window.innerWidth, c = window.innerHeight;
    if (!this.irisCtx) return;
    if (this.irisCtx.clearRect(0, 0, o, c), t === "STANDBY" || t === "COOLDOWN") {
      this.offerContainer.style.display = "none", this.offerContainer.innerHTML = "";
      return;
    }
    this.offerContainer.style.display = "flex";
    let l = 1, u = 1, h = 1;
    const f = e - this.stateMachine.stateStartedMs;
    if (t === "TRIGGERING")
      l = Math.min(1, f / 1e3), u = Math.max(0, (f - 600) / 400), h = 0.92 + 0.08 * u;
    else if (t === "OFFER")
      l = 1, u = 1, h = 1;
    else if (t === "EXITING") {
      const S = Math.min(1, f / 1e3);
      u = Math.max(0, 1 - S * 2.5), h = 0.92 + 0.08 * u, l = Math.max(0, 1 - S);
    }
    if (n === "recruit") {
      const I = Je(l), S = Math.hypot(o, c), N = this.blender.getActiveTracks();
      if (this.irisCtx.save(), this.irisCtx.fillStyle = a, this.irisCtx.fillRect(0, 0, o, c), this.irisCtx.globalCompositeOperation = "destination-out", N.length > 0)
        for (const m of N) {
          const v = m.currentSize / 2 * 1.15, w = S + (v - S) * I;
          this.irisCtx.beginPath(), this.irisCtx.arc(m.currentX, m.currentY, w, 0, Math.PI * 2), this.irisCtx.fill();
        }
      else {
        const m = S * (1 - I);
        this.irisCtx.beginPath(), this.irisCtx.arc(o / 4, c / 2, m, 0, Math.PI * 2), this.irisCtx.fill();
      }
      this.irisCtx.restore();
    } else
      this.irisCtx.save(), this.irisCtx.globalAlpha = l, this.irisCtx.fillStyle = a, this.irisCtx.fillRect(0, 0, o, c), this.irisCtx.restore();
    const d = this.lockedPeopleSide === "left" ? "right" : "left", y = n === "simple" ? (1 - u) * (d === "right" ? 40 : -40) : 0, p = i.headline || "20% reducere", B = i.subtext || "Scanează codul QR cu telefonul", E = i.caption || "";
    this.offerContainer.style.flexDirection = d === "right" ? "row" : "row-reverse", this.offerContainer.innerHTML = `
      <div class="offer-half media-half" style="opacity: ${u}"></div>
      <div class="offer-half content-half" style="
        opacity: ${u};
        transform: translate3d(${y}px, 0, 0);
        color: ${r.text};
      ">
        <div class="offer-card" style="background: transparent;">
          <h1 class="offer-headline" style="color: ${r.text};">${p}</h1>
          <p class="offer-subtext" style="color: ${r.muted};">${B}</p>
          <div class="qr-wrapper" style="transform: scale(${h.toFixed(4)});">
            <div class="qr-card">
              ${this.qrDataUrl ? `<img src="${this.qrDataUrl}" alt="QR" class="qr-image">` : ""}
            </div>
            ${E ? `<p class="qr-caption" style="color: ${r.muted};">${E}</p>` : ""}
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
  const s = document.querySelector("#app");
  s && new Xe(s);
});
export {
  Xe as App
};
