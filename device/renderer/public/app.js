var le = Object.defineProperty;
var de = (o, t, e) => t in o ? le(o, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : o[t] = e;
var p = (o, t, e) => de(o, typeof t != "symbol" ? t + "" : t, e);
class ue {
  constructor(t = {}) {
    p(this, "state", "STANDBY");
    p(this, "stateStartedMs", 0);
    p(this, "offerStartedMs", 0);
    p(this, "lastFaceSeenMs", null);
    p(this, "triggerFaceId", null);
    p(this, "cooldownUntilMs", 0);
    p(this, "config");
    p(this, "tracks", /* @__PURE__ */ new Map());
    p(this, "triggeredTrackIds", /* @__PURE__ */ new Set());
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
        const n = e - this.offerStartedMs >= this.config.offerMinSeconds * 1e3, r = this.lastFaceSeenMs === null || e - this.lastFaceSeenMs >= this.config.exitAfterNobodySeconds * 1e3, s = this.config.maxOfferSeconds !== void 0 && e - this.offerStartedMs >= this.config.maxOfferSeconds * 1e3;
        (n && r || s) && (this.state = "EXITING", this.stateStartedMs = e);
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
function It(o, t) {
  const e = 1 / (2 * Math.PI * t), i = 1 / o;
  return 1 / (1 + e / i);
}
class kt {
  constructor() {
    p(this, "y", null);
    p(this, "s", null);
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
class et {
  constructor(t = 1, e = 7e-3, i = 1) {
    p(this, "minCutoff");
    p(this, "beta");
    p(this, "dCutoff");
    p(this, "xFilter", new kt());
    p(this, "dxFilter", new kt());
    p(this, "lastTime", null);
    this.minCutoff = t, this.beta = e, this.dCutoff = i;
  }
  filter(t, e) {
    if (this.lastTime === null)
      return this.lastTime = e, this.xFilter.filter(t, 1);
    const i = Math.max((e - this.lastTime) / 1e3, 1e-4);
    this.lastTime = e;
    const n = 1 / i, r = this.xFilter.hasLast() ? (t - this.xFilter.last()) * n : 0, s = this.dxFilter.filter(r, It(n, this.dCutoff)), a = this.minCutoff + this.beta * Math.abs(s);
    return this.xFilter.filter(t, It(n, a));
  }
  reset() {
    this.lastTime = null, this.xFilter.reset(), this.dxFilter.reset();
  }
}
class fe {
  constructor(t = 4) {
    p(this, "tracks", /* @__PURE__ */ new Map());
    p(this, "maxPeople");
    p(this, "offscreenCanvas", null);
    p(this, "offscreenCtx", null);
    this.maxPeople = t;
  }
  getTrack(t) {
    return this.tracks.get(t);
  }
  getActiveTracks() {
    return Array.from(this.tracks.values()).filter((t) => t.alpha > 0);
  }
  update(t, e, i, n) {
    const r = /* @__PURE__ */ new Set(), s = t.slice(0, this.maxPeople), a = n * 0.1, c = n * 0.28;
    for (const l of s) {
      r.add(l.id);
      const h = (l.x + l.w / 2) * i, f = (l.y + l.h / 2 - 0.04 * l.h) * n, u = Math.max(a, Math.min(c, 1.7 * l.h * n));
      let d = this.tracks.get(l.id);
      if (d) {
        if (d.lastSeenMs = e, (d.lastRawX !== h || d.lastRawY !== f) && (d.lastRawX = h, d.lastRawY = f, d.currentX = d.filterX.filter(h, e), d.currentY = d.filterY.filter(f, e)), d.lastRawSize !== u && (d.lastRawSize = u, d.currentSize = d.filterSize.filter(u, e)), l.crop_jpeg && l.crop_jpeg !== d.cropJpeg && (d.cropJpeg = l.crop_jpeg, typeof Image < "u")) {
          const E = new Image();
          E.onload = () => {
            d.image = E;
          }, E.src = l.crop_jpeg;
        }
      } else {
        if (d = {
          id: l.id,
          filterX: new et(0.2, 5e-3),
          filterY: new et(0.2, 5e-3),
          filterSize: new et(0.2, 5e-3),
          currentX: h,
          currentY: f,
          currentSize: u,
          firstSeenMs: e,
          lastSeenMs: e,
          alpha: 0,
          scale: 0.85,
          cropJpeg: l.crop_jpeg,
          lastRawX: h,
          lastRawY: f,
          lastRawSize: u
        }, d.filterX.filter(h, e), d.filterY.filter(f, e), d.filterSize.filter(u, e), typeof Image < "u" && l.crop_jpeg) {
          const m = new Image();
          m.onload = () => {
            d.image = m;
          }, m.src = l.crop_jpeg;
        }
        this.tracks.set(l.id, d);
      }
      const g = Math.min(1, Math.max(0, (e - d.firstSeenMs) / 250));
      d.alpha = g, d.scale = 0.85 + 0.15 * g;
    }
    for (const [l, h] of this.tracks.entries())
      if (!r.has(l)) {
        const f = e - h.lastSeenMs;
        if (f <= 600)
          h.alpha = 1, h.scale = 1;
        else if (f <= 900) {
          const u = (f - 600) / 300;
          h.alpha = Math.max(0, 1 - u), h.scale = Math.max(0.85, 1 - 0.15 * u);
        } else
          this.tracks.delete(l);
      }
    return this.getActiveTracks();
  }
  render(t, e, i) {
    if (!(typeof document > "u") && (this.offscreenCanvas || (this.offscreenCanvas = document.createElement("canvas"), this.offscreenCanvas.width = 512, this.offscreenCanvas.height = 512, this.offscreenCtx = this.offscreenCanvas.getContext("2d")), !(!this.offscreenCtx || !this.offscreenCanvas)))
      for (const n of this.getActiveTracks()) {
        const r = n.image;
        if (!r || !r.complete || r.naturalWidth === 0) continue;
        const s = Math.round(n.currentSize * n.scale);
        if (s <= 0) continue;
        const a = this.offscreenCtx;
        a.clearRect(0, 0, s, s), a.globalCompositeOperation = "source-over", a.drawImage(r, 0, 0, s, s), a.globalCompositeOperation = "destination-in";
        const c = s / 2, l = a.createRadialGradient(c, c, 0, c, c, c);
        l.addColorStop(0, "rgba(0,0,0,1)"), l.addColorStop(0.2, "rgba(0,0,0,0.98)"), l.addColorStop(0.35, "rgba(0,0,0,0.88)"), l.addColorStop(0.5, "rgba(0,0,0,0.70)"), l.addColorStop(0.65, "rgba(0,0,0,0.48)"), l.addColorStop(0.8, "rgba(0,0,0,0.24)"), l.addColorStop(0.92, "rgba(0,0,0,0.07)"), l.addColorStop(1, "rgba(0,0,0,0)"), a.fillStyle = l, a.fillRect(0, 0, s, s), t.save(), t.globalAlpha = n.alpha, t.drawImage(
          this.offscreenCanvas,
          0,
          0,
          s,
          s,
          Math.round(n.currentX - s / 2),
          Math.round(n.currentY - s / 2),
          s,
          s
        ), t.restore();
      }
  }
}
function he(o) {
  return o && o.__esModule && Object.prototype.hasOwnProperty.call(o, "default") ? o.default : o;
}
var j = {}, nt, Rt;
function ge() {
  return Rt || (Rt = 1, nt = function() {
    return typeof Promise == "function" && Promise.prototype && Promise.prototype.then;
  }), nt;
}
var it = {}, U = {}, At;
function z() {
  if (At) return U;
  At = 1;
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
var rt = {}, Bt;
function Tt() {
  return Bt || (Bt = 1, function(o) {
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
  }(rt)), rt;
}
var ot, Nt;
function me() {
  if (Nt) return ot;
  Nt = 1;
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
  }, ot = o, ot;
}
var st, Pt;
function pe() {
  if (Pt) return st;
  Pt = 1;
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
  }, st = o, st;
}
var at = {}, Lt;
function ye() {
  return Lt || (Lt = 1, function(o) {
    const t = z().getSymbolSize;
    o.getRowColCoords = function(i) {
      if (i === 1) return [];
      const n = Math.floor(i / 7) + 2, r = t(i), s = r === 145 ? 26 : Math.ceil((r - 13) / (2 * n - 2)) * 2, a = [r - 7];
      for (let c = 1; c < n - 1; c++)
        a[c] = a[c - 1] - s;
      return a.push(6), a.reverse();
    }, o.getPositions = function(i) {
      const n = [], r = o.getRowColCoords(i), s = r.length;
      for (let a = 0; a < s; a++)
        for (let c = 0; c < s; c++)
          a === 0 && c === 0 || // top-left
          a === 0 && c === s - 1 || // bottom-left
          a === s - 1 && c === 0 || n.push([r[a], r[c]]);
      return n;
    };
  }(at)), at;
}
var ct = {}, Ft;
function Se() {
  if (Ft) return ct;
  Ft = 1;
  const o = z().getSymbolSize, t = 7;
  return ct.getPositions = function(i) {
    const n = o(i);
    return [
      // top-left
      [0, 0],
      // top-right
      [n - t, 0],
      // bottom-left
      [0, n - t]
    ];
  }, ct;
}
var lt = {}, Dt;
function Ce() {
  return Dt || (Dt = 1, function(o) {
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
      let s = 0, a = 0, c = 0, l = null, h = null;
      for (let f = 0; f < r; f++) {
        a = c = 0, l = h = null;
        for (let u = 0; u < r; u++) {
          let d = n.get(f, u);
          d === l ? a++ : (a >= 5 && (s += t.N1 + (a - 5)), l = d, a = 1), d = n.get(u, f), d === h ? c++ : (c >= 5 && (s += t.N1 + (c - 5)), h = d, c = 1);
        }
        a >= 5 && (s += t.N1 + (a - 5)), c >= 5 && (s += t.N1 + (c - 5));
      }
      return s;
    }, o.getPenaltyN2 = function(n) {
      const r = n.size;
      let s = 0;
      for (let a = 0; a < r - 1; a++)
        for (let c = 0; c < r - 1; c++) {
          const l = n.get(a, c) + n.get(a, c + 1) + n.get(a + 1, c) + n.get(a + 1, c + 1);
          (l === 4 || l === 0) && s++;
        }
      return s * t.N2;
    }, o.getPenaltyN3 = function(n) {
      const r = n.size;
      let s = 0, a = 0, c = 0;
      for (let l = 0; l < r; l++) {
        a = c = 0;
        for (let h = 0; h < r; h++)
          a = a << 1 & 2047 | n.get(l, h), h >= 10 && (a === 1488 || a === 93) && s++, c = c << 1 & 2047 | n.get(h, l), h >= 10 && (c === 1488 || c === 93) && s++;
      }
      return s * t.N3;
    }, o.getPenaltyN4 = function(n) {
      let r = 0;
      const s = n.data.length;
      for (let c = 0; c < s; c++) r += n.data[c];
      return Math.abs(Math.ceil(r * 100 / s / 5) - 10) * t.N4;
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
      const s = r.size;
      for (let a = 0; a < s; a++)
        for (let c = 0; c < s; c++)
          r.isReserved(c, a) || r.xor(c, a, e(n, c, a));
    }, o.getBestMask = function(n, r) {
      const s = Object.keys(o.Patterns).length;
      let a = 0, c = 1 / 0;
      for (let l = 0; l < s; l++) {
        r(l), o.applyMask(l, n);
        const h = o.getPenaltyN1(n) + o.getPenaltyN2(n) + o.getPenaltyN3(n) + o.getPenaltyN4(n);
        o.applyMask(l, n), h < c && (c = h, a = l);
      }
      return a;
    };
  }(lt)), lt;
}
var Z = {}, qt;
function oe() {
  if (qt) return Z;
  qt = 1;
  const o = Tt(), t = [
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
  return Z.getBlocksCount = function(n, r) {
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
  }, Z.getTotalCodewordsCount = function(n, r) {
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
  }, Z;
}
var dt = {}, X = {}, Ut;
function we() {
  if (Ut) return X;
  Ut = 1;
  const o = new Uint8Array(512), t = new Uint8Array(256);
  return function() {
    let i = 1;
    for (let n = 0; n < 255; n++)
      o[n] = i, t[i] = n, i <<= 1, i & 256 && (i ^= 285);
    for (let n = 255; n < 512; n++)
      o[n] = o[n - 255];
  }(), X.log = function(i) {
    if (i < 1) throw new Error("log(" + i + ")");
    return t[i];
  }, X.exp = function(i) {
    return o[i];
  }, X.mul = function(i, n) {
    return i === 0 || n === 0 ? 0 : o[t[i] + t[n]];
  }, X;
}
var _t;
function ve() {
  return _t || (_t = 1, function(o) {
    const t = we();
    o.mul = function(i, n) {
      const r = new Uint8Array(i.length + n.length - 1);
      for (let s = 0; s < i.length; s++)
        for (let a = 0; a < n.length; a++)
          r[s + a] ^= t.mul(i[s], n[a]);
      return r;
    }, o.mod = function(i, n) {
      let r = new Uint8Array(i);
      for (; r.length - n.length >= 0; ) {
        const s = r[0];
        for (let c = 0; c < n.length; c++)
          r[c] ^= t.mul(n[c], s);
        let a = 0;
        for (; a < r.length && r[a] === 0; ) a++;
        r = r.slice(a);
      }
      return r;
    }, o.generateECPolynomial = function(i) {
      let n = new Uint8Array([1]);
      for (let r = 0; r < i; r++)
        n = o.mul(n, new Uint8Array([1, t.exp(r)]));
      return n;
    };
  }(dt)), dt;
}
var ut, Ot;
function Me() {
  if (Ot) return ut;
  Ot = 1;
  const o = ve();
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
    const r = o.mod(n, this.genPoly), s = this.degree - r.length;
    if (s > 0) {
      const a = new Uint8Array(this.degree);
      return a.set(r, s), a;
    }
    return r;
  }, ut = t, ut;
}
var ft = {}, ht = {}, gt = {}, $t;
function se() {
  return $t || ($t = 1, gt.isValid = function(t) {
    return !isNaN(t) && t >= 1 && t <= 40;
  }), gt;
}
var D = {}, zt;
function ae() {
  if (zt) return D;
  zt = 1;
  const o = "[0-9]+", t = "[A-Z $%*+\\-./:]+";
  let e = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
  e = e.replace(/u/g, "\\u");
  const i = "(?:(?![A-Z0-9 $%*+\\-./:]|" + e + `)(?:.|[\r
]))+`;
  D.KANJI = new RegExp(e, "g"), D.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g"), D.BYTE = new RegExp(i, "g"), D.NUMERIC = new RegExp(o, "g"), D.ALPHANUMERIC = new RegExp(t, "g");
  const n = new RegExp("^" + e + "$"), r = new RegExp("^" + o + "$"), s = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
  return D.testKanji = function(c) {
    return n.test(c);
  }, D.testNumeric = function(c) {
    return r.test(c);
  }, D.testAlphanumeric = function(c) {
    return s.test(c);
  }, D;
}
var Yt;
function Y() {
  return Yt || (Yt = 1, function(o) {
    const t = se(), e = ae();
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
    }, o.getCharCountIndicator = function(r, s) {
      if (!r.ccBits) throw new Error("Invalid mode: " + r);
      if (!t.isValid(s))
        throw new Error("Invalid version: " + s);
      return s >= 1 && s < 10 ? r.ccBits[0] : s < 27 ? r.ccBits[1] : r.ccBits[2];
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
    o.from = function(r, s) {
      if (o.isValid(r))
        return r;
      try {
        return i(r);
      } catch {
        return s;
      }
    };
  }(ht)), ht;
}
var Gt;
function be() {
  return Gt || (Gt = 1, function(o) {
    const t = z(), e = oe(), i = Tt(), n = Y(), r = se(), s = 7973, a = t.getBCHDigit(s);
    function c(u, d, g) {
      for (let m = 1; m <= 40; m++)
        if (d <= o.getCapacity(m, g, u))
          return m;
    }
    function l(u, d) {
      return n.getCharCountIndicator(u, d) + 4;
    }
    function h(u, d) {
      let g = 0;
      return u.forEach(function(m) {
        const E = l(m.mode, d);
        g += E + m.getBitsLength();
      }), g;
    }
    function f(u, d) {
      for (let g = 1; g <= 40; g++)
        if (h(u, g) <= o.getCapacity(g, d, n.MIXED))
          return g;
    }
    o.from = function(d, g) {
      return r.isValid(d) ? parseInt(d, 10) : g;
    }, o.getCapacity = function(d, g, m) {
      if (!r.isValid(d))
        throw new Error("Invalid QR Code version");
      typeof m > "u" && (m = n.BYTE);
      const E = t.getSymbolTotalCodewords(d), C = e.getTotalCodewordsCount(d, g), R = (E - C) * 8;
      if (m === n.MIXED) return R;
      const M = R - l(m, d);
      switch (m) {
        case n.NUMERIC:
          return Math.floor(M / 10 * 3);
        case n.ALPHANUMERIC:
          return Math.floor(M / 11 * 2);
        case n.KANJI:
          return Math.floor(M / 13);
        case n.BYTE:
        default:
          return Math.floor(M / 8);
      }
    }, o.getBestVersionForData = function(d, g) {
      let m;
      const E = i.from(g, i.M);
      if (Array.isArray(d)) {
        if (d.length > 1)
          return f(d, E);
        if (d.length === 0)
          return 1;
        m = d[0];
      } else
        m = d;
      return c(m.mode, m.getLength(), E);
    }, o.getEncodedBits = function(d) {
      if (!r.isValid(d) || d < 7)
        throw new Error("Invalid QR Code version");
      let g = d << 12;
      for (; t.getBCHDigit(g) - a >= 0; )
        g ^= s << t.getBCHDigit(g) - a;
      return d << 12 | g;
    };
  }(ft)), ft;
}
var mt = {}, Vt;
function Ee() {
  if (Vt) return mt;
  Vt = 1;
  const o = z(), t = 1335, e = 21522, i = o.getBCHDigit(t);
  return mt.getEncodedBits = function(r, s) {
    const a = r.bit << 3 | s;
    let c = a << 10;
    for (; o.getBCHDigit(c) - i >= 0; )
      c ^= t << o.getBCHDigit(c) - i;
    return (a << 10 | c) ^ e;
  }, mt;
}
var pt = {}, yt, Ht;
function Te() {
  if (Ht) return yt;
  Ht = 1;
  const o = Y();
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
    let n, r, s;
    for (n = 0; n + 3 <= this.data.length; n += 3)
      r = this.data.substr(n, 3), s = parseInt(r, 10), i.put(s, 10);
    const a = this.data.length - n;
    a > 0 && (r = this.data.substr(n), s = parseInt(r, 10), i.put(s, a * 3 + 1));
  }, yt = t, yt;
}
var St, jt;
function xe() {
  if (jt) return St;
  jt = 1;
  const o = Y(), t = [
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
      let s = t.indexOf(this.data[r]) * 45;
      s += t.indexOf(this.data[r + 1]), n.put(s, 11);
    }
    this.data.length % 2 && n.put(t.indexOf(this.data[r]), 6);
  }, St = e, St;
}
var Ct, Jt;
function Ie() {
  if (Jt) return Ct;
  Jt = 1;
  const o = Y();
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
  }, Ct = t, Ct;
}
var wt, Kt;
function ke() {
  if (Kt) return wt;
  Kt = 1;
  const o = Y(), t = z();
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
  }, wt = e, wt;
}
var vt = { exports: {} }, Xt;
function Re() {
  return Xt || (Xt = 1, function(o) {
    var t = {
      single_source_shortest_paths: function(e, i, n) {
        var r = {}, s = {};
        s[i] = 0;
        var a = t.PriorityQueue.make();
        a.push(i, 0);
        for (var c, l, h, f, u, d, g, m, E; !a.empty(); ) {
          c = a.pop(), l = c.value, f = c.cost, u = e[l] || {};
          for (h in u)
            u.hasOwnProperty(h) && (d = u[h], g = f + d, m = s[h], E = typeof s[h] > "u", (E || m > g) && (s[h] = g, a.push(h, g), r[h] = l));
        }
        if (typeof n < "u" && typeof s[n] > "u") {
          var C = ["Could not find a path from ", i, " to ", n, "."].join("");
          throw new Error(C);
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
  }(vt)), vt.exports;
}
var Qt;
function Ae() {
  return Qt || (Qt = 1, function(o) {
    const t = Y(), e = Te(), i = xe(), n = Ie(), r = ke(), s = ae(), a = z(), c = Re();
    function l(C) {
      return unescape(encodeURIComponent(C)).length;
    }
    function h(C, R, M) {
      const T = [];
      let B;
      for (; (B = C.exec(M)) !== null; )
        T.push({
          data: B[0],
          index: B.index,
          mode: R,
          length: B[0].length
        });
      return T;
    }
    function f(C) {
      const R = h(s.NUMERIC, t.NUMERIC, C), M = h(s.ALPHANUMERIC, t.ALPHANUMERIC, C);
      let T, B;
      return a.isKanjiModeEnabled() ? (T = h(s.BYTE, t.BYTE, C), B = h(s.KANJI, t.KANJI, C)) : (T = h(s.BYTE_KANJI, t.BYTE, C), B = []), R.concat(M, T, B).sort(function(x, b) {
        return x.index - b.index;
      }).map(function(x) {
        return {
          data: x.data,
          mode: x.mode,
          length: x.length
        };
      });
    }
    function u(C, R) {
      switch (R) {
        case t.NUMERIC:
          return e.getBitsLength(C);
        case t.ALPHANUMERIC:
          return i.getBitsLength(C);
        case t.KANJI:
          return r.getBitsLength(C);
        case t.BYTE:
          return n.getBitsLength(C);
      }
    }
    function d(C) {
      return C.reduce(function(R, M) {
        const T = R.length - 1 >= 0 ? R[R.length - 1] : null;
        return T && T.mode === M.mode ? (R[R.length - 1].data += M.data, R) : (R.push(M), R);
      }, []);
    }
    function g(C) {
      const R = [];
      for (let M = 0; M < C.length; M++) {
        const T = C[M];
        switch (T.mode) {
          case t.NUMERIC:
            R.push([
              T,
              { data: T.data, mode: t.ALPHANUMERIC, length: T.length },
              { data: T.data, mode: t.BYTE, length: T.length }
            ]);
            break;
          case t.ALPHANUMERIC:
            R.push([
              T,
              { data: T.data, mode: t.BYTE, length: T.length }
            ]);
            break;
          case t.KANJI:
            R.push([
              T,
              { data: T.data, mode: t.BYTE, length: l(T.data) }
            ]);
            break;
          case t.BYTE:
            R.push([
              { data: T.data, mode: t.BYTE, length: l(T.data) }
            ]);
        }
      }
      return R;
    }
    function m(C, R) {
      const M = {}, T = { start: {} };
      let B = ["start"];
      for (let S = 0; S < C.length; S++) {
        const x = C[S], b = [];
        for (let y = 0; y < x.length; y++) {
          const k = x[y], w = "" + S + y;
          b.push(w), M[w] = { node: k, lastCount: 0 }, T[w] = {};
          for (let I = 0; I < B.length; I++) {
            const v = B[I];
            M[v] && M[v].node.mode === k.mode ? (T[v][w] = u(M[v].lastCount + k.length, k.mode) - u(M[v].lastCount, k.mode), M[v].lastCount += k.length) : (M[v] && (M[v].lastCount = k.length), T[v][w] = u(k.length, k.mode) + 4 + t.getCharCountIndicator(k.mode, R));
          }
        }
        B = b;
      }
      for (let S = 0; S < B.length; S++)
        T[B[S]].end = 0;
      return { map: T, table: M };
    }
    function E(C, R) {
      let M;
      const T = t.getBestModeForData(C);
      if (M = t.from(R, T), M !== t.BYTE && M.bit < T.bit)
        throw new Error('"' + C + '" cannot be encoded with mode ' + t.toString(M) + `.
 Suggested mode is: ` + t.toString(T));
      switch (M === t.KANJI && !a.isKanjiModeEnabled() && (M = t.BYTE), M) {
        case t.NUMERIC:
          return new e(C);
        case t.ALPHANUMERIC:
          return new i(C);
        case t.KANJI:
          return new r(C);
        case t.BYTE:
          return new n(C);
      }
    }
    o.fromArray = function(R) {
      return R.reduce(function(M, T) {
        return typeof T == "string" ? M.push(E(T, null)) : T.data && M.push(E(T.data, T.mode)), M;
      }, []);
    }, o.fromString = function(R, M) {
      const T = f(R, a.isKanjiModeEnabled()), B = g(T), S = m(B, M), x = c.find_path(S.map, "start", "end"), b = [];
      for (let y = 1; y < x.length - 1; y++)
        b.push(S.table[x[y]].node);
      return o.fromArray(d(b));
    }, o.rawSplit = function(R) {
      return o.fromArray(
        f(R, a.isKanjiModeEnabled())
      );
    };
  }(pt)), pt;
}
var Wt;
function Be() {
  if (Wt) return it;
  Wt = 1;
  const o = z(), t = Tt(), e = me(), i = pe(), n = ye(), r = Se(), s = Ce(), a = oe(), c = Me(), l = be(), h = Ee(), f = Y(), u = Ae();
  function d(S, x) {
    const b = S.size, y = r.getPositions(x);
    for (let k = 0; k < y.length; k++) {
      const w = y[k][0], I = y[k][1];
      for (let v = -1; v <= 7; v++)
        if (!(w + v <= -1 || b <= w + v))
          for (let A = -1; A <= 7; A++)
            I + A <= -1 || b <= I + A || (v >= 0 && v <= 6 && (A === 0 || A === 6) || A >= 0 && A <= 6 && (v === 0 || v === 6) || v >= 2 && v <= 4 && A >= 2 && A <= 4 ? S.set(w + v, I + A, !0, !0) : S.set(w + v, I + A, !1, !0));
    }
  }
  function g(S) {
    const x = S.size;
    for (let b = 8; b < x - 8; b++) {
      const y = b % 2 === 0;
      S.set(b, 6, y, !0), S.set(6, b, y, !0);
    }
  }
  function m(S, x) {
    const b = n.getPositions(x);
    for (let y = 0; y < b.length; y++) {
      const k = b[y][0], w = b[y][1];
      for (let I = -2; I <= 2; I++)
        for (let v = -2; v <= 2; v++)
          I === -2 || I === 2 || v === -2 || v === 2 || I === 0 && v === 0 ? S.set(k + I, w + v, !0, !0) : S.set(k + I, w + v, !1, !0);
    }
  }
  function E(S, x) {
    const b = S.size, y = l.getEncodedBits(x);
    let k, w, I;
    for (let v = 0; v < 18; v++)
      k = Math.floor(v / 3), w = v % 3 + b - 8 - 3, I = (y >> v & 1) === 1, S.set(k, w, I, !0), S.set(w, k, I, !0);
  }
  function C(S, x, b) {
    const y = S.size, k = h.getEncodedBits(x, b);
    let w, I;
    for (w = 0; w < 15; w++)
      I = (k >> w & 1) === 1, w < 6 ? S.set(w, 8, I, !0) : w < 8 ? S.set(w + 1, 8, I, !0) : S.set(y - 15 + w, 8, I, !0), w < 8 ? S.set(8, y - w - 1, I, !0) : w < 9 ? S.set(8, 15 - w - 1 + 1, I, !0) : S.set(8, 15 - w - 1, I, !0);
    S.set(y - 8, 8, 1, !0);
  }
  function R(S, x) {
    const b = S.size;
    let y = -1, k = b - 1, w = 7, I = 0;
    for (let v = b - 1; v > 0; v -= 2)
      for (v === 6 && v--; ; ) {
        for (let A = 0; A < 2; A++)
          if (!S.isReserved(k, v - A)) {
            let L = !1;
            I < x.length && (L = (x[I] >>> w & 1) === 1), S.set(k, v - A, L), w--, w === -1 && (I++, w = 7);
          }
        if (k += y, k < 0 || b <= k) {
          k -= y, y = -y;
          break;
        }
      }
  }
  function M(S, x, b) {
    const y = new e();
    b.forEach(function(A) {
      y.put(A.mode.bit, 4), y.put(A.getLength(), f.getCharCountIndicator(A.mode, S)), A.write(y);
    });
    const k = o.getSymbolTotalCodewords(S), w = a.getTotalCodewordsCount(S, x), I = (k - w) * 8;
    for (y.getLengthInBits() + 4 <= I && y.put(0, 4); y.getLengthInBits() % 8 !== 0; )
      y.putBit(0);
    const v = (I - y.getLengthInBits()) / 8;
    for (let A = 0; A < v; A++)
      y.put(A % 2 ? 17 : 236, 8);
    return T(y, S, x);
  }
  function T(S, x, b) {
    const y = o.getSymbolTotalCodewords(x), k = a.getTotalCodewordsCount(x, b), w = y - k, I = a.getBlocksCount(x, b), v = y % I, A = I - v, L = Math.floor(y / I), F = Math.floor(w / I), xt = F + 1, J = L - F, Q = new c(J);
    let _ = 0;
    const G = new Array(I), V = new Array(I);
    let H = 0;
    const W = new Uint8Array(S.buffer);
    for (let q = 0; q < I; q++) {
      const tt = q < A ? F : xt;
      G[q] = W.slice(_, _ + tt), V[q] = Q.encode(G[q]), _ += tt, H = Math.max(H, tt);
    }
    const K = new Uint8Array(y);
    let O = 0, N, P;
    for (N = 0; N < H; N++)
      for (P = 0; P < I; P++)
        N < G[P].length && (K[O++] = G[P][N]);
    for (N = 0; N < J; N++)
      for (P = 0; P < I; P++)
        K[O++] = V[P][N];
    return K;
  }
  function B(S, x, b, y) {
    let k;
    if (Array.isArray(S))
      k = u.fromArray(S);
    else if (typeof S == "string") {
      let L = x;
      if (!L) {
        const F = u.rawSplit(S);
        L = l.getBestVersionForData(F, b);
      }
      k = u.fromString(S, L || 40);
    } else
      throw new Error("Invalid data");
    const w = l.getBestVersionForData(k, b);
    if (!w)
      throw new Error("The amount of data is too big to be stored in a QR Code");
    if (!x)
      x = w;
    else if (x < w)
      throw new Error(
        `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ` + w + `.
`
      );
    const I = M(x, b, k), v = o.getSymbolSize(x), A = new i(v);
    return d(A, x), g(A), m(A, x), C(A, b, 0), x >= 7 && E(A, x), R(A, I), isNaN(y) && (y = s.getBestMask(
      A,
      C.bind(null, A, b)
    )), s.applyMask(y, A), C(A, b, y), {
      modules: A,
      version: x,
      errorCorrectionLevel: b,
      maskPattern: y,
      segments: k
    };
  }
  return it.create = function(x, b) {
    if (typeof x > "u" || x === "")
      throw new Error("No input text");
    let y = t.M, k, w;
    return typeof b < "u" && (y = t.from(b.errorCorrectionLevel, t.M), k = l.from(b.version), w = s.from(b.maskPattern), b.toSJISFunc && o.setToSJISFunction(b.toSJISFunc)), B(x, k, y, w);
  }, it;
}
var Mt = {}, bt = {}, Zt;
function ce() {
  return Zt || (Zt = 1, function(o) {
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
      const n = typeof i.margin > "u" || i.margin === null || i.margin < 0 ? 4 : i.margin, r = i.width && i.width >= 21 ? i.width : void 0, s = i.scale || 4;
      return {
        width: r,
        scale: r ? 4 : s,
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
      const s = n.modules.size, a = n.modules.data, c = o.getScale(s, r), l = Math.floor((s + r.margin * 2) * c), h = r.margin * c, f = [r.color.light, r.color.dark];
      for (let u = 0; u < l; u++)
        for (let d = 0; d < l; d++) {
          let g = (u * l + d) * 4, m = r.color.light;
          if (u >= h && d >= h && u < l - h && d < l - h) {
            const E = Math.floor((u - h) / c), C = Math.floor((d - h) / c);
            m = f[a[E * s + C] ? 1 : 0];
          }
          i[g++] = m.r, i[g++] = m.g, i[g++] = m.b, i[g] = m.a;
        }
    };
  }(bt)), bt;
}
var te;
function Ne() {
  return te || (te = 1, function(o) {
    const t = ce();
    function e(n, r, s) {
      n.clearRect(0, 0, r.width, r.height), r.style || (r.style = {}), r.height = s, r.width = s, r.style.height = s + "px", r.style.width = s + "px";
    }
    function i() {
      try {
        return document.createElement("canvas");
      } catch {
        throw new Error("You need to specify a canvas element");
      }
    }
    o.render = function(r, s, a) {
      let c = a, l = s;
      typeof c > "u" && (!s || !s.getContext) && (c = s, s = void 0), s || (l = i()), c = t.getOptions(c);
      const h = t.getImageWidth(r.modules.size, c), f = l.getContext("2d"), u = f.createImageData(h, h);
      return t.qrToImageData(u.data, r, c), e(f, l, h), f.putImageData(u, 0, 0), l;
    }, o.renderToDataURL = function(r, s, a) {
      let c = a;
      typeof c > "u" && (!s || !s.getContext) && (c = s, s = void 0), c || (c = {});
      const l = o.render(r, s, c), h = c.type || "image/png", f = c.rendererOpts || {};
      return l.toDataURL(h, f.quality);
    };
  }(Mt)), Mt;
}
var Et = {}, ee;
function Pe() {
  if (ee) return Et;
  ee = 1;
  const o = ce();
  function t(n, r) {
    const s = n.a / 255, a = r + '="' + n.hex + '"';
    return s < 1 ? a + " " + r + '-opacity="' + s.toFixed(2).slice(1) + '"' : a;
  }
  function e(n, r, s) {
    let a = n + r;
    return typeof s < "u" && (a += " " + s), a;
  }
  function i(n, r, s) {
    let a = "", c = 0, l = !1, h = 0;
    for (let f = 0; f < n.length; f++) {
      const u = Math.floor(f % r), d = Math.floor(f / r);
      !u && !l && (l = !0), n[f] ? (h++, f > 0 && u > 0 && n[f - 1] || (a += l ? e("M", u + s, 0.5 + d + s) : e("m", c, 0), c = 0, l = !1), u + 1 < r && n[f + 1] || (a += e("h", h), h = 0)) : c++;
    }
    return a;
  }
  return Et.render = function(r, s, a) {
    const c = o.getOptions(s), l = r.modules.size, h = r.modules.data, f = l + c.margin * 2, u = c.color.light.a ? "<path " + t(c.color.light, "fill") + ' d="M0 0h' + f + "v" + f + 'H0z"/>' : "", d = "<path " + t(c.color.dark, "stroke") + ' d="' + i(h, l, c.margin) + '"/>', g = 'viewBox="0 0 ' + f + " " + f + '"', E = '<svg xmlns="http://www.w3.org/2000/svg" ' + (c.width ? 'width="' + c.width + '" height="' + c.width + '" ' : "") + g + ' shape-rendering="crispEdges">' + u + d + `</svg>
`;
    return typeof a == "function" && a(null, E), E;
  }, Et;
}
var ne;
function Le() {
  if (ne) return j;
  ne = 1;
  const o = ge(), t = Be(), e = Ne(), i = Pe();
  function n(r, s, a, c, l) {
    const h = [].slice.call(arguments, 1), f = h.length, u = typeof h[f - 1] == "function";
    if (!u && !o())
      throw new Error("Callback required as last argument");
    if (u) {
      if (f < 2)
        throw new Error("Too few arguments provided");
      f === 2 ? (l = a, a = s, s = c = void 0) : f === 3 && (s.getContext && typeof l > "u" ? (l = c, c = void 0) : (l = c, c = a, a = s, s = void 0));
    } else {
      if (f < 1)
        throw new Error("Too few arguments provided");
      return f === 1 ? (a = s, s = c = void 0) : f === 2 && !s.getContext && (c = a, a = s, s = void 0), new Promise(function(d, g) {
        try {
          const m = t.create(a, c);
          d(r(m, s, c));
        } catch (m) {
          g(m);
        }
      });
    }
    try {
      const d = t.create(a, c);
      l(null, r(d, s, c));
    } catch (d) {
      l(d);
    }
  }
  return j.create = t.create, j.toCanvas = n.bind(null, e.render), j.toDataURL = n.bind(null, e.renderToDataURL), j.toString = n.bind(null, function(r, s, a) {
    return i.render(r, a);
  }), j;
}
var Fe = Le();
const De = /* @__PURE__ */ he(Fe);
function qe(o, t) {
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
function Ue(o, t, e) {
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
async function _e(o, t) {
  return De.toDataURL(o, {
    errorCorrectionLevel: "M",
    margin: 4,
    color: {
      dark: "#0a0d14",
      light: "#ffffff"
    },
    width: t
  });
}
function Oe(o) {
  if (o.length === 0)
    return { peopleSide: "left", contentSide: "right" };
  const e = o.reduce((n, r) => n + r.x, 0) / o.length < 0.5 ? "left" : "right";
  return { peopleSide: e, contentSide: e === "left" ? "right" : "left" };
}
function $e(o, t, e, i, n, r = 0.03) {
  const s = Math.round(i * r), a = e + s, c = n - e - s, l = e + s, h = i - e - s, f = Math.max(l, Math.min(h, o)), u = Math.max(a, Math.min(c, t));
  return { cx: f, cy: u };
}
function ie(o, t, e, i, n, r, s = 0.03) {
  const a = Math.round(n * s), c = e + a, l = r - e - a, h = Math.max(c, Math.min(l, t));
  let f, u;
  return i === "left" ? (f = e + a, u = n / 2 - e - a) : (f = n / 2 + e + a, u = n - e - a), f > u ? { cx: i === "left" ? n * 0.25 : n * 0.75, cy: h } : { cx: Math.max(f, Math.min(u, o)), cy: h };
}
function ze(o, t, e, i, n = !1, r = 4) {
  const s = o.map((c) => ({ ...c })), a = typeof n == "number" ? Math.max(0, Math.min(1, n)) : n ? 1 : 0;
  for (let c = 0; c < r; c++) {
    for (let l = 0; l < s.length; l++)
      for (let h = l + 1; h < s.length; h++) {
        const f = s[l], u = s[h], d = u.cx - f.cx, g = u.cy - f.cy, m = Math.hypot(d, g) || 1, E = f.radius + u.radius;
        if (m < E) {
          const C = (E - m) / 2, R = d / m, M = g / m;
          f.cx -= R * C, f.cy -= M * C, u.cx += R * C, u.cy += M * C;
        }
      }
    for (const l of s) {
      const h = $e(l.cx, l.cy, l.radius, e, i);
      if (a <= 0)
        l.cx = h.cx, l.cy = h.cy;
      else if (a >= 1) {
        const f = ie(
          l.cx,
          l.cy,
          l.radius,
          t,
          e,
          i
        );
        l.cx = f.cx, l.cy = f.cy;
      } else {
        const f = ie(
          l.cx,
          l.cy,
          l.radius,
          t,
          e,
          i
        );
        l.cx = (1 - a) * h.cx + a * f.cx, l.cy = (1 - a) * h.cy + a * f.cy;
      }
    }
  }
  return s;
}
class Ye {
  constructor() {
    p(this, "enabled", !1);
    p(this, "activeFaceId", 1);
    p(this, "faces", /* @__PURE__ */ new Map());
    p(this, "indicator", null);
    p(this, "listenersAttached", !1);
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
      const s = document.createElement("canvas");
      s.width = 320, s.height = 320;
      const a = s.getContext("2d");
      if (a) {
        const c = a.createLinearGradient(0, 0, 320, 320);
        c.addColorStop(0, "#334155"), c.addColorStop(1, "#1e293b"), a.fillStyle = c, a.fillRect(0, 0, 320, 320), a.fillStyle = t % 2 === 0 ? "#0284c7" : "#059669", a.beginPath(), a.ellipse(160, 330, 110, 80, 0, 0, Math.PI * 2), a.fill(), a.fillStyle = "#fbcfe8", a.fillRect(140, 200, 40, 60), a.fillStyle = t % 2 === 0 ? "#fed7aa" : "#fcd34d", a.beginPath(), a.ellipse(160, 150, 65, 80, 0, 0, Math.PI * 2), a.fill(), a.fillStyle = t % 2 === 0 ? "#3b2f2f" : "#1e1e1e", a.beginPath(), a.ellipse(160, 110, 70, 50, 0, 0, Math.PI * 2), a.fill(), a.fillStyle = "#1e293b", a.beginPath(), a.arc(140, 145, 6, 0, Math.PI * 2), a.arc(180, 145, 6, 0, Math.PI * 2), a.fill(), a.strokeStyle = "#be123c", a.lineWidth = 3, a.beginPath(), a.arc(160, 175, 20, 0.2 * Math.PI, 0.8 * Math.PI), a.stroke(), r = s.toDataURL("image/jpeg", 0.85);
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
const re = [
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
    p(this, "lastType", null);
  }
  resolve(t) {
    let e = (t || "crossfade").toLowerCase().replace(/_/g, " ");
    if (e === "auto") {
      const n = re.filter((s) => s !== this.lastType), r = n[Math.floor(Math.random() * n.length)] || "crossfade";
      return this.lastType = r, r;
    }
    re.includes(e) || (e = "crossfade");
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
      const n = (1 - i) * 100, r = -i * 30, s = 1 - 0.4 * i;
      return {
        outgoing: {
          opacity: 1,
          transform: `translate3d(${r.toFixed(2)}%, 0, 0)`,
          filter: `brightness(${s.toFixed(3)})`
        },
        incoming: {
          opacity: 1,
          transform: `translate3d(${n.toFixed(2)}%, 0, 0)`
        }
      };
    }
    case "soft wipe": {
      const n = e * 115, s = `linear-gradient(to right, #000 0%, #000 ${Math.max(0, n - 15).toFixed(1)}%, transparent ${n.toFixed(1)}%)`;
      return {
        outgoing: {
          opacity: 1,
          transform: "none"
        },
        incoming: {
          opacity: 1,
          transform: "none",
          maskImage: s
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
  t.length === 3 && (t = t.split("").map((s) => s + s).join(""));
  const e = parseInt(t.slice(0, 2), 16) || 17, i = parseInt(t.slice(2, 4), 16) || 24, n = parseInt(t.slice(4, 6), 16) || 39;
  return (0.2126 * e + 0.7152 * i + 0.0722 * n) / 255 > 0.55 ? { text: "#0f172a", muted: "#475569" } : { text: "#f8fafc", muted: "#cbd5e1" };
}
function $(o) {
  return o < 0.5 ? 4 * o * o * o : 1 - Math.pow(-2 * o + 2, 3) / 2;
}
class Ke {
  constructor(t) {
    p(this, "root");
    p(this, "simulator", new Ye());
    p(this, "stateMachine", new ue());
    p(this, "blender", new fe(4));
    p(this, "transitionSelector", new Ve());
    p(this, "state", {});
    p(this, "activeFaces", []);
    p(this, "lockedPeopleSide", "left");
    p(this, "qrDataUrl", "");
    p(this, "lastGeneratedQrUrl", "");
    // Standby playlist state
    p(this, "mediaList", []);
    p(this, "currentMediaIndex", 0);
    p(this, "currentItemStartedMs", 0);
    p(this, "isTransitioning", !1);
    p(this, "transitionStartMs", 0);
    p(this, "activeTransitionType", "crossfade");
    p(this, "activeTransitionDuration", 900);
    p(this, "nextMediaPreloaded", !1);
    // Canvas elements
    p(this, "faceCanvas");
    p(this, "faceCtx");
    p(this, "irisCanvas");
    p(this, "irisCtx");
    // DOM containers
    p(this, "standbyContainer");
    p(this, "offerContainer");
    p(this, "setupContainer");
    p(this, "debugOverlay");
    p(this, "isDebugMode", !1);
    p(this, "fps", 0);
    p(this, "frameCount", 0);
    p(this, "lastFpsTime", 0);
    p(this, "pendingConfig", {});
    p(this, "activeConfig", {});
    p(this, "pendingMediaList", []);
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
    var h, f, u, d, g;
    this.state = t;
    const e = ((h = this.state.sync) == null ? void 0 : h.device_config) || {};
    this.pendingConfig = e, this.currentItemStartedMs || (this.activeConfig = { ...e });
    const i = Math.max(0.6, Math.min(2, Number(e.offerAnimationPace || 1))), n = Math.round(3400 * i), r = Math.round(900 * i);
    this.stateMachine.updateConfig({
      dwellSeconds: e.lookTime || 2.5,
      offerMinSeconds: 8,
      exitAfterNobodySeconds: 4,
      maxOfferSeconds: 22,
      cooldownSeconds: 6,
      triggeringDurationMs: n,
      exitingDurationMs: r
    });
    const s = ((f = this.state.sync) == null ? void 0 : f.media) || [], a = ((u = this.state.sync) == null ? void 0 : u.playlist) || [];
    a.length > 0 ? this.pendingMediaList = a.map((m) => s.find((E) => E.id === m)).filter(Boolean) : this.pendingMediaList = s, this.currentItemStartedMs || (this.mediaList = this.pendingMediaList);
    const c = (g = (d = this.state.sync) == null ? void 0 : d.pairing) != null && g.code ? "display" : this.state.device_id || "", l = qe(e.offerLink, c);
    if (l !== this.lastGeneratedQrUrl) {
      this.lastGeneratedQrUrl = l;
      const m = Ue(e.qrSize, window.innerWidth, window.innerHeight);
      _e(l, m).then((E) => {
        this.qrDataUrl = E;
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
      const n = this.simulator.enabled ? this.simulator.getFaces() : this.activeFaces, r = this.stateMachine.state, s = this.stateMachine.update(n, t);
      if (r === "STANDBY" && s === "TRIGGERING") {
        const a = Oe(n);
        this.lockedPeopleSide = a.peopleSide;
      }
      this.renderMedia(t), this.renderFaceBlending(n, t, s), this.renderTemplate(s, t);
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
    var l, h;
    if (this.mediaList.length === 0) {
      this.standbyContainer.dataset.loaded !== "brand" && (this.standbyContainer.dataset.loaded = "brand", this.standbyContainer.innerHTML = `
          <div class="standby-brand">
            <h1>${((l = this.state.sync) == null ? void 0 : l.display_name) || "AdSense"}</h1>
            <p>Smart Display</p>
          </div>
        `);
      return;
    }
    const e = ((h = this.state.sync) == null ? void 0 : h.device_config) || {}, i = (e.standbyDuration || 8) * 1e3;
    this.currentItemStartedMs || (this.currentItemStartedMs = t, this.renderActiveMediaSlot());
    const n = t - this.currentItemStartedMs, r = this.standbyContainer.querySelector(".media-slot.active"), s = r == null ? void 0 : r.querySelector("video"), a = !!(s && (s.ended || s.duration > 0 && s.currentTime >= s.duration - 0.2));
    if ((n >= i || a) && !this.isTransitioning && this.mediaList.length >= 1 && (this.isTransitioning = !0, this.transitionStartMs = t, this.activeTransitionType = this.transitionSelector.resolve(e.transition), this.activeTransitionDuration = Ge(e.transitionSpeed), this.prepareNextMediaSlot()), this.isTransitioning) {
      const f = t - this.transitionStartMs, u = Math.min(1, f / this.activeTransitionDuration), d = je(this.activeTransitionType, u), g = this.standbyContainer.querySelector(".media-slot.outgoing"), m = this.standbyContainer.querySelector(".media-slot.incoming");
      g && (g.style.opacity = String(d.outgoing.opacity), g.style.transform = d.outgoing.transform, d.outgoing.filter && (g.style.filter = d.outgoing.filter)), m && (m.style.opacity = String(d.incoming.opacity), m.style.transform = d.incoming.transform, d.incoming.filter && (m.style.filter = d.incoming.filter), d.incoming.maskImage ? (m.style.webkitMaskImage = d.incoming.maskImage, m.style.maskImage = d.incoming.maskImage) : (m.style.webkitMaskImage = "none", m.style.maskImage = "none")), u >= 1 && (this.isTransitioning = !1, this.currentMediaIndex = (this.currentMediaIndex + 1) % this.mediaList.length, this.currentItemStartedMs = t, this.finalizeMediaTransition());
    } else {
      const f = this.standbyContainer.querySelector(".media-slot.active");
      if (f && f.dataset.type === "image") {
        const u = Math.min(1, n / i), d = 1 + 0.08 * u, g = -1.5 + 3 * u, m = -0.75 + 1.5 * u;
        f.style.transform = `translate3d(${g.toFixed(2)}%, ${m.toFixed(2)}%, 0) scale(${d.toFixed(4)})`;
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
    var s;
    this.standbyContainer.querySelectorAll(".media-slot.incoming").forEach((a) => a.remove());
    const t = (this.currentMediaIndex + 1) % this.mediaList.length, e = this.mediaList[t];
    if (!e) return;
    const i = (s = e.content_type) == null ? void 0 : s.startsWith("video/"), n = this.standbyContainer.querySelector(".media-slot.active");
    n && (n.className = "media-slot outgoing");
    const r = document.createElement("div");
    if (r.className = "media-slot incoming", r.dataset.type = i ? "video" : "image", r.style.opacity = "0", i) {
      const a = document.createElement("video");
      a.src = e.local, a.autoplay = !0, a.muted = !0, a.playsInline = !0, a.currentTime = 0, a.play().catch(() => {
      }), r.appendChild(a);
    } else {
      const a = document.createElement("img");
      a.src = e.local, a.alt = "", r.appendChild(a);
    }
    this.standbyContainer.appendChild(r);
  }
  finalizeMediaTransition() {
    this.standbyContainer.querySelectorAll(".media-slot.outgoing").forEach((i) => i.remove());
    const e = this.standbyContainer.querySelector(".media-slot.incoming");
    e && (e.className = "media-slot active", e.style.opacity = "1", e.style.transform = "none", e.style.filter = "none", e.style.webkitMaskImage = "none", e.style.maskImage = "none"), this.activeConfig = { ...this.pendingConfig }, this.mediaList = this.pendingMediaList.length > 0 ? this.pendingMediaList : this.mediaList, this.preloadNextMedia();
  }
  renderFaceBlending(t, e, i) {
    var m;
    if (!this.faceCtx) return;
    const n = this.faceCanvas.width, r = this.faceCanvas.height;
    this.faceCtx.clearRect(0, 0, n, r);
    const s = ((m = this.state.sync) == null ? void 0 : m.device_config) || {};
    if (s.liveFaces === !1) return;
    this.blender.update(t, e, n, r);
    const a = this.blender.getActiveTracks();
    if (a.length === 0) return;
    let c = 0;
    const l = Math.max(0.6, Math.min(2, Number(s.offerAnimationPace || 1))), h = e - this.stateMachine.stateStartedMs, f = 1100 * l, u = 900 * l;
    if (i === "TRIGGERING")
      c = $(Math.min(1, h / f));
    else if (i === "OFFER")
      c = 1;
    else if (i === "EXITING") {
      const E = Math.min(1, h / u);
      c = Math.max(0, 1 - $(E));
    } else
      c = 0;
    const d = a.map((E) => ({
      id: E.id,
      cx: E.currentX,
      cy: E.currentY,
      radius: E.currentSize / 2
    })), g = ze(d, this.lockedPeopleSide, n, r, c);
    for (let E = 0; E < a.length; E++)
      a[E].currentX = g[E].cx, a[E].currentY = g[E].cy;
    this.blender.render(this.faceCtx, n, r);
  }
  renderTemplate(t, e) {
    var Q;
    const i = ((Q = this.state.sync) == null ? void 0 : Q.device_config) || {}, n = "#1c130e", r = "#f59e0b", s = i.offerBackground && i.offerBackground !== "#111827" && i.offerBackground !== "#0f172a" ? i.offerBackground : n, a = i.accentColor || r, c = Je(s), l = window.innerWidth, h = window.innerHeight;
    if (this.irisCtx && this.irisCtx.clearRect(0, 0, l, h), t === "STANDBY" || t === "COOLDOWN") {
      this.standbyContainer.style.filter = "none", this.standbyContainer.style.opacity = "1", this.offerContainer.style.display = "none", this.offerContainer.innerHTML = "";
      return;
    }
    this.offerContainer.style.display = "flex";
    const f = Math.max(0.6, Math.min(2, Number(i.offerAnimationPace || 1))), u = e - this.stateMachine.stateStartedMs, d = Math.round(900 * f);
    let g = 1, m = !1, E = 0, C = 1, R = 0, M = 0, T = 1, B = 0;
    if (t === "TRIGGERING") {
      const _ = 1100 * f, G = Math.min(1, u / _);
      g = $(G);
      const V = 1800 * f, H = 2400 * f;
      if (u < H) {
        m = !0;
        const O = 700 * f;
        if (u < O) {
          const N = u / O, P = $(N);
          E = P;
          const q = Math.sin(N * Math.PI) * 0.08;
          C = 0.85 + 0.15 * P + q, R = (1 - P) * 15;
        } else if (u >= V) {
          const N = (u - V) / (H - V), P = $(N);
          E = Math.max(0, 1 - P), C = 1 - 0.05 * P, R = -P * 24;
        } else
          E = 1, C = 1, R = 0;
      }
      const W = 2100 * f, K = 1200 * f;
      if (u >= W) {
        const O = Math.min(1, (u - W) / K), N = $(O);
        M = N, T = 0.94 + 0.06 * N, B = (1 - N) * 22;
      }
    } else if (t === "OFFER")
      g = 1, m = !1, M = 1, T = 1, B = 0;
    else if (t === "EXITING") {
      const _ = Math.min(1, u / d);
      g = Math.max(0, 1 - $(_)), m = !1, M = g, T = 0.96 + 0.04 * g, B = 0;
    }
    const S = (7 * g).toFixed(1), x = (1 - 0.22 * g).toFixed(2), b = (1 - 0.15 * g).toFixed(2);
    this.standbyContainer.style.filter = `blur(${S}px) brightness(${x})`, this.standbyContainer.style.opacity = b;
    const y = this.lockedPeopleSide === "left" ? "right" : "left", k = (1 - g) * 100, w = y === "right" ? `translate3d(${k.toFixed(2)}%, 0, 0)` : `translate3d(-${k.toFixed(2)}%, 0, 0)`, I = y === "right" ? `linear-gradient(to right, transparent 0%, rgba(28, 19, 14, 0.40) 10%, rgba(28, 19, 14, 0.88) 26%, ${s} 44%, ${s} 100%)` : `linear-gradient(to left, transparent 0%, rgba(28, 19, 14, 0.40) 10%, rgba(28, 19, 14, 0.88) 26%, ${s} 44%, ${s} 100%)`, v = i.greetingText || "Hei!", A = i.headline || "20% reducere", L = i.subtext || "Scanează codul QR cu telefonul", F = (i.caption || "").trim(), J = F.toLowerCase().includes("poza cu m") || F.toLowerCase().includes("aici poza") || F.toLowerCase().includes("mancare") ? "" : F;
    this.offerContainer.style.flexDirection = y === "right" ? "row" : "row-reverse", this.offerContainer.innerHTML = `
      <div class="offer-half media-half" style="flex: 1; height: 100%; pointer-events: none;"></div>
      <div class="offer-half content-half" style="
        flex: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 5vw;
        background: ${I};
        transform: ${w};
        opacity: ${g.toFixed(2)};
        color: ${c.text};
        will-change: transform, opacity;
        position: relative;
        overflow: hidden;
      ">
        ${m ? `<div class="greeting-box" style="
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0;
                padding: 0;
                opacity: ${E.toFixed(2)};
                transform: translate3d(0, ${R.toFixed(1)}px, 0) scale(${C.toFixed(3)});
                will-change: transform, opacity;
                pointer-events: none;
                z-index: 10;
              ">
                <span class="greeting-text" style="
                  font-size: clamp(5.8rem, 13vw, 11rem);
                  font-weight: 900;
                  letter-spacing: -0.04em;
                  color: ${a};
                  text-shadow: 0 16px 60px rgba(245, 158, 11, 0.40), 0 4px 16px rgba(0,0,0,0.4);
                  line-height: 1;
                  text-align: center;
                ">${v}</span>
              </div>` : ""}
        <div class="offer-card" style="
          background: transparent;
          max-width: 660px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          opacity: ${M.toFixed(2)};
          transform: translate3d(0, ${B.toFixed(1)}px, 0) scale(${T.toFixed(3)});
          will-change: transform, opacity;
        ">
          <h1 class="offer-headline" style="
            font-size: clamp(3rem, 6.2vw, 5.25rem);
            font-weight: 800;
            line-height: 1.08;
            letter-spacing: -0.03em;
            margin: 0;
            color: #fffbeb;
            text-shadow: 0 4px 20px rgba(0,0,0,0.5);
          ">${A}</h1>
          <p class="offer-subtext" style="
            font-size: clamp(1.4rem, 2.6vw, 2.25rem);
            line-height: 1.35;
            margin: 0;
            font-weight: 500;
            color: #e6d5c3;
          ">${L}</p>
          <div class="qr-wrapper" style="margin-top: 0.5rem;">
            <div class="qr-card" style="
              background: #ffffff;
              padding: clamp(18px, 2.5vw, 30px);
              border-radius: clamp(20px, 3vw, 32px);
              box-shadow: 0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(245, 158, 11, 0.25);
              display: inline-flex;
            ">
              ${this.qrDataUrl ? `<img src="${this.qrDataUrl}" alt="QR" class="qr-image" style="width: 100%; height: auto; aspect-ratio: 1;">` : ""}
            </div>
            ${J ? `<p class="qr-caption" style="color: ${c.muted}; margin-top: 0.5rem;">${J}</p>` : ""}
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
