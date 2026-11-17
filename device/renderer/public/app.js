var ce = Object.defineProperty;
var le = (s, e, n) => e in s ? ce(s, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : s[e] = n;
var m = (s, e, n) => le(s, typeof e != "symbol" ? e + "" : e, n);
class bt {
  constructor(e = {}) {
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
      dwellSeconds: e.dwellSeconds ?? 3,
      offerMinSeconds: e.offerMinSeconds ?? 20,
      exitAfterNobodySeconds: e.exitAfterNobodySeconds ?? 6,
      cooldownSeconds: e.cooldownSeconds ?? 8,
      lookingResetSeconds: e.lookingResetSeconds ?? 0.4,
      triggeringDurationMs: e.triggeringDurationMs ?? 1e3,
      exitingDurationMs: e.exitingDurationMs ?? 1e3,
      absentToRetriggerSeconds: e.absentToRetriggerSeconds ?? 3
    };
  }
  get isCooldownActive() {
    return this.state === "COOLDOWN";
  }
  get effectivePhase() {
    return this.state === "COOLDOWN" ? "STANDBY" : this.state;
  }
  forceTrigger(e, n = 1) {
    this.state = "TRIGGERING", this.stateStartedMs = e, this.offerStartedMs = e, this.lastFaceSeenMs = e, this.triggerFaceId = n, this.triggeredTrackIds.add(n);
  }
  update(e, n) {
    const i = /* @__PURE__ */ new Set();
    for (const t of e) {
      i.add(t.id);
      let r = this.tracks.get(t.id);
      r ? (r.lastSeenMs = n, t.looking ? (r.notLookingSinceMs !== void 0 ? (n - r.notLookingSinceMs > this.config.lookingResetSeconds * 1e3 && (r.lookingSinceMs = n), r.notLookingSinceMs = void 0) : r.lookingSinceMs === void 0 && (r.lookingSinceMs = n), r.isLooking = !0) : (r.isLooking = !1, r.notLookingSinceMs === void 0 ? r.notLookingSinceMs = n : n - r.notLookingSinceMs > this.config.lookingResetSeconds * 1e3 && (r.lookingSinceMs = void 0))) : (r = {
        id: t.id,
        firstSeenMs: n,
        lastSeenMs: n,
        isLooking: !!t.looking,
        lookingSinceMs: t.looking ? n : void 0
      }, this.tracks.set(t.id, r));
    }
    for (const [t, r] of this.tracks.entries())
      i.has(t) || (r.isLooking = !1, r.lookingSinceMs = void 0, r.notLookingSinceMs = void 0, n - r.lastSeenMs > this.config.absentToRetriggerSeconds * 1e3 && this.triggeredTrackIds.delete(t), n - r.lastSeenMs > 15e3 && this.tracks.delete(t));
    switch (e.length > 0 && (this.lastFaceSeenMs = n), this.state) {
      case "STANDBY": {
        for (const t of e) {
          const r = this.tracks.get(t.id);
          if (!(!r || this.triggeredTrackIds.has(t.id)) && r.lookingSinceMs !== void 0 && n - r.lookingSinceMs >= this.config.dwellSeconds * 1e3) {
            this.triggeredTrackIds.add(t.id), this.triggerFaceId = t.id, this.state = "TRIGGERING", this.stateStartedMs = n, this.offerStartedMs = n, this.lastFaceSeenMs = n;
            break;
          }
        }
        break;
      }
      case "TRIGGERING": {
        n - this.stateStartedMs >= this.config.triggeringDurationMs && (this.state = "OFFER", this.stateStartedMs = n);
        break;
      }
      case "OFFER": {
        const t = n - this.offerStartedMs >= this.config.offerMinSeconds * 1e3, r = this.lastFaceSeenMs === null || n - this.lastFaceSeenMs >= this.config.exitAfterNobodySeconds * 1e3;
        t && r && (this.state = "EXITING", this.stateStartedMs = n);
        break;
      }
      case "EXITING": {
        n - this.stateStartedMs >= this.config.exitingDurationMs && (this.state = "COOLDOWN", this.stateStartedMs = n, this.cooldownUntilMs = n + this.config.cooldownSeconds * 1e3);
        break;
      }
      case "COOLDOWN": {
        n >= this.cooldownUntilMs && (this.state = "STANDBY", this.stateStartedMs = n);
        break;
      }
    }
    return this.state;
  }
}
function Et(s, e) {
  const n = 1 / (2 * Math.PI * e), i = 1 / s;
  return 1 / (1 + n / i);
}
class Tt {
  constructor() {
    m(this, "y", null);
    m(this, "s", null);
  }
  filter(e, n) {
    return this.y === null ? (this.s = e, this.y = e, e) : (this.y = n * e + (1 - n) * this.s, this.s = this.y, this.y);
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
  constructor(e = 1, n = 7e-3, i = 1) {
    m(this, "minCutoff");
    m(this, "beta");
    m(this, "dCutoff");
    m(this, "xFilter", new Tt());
    m(this, "dxFilter", new Tt());
    m(this, "lastTime", null);
    this.minCutoff = e, this.beta = n, this.dCutoff = i;
  }
  filter(e, n) {
    if (this.lastTime === null)
      return this.lastTime = n, this.xFilter.filter(e, 1);
    const i = Math.max((n - this.lastTime) / 1e3, 1e-4);
    this.lastTime = n;
    const t = 1 / i, r = this.xFilter.hasLast() ? (e - this.xFilter.last()) * t : 0, a = this.dxFilter.filter(r, Et(t, this.dCutoff)), o = this.minCutoff + this.beta * Math.abs(a);
    return this.xFilter.filter(e, Et(t, o));
  }
  reset() {
    this.lastTime = null, this.xFilter.reset(), this.dxFilter.reset();
  }
}
class de {
  constructor(e = 4) {
    m(this, "tracks", /* @__PURE__ */ new Map());
    m(this, "maxPeople");
    m(this, "offscreenCanvas", null);
    m(this, "offscreenCtx", null);
    this.maxPeople = e;
  }
  getTrack(e) {
    return this.tracks.get(e);
  }
  getActiveTracks() {
    return Array.from(this.tracks.values()).filter((e) => e.alpha > 0);
  }
  update(e, n, i, t) {
    const r = /* @__PURE__ */ new Set(), a = e.slice(0, this.maxPeople), o = t * 0.18, c = t * 0.4;
    for (const l of a) {
      r.add(l.id);
      const d = (l.x + l.w / 2) * i, f = (l.y + l.h / 2 + 0.15 * l.h) * t, h = Math.max(o, Math.min(c, 2.4 * l.h * t));
      let u = this.tracks.get(l.id);
      if (u) {
        if (u.lastSeenMs = n, u.currentX = u.filterX.filter(d, n), u.currentY = u.filterY.filter(f, n), u.currentSize = u.filterSize.filter(h, n), l.crop_jpeg && l.crop_jpeg !== u.cropJpeg) {
          if (u.cropJpeg = l.crop_jpeg, u.image)
            u.image.src = l.crop_jpeg;
          else if (typeof Image < "u") {
            const C = new Image();
            C.src = l.crop_jpeg, u.image = C;
          }
        }
      } else {
        if (u = {
          id: l.id,
          filterX: new J(1, 7e-3),
          filterY: new J(1, 7e-3),
          filterSize: new J(1, 7e-3),
          currentX: d,
          currentY: f,
          currentSize: h,
          firstSeenMs: n,
          lastSeenMs: n,
          alpha: 0,
          scale: 0.85,
          cropJpeg: l.crop_jpeg
        }, u.filterX.filter(d, n), u.filterY.filter(f, n), u.filterSize.filter(h, n), typeof Image < "u" && l.crop_jpeg) {
          const C = new Image();
          C.src = l.crop_jpeg, u.image = C;
        }
        this.tracks.set(l.id, u);
      }
      const b = Math.min(1, Math.max(0, (n - u.firstSeenMs) / 250));
      u.alpha = b, u.scale = 0.85 + 0.15 * b;
    }
    for (const [l, d] of this.tracks.entries())
      if (!r.has(l)) {
        const f = n - d.lastSeenMs;
        if (f <= 600)
          d.alpha = 1, d.scale = 1;
        else if (f <= 900) {
          const h = (f - 600) / 300;
          d.alpha = Math.max(0, 1 - h), d.scale = Math.max(0.85, 1 - 0.15 * h);
        } else
          this.tracks.delete(l);
      }
    return this.getActiveTracks();
  }
  render(e, n, i) {
    if (!(typeof document > "u") && (this.offscreenCanvas || (this.offscreenCanvas = document.createElement("canvas"), this.offscreenCtx = this.offscreenCanvas.getContext("2d")), !(!this.offscreenCtx || !this.offscreenCanvas)))
      for (const t of this.getActiveTracks()) {
        const r = t.image;
        if (!r || !r.complete || r.naturalWidth === 0) continue;
        const a = Math.round(t.currentSize * t.scale);
        if (a <= 0) continue;
        (this.offscreenCanvas.width !== a || this.offscreenCanvas.height !== a) && (this.offscreenCanvas.width = a, this.offscreenCanvas.height = a);
        const o = this.offscreenCtx;
        o.clearRect(0, 0, a, a), o.globalCompositeOperation = "source-over", o.drawImage(r, 0, 0, a, a), o.globalCompositeOperation = "destination-in";
        const c = a / 2, l = o.createRadialGradient(c, c, 0, c, c, c);
        l.addColorStop(0, "rgba(0,0,0,1)"), l.addColorStop(0.55, "rgba(0,0,0,1)"), l.addColorStop(0.65, "rgba(0,0,0,0.93)"), l.addColorStop(0.75, "rgba(0,0,0,0.78)"), l.addColorStop(0.85, "rgba(0,0,0,0.50)"), l.addColorStop(0.93, "rgba(0,0,0,0.22)"), l.addColorStop(1, "rgba(0,0,0,0)"), o.fillStyle = l, o.fillRect(0, 0, a, a), e.save(), e.globalAlpha = t.alpha, e.drawImage(
          this.offscreenCanvas,
          Math.round(t.currentX - a / 2),
          Math.round(t.currentY - a / 2),
          a,
          a
        ), e.restore();
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
var Q = {}, D = {}, kt;
function q() {
  if (kt) return D;
  kt = 1;
  let s;
  const e = [
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
    return e[i];
  }, D.getBCHDigit = function(n) {
    let i = 0;
    for (; n !== 0; )
      i++, n >>>= 1;
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
var W = {}, At;
function St() {
  return At || (At = 1, function(s) {
    s.L = { bit: 1 }, s.M = { bit: 0 }, s.Q = { bit: 3 }, s.H = { bit: 2 };
    function e(n) {
      if (typeof n != "string")
        throw new Error("Param is not a string");
      switch (n.toLowerCase()) {
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
          throw new Error("Unknown EC Level: " + n);
      }
    }
    s.isValid = function(i) {
      return i && typeof i.bit < "u" && i.bit >= 0 && i.bit < 4;
    }, s.from = function(i, t) {
      if (s.isValid(i))
        return i;
      try {
        return e(i);
      } catch {
        return t;
      }
    };
  }(W)), W;
}
var Z, Bt;
function he() {
  if (Bt) return Z;
  Bt = 1;
  function s() {
    this.buffer = [], this.length = 0;
  }
  return s.prototype = {
    get: function(e) {
      const n = Math.floor(e / 8);
      return (this.buffer[n] >>> 7 - e % 8 & 1) === 1;
    },
    put: function(e, n) {
      for (let i = 0; i < n; i++)
        this.putBit((e >>> n - i - 1 & 1) === 1);
    },
    getLengthInBits: function() {
      return this.length;
    },
    putBit: function(e) {
      const n = Math.floor(this.length / 8);
      this.buffer.length <= n && this.buffer.push(0), e && (this.buffer[n] |= 128 >>> this.length % 8), this.length++;
    }
  }, Z = s, Z;
}
var tt, Rt;
function ge() {
  if (Rt) return tt;
  Rt = 1;
  function s(e) {
    if (!e || e < 1)
      throw new Error("BitMatrix size must be defined and greater than 0");
    this.size = e, this.data = new Uint8Array(e * e), this.reservedBit = new Uint8Array(e * e);
  }
  return s.prototype.set = function(e, n, i, t) {
    const r = e * this.size + n;
    this.data[r] = i, t && (this.reservedBit[r] = !0);
  }, s.prototype.get = function(e, n) {
    return this.data[e * this.size + n];
  }, s.prototype.xor = function(e, n, i) {
    this.data[e * this.size + n] ^= i;
  }, s.prototype.isReserved = function(e, n) {
    return this.reservedBit[e * this.size + n];
  }, tt = s, tt;
}
var et = {}, Pt;
function me() {
  return Pt || (Pt = 1, function(s) {
    const e = q().getSymbolSize;
    s.getRowColCoords = function(i) {
      if (i === 1) return [];
      const t = Math.floor(i / 7) + 2, r = e(i), a = r === 145 ? 26 : Math.ceil((r - 13) / (2 * t - 2)) * 2, o = [r - 7];
      for (let c = 1; c < t - 1; c++)
        o[c] = o[c - 1] - a;
      return o.push(6), o.reverse();
    }, s.getPositions = function(i) {
      const t = [], r = s.getRowColCoords(i), a = r.length;
      for (let o = 0; o < a; o++)
        for (let c = 0; c < a; c++)
          o === 0 && c === 0 || // top-left
          o === 0 && c === a - 1 || // bottom-left
          o === a - 1 && c === 0 || t.push([r[o], r[c]]);
      return t;
    };
  }(et)), et;
}
var nt = {}, Nt;
function pe() {
  if (Nt) return nt;
  Nt = 1;
  const s = q().getSymbolSize, e = 7;
  return nt.getPositions = function(i) {
    const t = s(i);
    return [
      // top-left
      [0, 0],
      // top-right
      [t - e, 0],
      // bottom-left
      [0, t - e]
    ];
  }, nt;
}
var it = {}, Lt;
function ye() {
  return Lt || (Lt = 1, function(s) {
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
    const e = {
      N1: 3,
      N2: 3,
      N3: 40,
      N4: 10
    };
    s.isValid = function(t) {
      return t != null && t !== "" && !isNaN(t) && t >= 0 && t <= 7;
    }, s.from = function(t) {
      return s.isValid(t) ? parseInt(t, 10) : void 0;
    }, s.getPenaltyN1 = function(t) {
      const r = t.size;
      let a = 0, o = 0, c = 0, l = null, d = null;
      for (let f = 0; f < r; f++) {
        o = c = 0, l = d = null;
        for (let h = 0; h < r; h++) {
          let u = t.get(f, h);
          u === l ? o++ : (o >= 5 && (a += e.N1 + (o - 5)), l = u, o = 1), u = t.get(h, f), u === d ? c++ : (c >= 5 && (a += e.N1 + (c - 5)), d = u, c = 1);
        }
        o >= 5 && (a += e.N1 + (o - 5)), c >= 5 && (a += e.N1 + (c - 5));
      }
      return a;
    }, s.getPenaltyN2 = function(t) {
      const r = t.size;
      let a = 0;
      for (let o = 0; o < r - 1; o++)
        for (let c = 0; c < r - 1; c++) {
          const l = t.get(o, c) + t.get(o, c + 1) + t.get(o + 1, c) + t.get(o + 1, c + 1);
          (l === 4 || l === 0) && a++;
        }
      return a * e.N2;
    }, s.getPenaltyN3 = function(t) {
      const r = t.size;
      let a = 0, o = 0, c = 0;
      for (let l = 0; l < r; l++) {
        o = c = 0;
        for (let d = 0; d < r; d++)
          o = o << 1 & 2047 | t.get(l, d), d >= 10 && (o === 1488 || o === 93) && a++, c = c << 1 & 2047 | t.get(d, l), d >= 10 && (c === 1488 || c === 93) && a++;
      }
      return a * e.N3;
    }, s.getPenaltyN4 = function(t) {
      let r = 0;
      const a = t.data.length;
      for (let c = 0; c < a; c++) r += t.data[c];
      return Math.abs(Math.ceil(r * 100 / a / 5) - 10) * e.N4;
    };
    function n(i, t, r) {
      switch (i) {
        case s.Patterns.PATTERN000:
          return (t + r) % 2 === 0;
        case s.Patterns.PATTERN001:
          return t % 2 === 0;
        case s.Patterns.PATTERN010:
          return r % 3 === 0;
        case s.Patterns.PATTERN011:
          return (t + r) % 3 === 0;
        case s.Patterns.PATTERN100:
          return (Math.floor(t / 2) + Math.floor(r / 3)) % 2 === 0;
        case s.Patterns.PATTERN101:
          return t * r % 2 + t * r % 3 === 0;
        case s.Patterns.PATTERN110:
          return (t * r % 2 + t * r % 3) % 2 === 0;
        case s.Patterns.PATTERN111:
          return (t * r % 3 + (t + r) % 2) % 2 === 0;
        default:
          throw new Error("bad maskPattern:" + i);
      }
    }
    s.applyMask = function(t, r) {
      const a = r.size;
      for (let o = 0; o < a; o++)
        for (let c = 0; c < a; c++)
          r.isReserved(c, o) || r.xor(c, o, n(t, c, o));
    }, s.getBestMask = function(t, r) {
      const a = Object.keys(s.Patterns).length;
      let o = 0, c = 1 / 0;
      for (let l = 0; l < a; l++) {
        r(l), s.applyMask(l, t);
        const d = s.getPenaltyN1(t) + s.getPenaltyN2(t) + s.getPenaltyN3(t) + s.getPenaltyN4(t);
        s.applyMask(l, t), d < c && (c = d, o = l);
      }
      return o;
    };
  }(it)), it;
}
var H = {}, xt;
function ee() {
  if (xt) return H;
  xt = 1;
  const s = St(), e = [
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
  ], n = [
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
  return H.getBlocksCount = function(t, r) {
    switch (r) {
      case s.L:
        return e[(t - 1) * 4 + 0];
      case s.M:
        return e[(t - 1) * 4 + 1];
      case s.Q:
        return e[(t - 1) * 4 + 2];
      case s.H:
        return e[(t - 1) * 4 + 3];
      default:
        return;
    }
  }, H.getTotalCodewordsCount = function(t, r) {
    switch (r) {
      case s.L:
        return n[(t - 1) * 4 + 0];
      case s.M:
        return n[(t - 1) * 4 + 1];
      case s.Q:
        return n[(t - 1) * 4 + 2];
      case s.H:
        return n[(t - 1) * 4 + 3];
      default:
        return;
    }
  }, H;
}
var rt = {}, $ = {}, Ft;
function Ce() {
  if (Ft) return $;
  Ft = 1;
  const s = new Uint8Array(512), e = new Uint8Array(256);
  return function() {
    let i = 1;
    for (let t = 0; t < 255; t++)
      s[t] = i, e[i] = t, i <<= 1, i & 256 && (i ^= 285);
    for (let t = 255; t < 512; t++)
      s[t] = s[t - 255];
  }(), $.log = function(i) {
    if (i < 1) throw new Error("log(" + i + ")");
    return e[i];
  }, $.exp = function(i) {
    return s[i];
  }, $.mul = function(i, t) {
    return i === 0 || t === 0 ? 0 : s[e[i] + e[t]];
  }, $;
}
var Dt;
function Se() {
  return Dt || (Dt = 1, function(s) {
    const e = Ce();
    s.mul = function(i, t) {
      const r = new Uint8Array(i.length + t.length - 1);
      for (let a = 0; a < i.length; a++)
        for (let o = 0; o < t.length; o++)
          r[a + o] ^= e.mul(i[a], t[o]);
      return r;
    }, s.mod = function(i, t) {
      let r = new Uint8Array(i);
      for (; r.length - t.length >= 0; ) {
        const a = r[0];
        for (let c = 0; c < t.length; c++)
          r[c] ^= e.mul(t[c], a);
        let o = 0;
        for (; o < r.length && r[o] === 0; ) o++;
        r = r.slice(o);
      }
      return r;
    }, s.generateECPolynomial = function(i) {
      let t = new Uint8Array([1]);
      for (let r = 0; r < i; r++)
        t = s.mul(t, new Uint8Array([1, e.exp(r)]));
      return t;
    };
  }(rt)), rt;
}
var st, qt;
function we() {
  if (qt) return st;
  qt = 1;
  const s = Se();
  function e(n) {
    this.genPoly = void 0, this.degree = n, this.degree && this.initialize(this.degree);
  }
  return e.prototype.initialize = function(i) {
    this.degree = i, this.genPoly = s.generateECPolynomial(this.degree);
  }, e.prototype.encode = function(i) {
    if (!this.genPoly)
      throw new Error("Encoder not initialized");
    const t = new Uint8Array(i.length + this.degree);
    t.set(i);
    const r = s.mod(t, this.genPoly), a = this.degree - r.length;
    if (a > 0) {
      const o = new Uint8Array(this.degree);
      return o.set(r, a), o;
    }
    return r;
  }, st = e, st;
}
var ot = {}, at = {}, ct = {}, Ut;
function ne() {
  return Ut || (Ut = 1, ct.isValid = function(e) {
    return !isNaN(e) && e >= 1 && e <= 40;
  }), ct;
}
var N = {}, _t;
function ie() {
  if (_t) return N;
  _t = 1;
  const s = "[0-9]+", e = "[A-Z $%*+\\-./:]+";
  let n = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
  n = n.replace(/u/g, "\\u");
  const i = "(?:(?![A-Z0-9 $%*+\\-./:]|" + n + `)(?:.|[\r
]))+`;
  N.KANJI = new RegExp(n, "g"), N.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g"), N.BYTE = new RegExp(i, "g"), N.NUMERIC = new RegExp(s, "g"), N.ALPHANUMERIC = new RegExp(e, "g");
  const t = new RegExp("^" + n + "$"), r = new RegExp("^" + s + "$"), a = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
  return N.testKanji = function(c) {
    return t.test(c);
  }, N.testNumeric = function(c) {
    return r.test(c);
  }, N.testAlphanumeric = function(c) {
    return a.test(c);
  }, N;
}
var Ot;
function U() {
  return Ot || (Ot = 1, function(s) {
    const e = ne(), n = ie();
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
      if (!e.isValid(a))
        throw new Error("Invalid version: " + a);
      return a >= 1 && a < 10 ? r.ccBits[0] : a < 27 ? r.ccBits[1] : r.ccBits[2];
    }, s.getBestModeForData = function(r) {
      return n.testNumeric(r) ? s.NUMERIC : n.testAlphanumeric(r) ? s.ALPHANUMERIC : n.testKanji(r) ? s.KANJI : s.BYTE;
    }, s.toString = function(r) {
      if (r && r.id) return r.id;
      throw new Error("Invalid mode");
    }, s.isValid = function(r) {
      return r && r.bit && r.ccBits;
    };
    function i(t) {
      if (typeof t != "string")
        throw new Error("Param is not a string");
      switch (t.toLowerCase()) {
        case "numeric":
          return s.NUMERIC;
        case "alphanumeric":
          return s.ALPHANUMERIC;
        case "kanji":
          return s.KANJI;
        case "byte":
          return s.BYTE;
        default:
          throw new Error("Unknown mode: " + t);
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
var zt;
function ve() {
  return zt || (zt = 1, function(s) {
    const e = q(), n = ee(), i = St(), t = U(), r = ne(), a = 7973, o = e.getBCHDigit(a);
    function c(h, u, b) {
      for (let C = 1; C <= 40; C++)
        if (u <= s.getCapacity(C, b, h))
          return C;
    }
    function l(h, u) {
      return t.getCharCountIndicator(h, u) + 4;
    }
    function d(h, u) {
      let b = 0;
      return h.forEach(function(C) {
        const R = l(C.mode, u);
        b += R + C.getBitsLength();
      }), b;
    }
    function f(h, u) {
      for (let b = 1; b <= 40; b++)
        if (d(h, b) <= s.getCapacity(b, u, t.MIXED))
          return b;
    }
    s.from = function(u, b) {
      return r.isValid(u) ? parseInt(u, 10) : b;
    }, s.getCapacity = function(u, b, C) {
      if (!r.isValid(u))
        throw new Error("Invalid QR Code version");
      typeof C > "u" && (C = t.BYTE);
      const R = e.getSymbolTotalCodewords(u), E = n.getTotalCodewordsCount(u, b), B = (R - E) * 8;
      if (C === t.MIXED) return B;
      const T = B - l(C, u);
      switch (C) {
        case t.NUMERIC:
          return Math.floor(T / 10 * 3);
        case t.ALPHANUMERIC:
          return Math.floor(T / 11 * 2);
        case t.KANJI:
          return Math.floor(T / 13);
        case t.BYTE:
        default:
          return Math.floor(T / 8);
      }
    }, s.getBestVersionForData = function(u, b) {
      let C;
      const R = i.from(b, i.M);
      if (Array.isArray(u)) {
        if (u.length > 1)
          return f(u, R);
        if (u.length === 0)
          return 1;
        C = u[0];
      } else
        C = u;
      return c(C.mode, C.getLength(), R);
    }, s.getEncodedBits = function(u) {
      if (!r.isValid(u) || u < 7)
        throw new Error("Invalid QR Code version");
      let b = u << 12;
      for (; e.getBCHDigit(b) - o >= 0; )
        b ^= a << e.getBCHDigit(b) - o;
      return u << 12 | b;
    };
  }(ot)), ot;
}
var lt = {}, $t;
function Me() {
  if ($t) return lt;
  $t = 1;
  const s = q(), e = 1335, n = 21522, i = s.getBCHDigit(e);
  return lt.getEncodedBits = function(r, a) {
    const o = r.bit << 3 | a;
    let c = o << 10;
    for (; s.getBCHDigit(c) - i >= 0; )
      c ^= e << s.getBCHDigit(c) - i;
    return (o << 10 | c) ^ n;
  }, lt;
}
var dt = {}, ut, Yt;
function be() {
  if (Yt) return ut;
  Yt = 1;
  const s = U();
  function e(n) {
    this.mode = s.NUMERIC, this.data = n.toString();
  }
  return e.getBitsLength = function(i) {
    return 10 * Math.floor(i / 3) + (i % 3 ? i % 3 * 3 + 1 : 0);
  }, e.prototype.getLength = function() {
    return this.data.length;
  }, e.prototype.getBitsLength = function() {
    return e.getBitsLength(this.data.length);
  }, e.prototype.write = function(i) {
    let t, r, a;
    for (t = 0; t + 3 <= this.data.length; t += 3)
      r = this.data.substr(t, 3), a = parseInt(r, 10), i.put(a, 10);
    const o = this.data.length - t;
    o > 0 && (r = this.data.substr(t), a = parseInt(r, 10), i.put(a, o * 3 + 1));
  }, ut = e, ut;
}
var ft, Ht;
function Ee() {
  if (Ht) return ft;
  Ht = 1;
  const s = U(), e = [
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
  function n(i) {
    this.mode = s.ALPHANUMERIC, this.data = i;
  }
  return n.getBitsLength = function(t) {
    return 11 * Math.floor(t / 2) + 6 * (t % 2);
  }, n.prototype.getLength = function() {
    return this.data.length;
  }, n.prototype.getBitsLength = function() {
    return n.getBitsLength(this.data.length);
  }, n.prototype.write = function(t) {
    let r;
    for (r = 0; r + 2 <= this.data.length; r += 2) {
      let a = e.indexOf(this.data[r]) * 45;
      a += e.indexOf(this.data[r + 1]), t.put(a, 11);
    }
    this.data.length % 2 && t.put(e.indexOf(this.data[r]), 6);
  }, ft = n, ft;
}
var ht, Gt;
function Te() {
  if (Gt) return ht;
  Gt = 1;
  const s = U();
  function e(n) {
    this.mode = s.BYTE, typeof n == "string" ? this.data = new TextEncoder().encode(n) : this.data = new Uint8Array(n);
  }
  return e.getBitsLength = function(i) {
    return i * 8;
  }, e.prototype.getLength = function() {
    return this.data.length;
  }, e.prototype.getBitsLength = function() {
    return e.getBitsLength(this.data.length);
  }, e.prototype.write = function(n) {
    for (let i = 0, t = this.data.length; i < t; i++)
      n.put(this.data[i], 8);
  }, ht = e, ht;
}
var gt, Vt;
function Ie() {
  if (Vt) return gt;
  Vt = 1;
  const s = U(), e = q();
  function n(i) {
    this.mode = s.KANJI, this.data = i;
  }
  return n.getBitsLength = function(t) {
    return t * 13;
  }, n.prototype.getLength = function() {
    return this.data.length;
  }, n.prototype.getBitsLength = function() {
    return n.getBitsLength(this.data.length);
  }, n.prototype.write = function(i) {
    let t;
    for (t = 0; t < this.data.length; t++) {
      let r = e.toSJIS(this.data[t]);
      if (r >= 33088 && r <= 40956)
        r -= 33088;
      else if (r >= 57408 && r <= 60351)
        r -= 49472;
      else
        throw new Error(
          "Invalid SJIS character: " + this.data[t] + `
Make sure your charset is UTF-8`
        );
      r = (r >>> 8 & 255) * 192 + (r & 255), i.put(r, 13);
    }
  }, gt = n, gt;
}
var mt = { exports: {} }, jt;
function ke() {
  return jt || (jt = 1, function(s) {
    var e = {
      single_source_shortest_paths: function(n, i, t) {
        var r = {}, a = {};
        a[i] = 0;
        var o = e.PriorityQueue.make();
        o.push(i, 0);
        for (var c, l, d, f, h, u, b, C, R; !o.empty(); ) {
          c = o.pop(), l = c.value, f = c.cost, h = n[l] || {};
          for (d in h)
            h.hasOwnProperty(d) && (u = h[d], b = f + u, C = a[d], R = typeof a[d] > "u", (R || C > b) && (a[d] = b, o.push(d, b), r[d] = l));
        }
        if (typeof t < "u" && typeof a[t] > "u") {
          var E = ["Could not find a path from ", i, " to ", t, "."].join("");
          throw new Error(E);
        }
        return r;
      },
      extract_shortest_path_from_predecessor_list: function(n, i) {
        for (var t = [], r = i; r; )
          t.push(r), n[r], r = n[r];
        return t.reverse(), t;
      },
      find_path: function(n, i, t) {
        var r = e.single_source_shortest_paths(n, i, t);
        return e.extract_shortest_path_from_predecessor_list(
          r,
          t
        );
      },
      /**
       * A very naive priority queue implementation.
       */
      PriorityQueue: {
        make: function(n) {
          var i = e.PriorityQueue, t = {}, r;
          n = n || {};
          for (r in i)
            i.hasOwnProperty(r) && (t[r] = i[r]);
          return t.queue = [], t.sorter = n.sorter || i.default_sorter, t;
        },
        default_sorter: function(n, i) {
          return n.cost - i.cost;
        },
        /**
         * Add a new item to the queue and ensure the highest priority element
         * is at the front of the queue.
         */
        push: function(n, i) {
          var t = { value: n, cost: i };
          this.queue.push(t), this.queue.sort(this.sorter);
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
    s.exports = e;
  }(mt)), mt.exports;
}
var Kt;
function Ae() {
  return Kt || (Kt = 1, function(s) {
    const e = U(), n = be(), i = Ee(), t = Te(), r = Ie(), a = ie(), o = q(), c = ke();
    function l(E) {
      return unescape(encodeURIComponent(E)).length;
    }
    function d(E, B, T) {
      const y = [];
      let P;
      for (; (P = E.exec(T)) !== null; )
        y.push({
          data: P[0],
          index: P.index,
          mode: B,
          length: P[0].length
        });
      return y;
    }
    function f(E) {
      const B = d(a.NUMERIC, e.NUMERIC, E), T = d(a.ALPHANUMERIC, e.ALPHANUMERIC, E);
      let y, P;
      return o.isKanjiModeEnabled() ? (y = d(a.BYTE, e.BYTE, E), P = d(a.KANJI, e.KANJI, E)) : (y = d(a.BYTE_KANJI, e.BYTE, E), P = []), B.concat(T, y, P).sort(function(w, S) {
        return w.index - S.index;
      }).map(function(w) {
        return {
          data: w.data,
          mode: w.mode,
          length: w.length
        };
      });
    }
    function h(E, B) {
      switch (B) {
        case e.NUMERIC:
          return n.getBitsLength(E);
        case e.ALPHANUMERIC:
          return i.getBitsLength(E);
        case e.KANJI:
          return r.getBitsLength(E);
        case e.BYTE:
          return t.getBitsLength(E);
      }
    }
    function u(E) {
      return E.reduce(function(B, T) {
        const y = B.length - 1 >= 0 ? B[B.length - 1] : null;
        return y && y.mode === T.mode ? (B[B.length - 1].data += T.data, B) : (B.push(T), B);
      }, []);
    }
    function b(E) {
      const B = [];
      for (let T = 0; T < E.length; T++) {
        const y = E[T];
        switch (y.mode) {
          case e.NUMERIC:
            B.push([
              y,
              { data: y.data, mode: e.ALPHANUMERIC, length: y.length },
              { data: y.data, mode: e.BYTE, length: y.length }
            ]);
            break;
          case e.ALPHANUMERIC:
            B.push([
              y,
              { data: y.data, mode: e.BYTE, length: y.length }
            ]);
            break;
          case e.KANJI:
            B.push([
              y,
              { data: y.data, mode: e.BYTE, length: l(y.data) }
            ]);
            break;
          case e.BYTE:
            B.push([
              { data: y.data, mode: e.BYTE, length: l(y.data) }
            ]);
        }
      }
      return B;
    }
    function C(E, B) {
      const T = {}, y = { start: {} };
      let P = ["start"];
      for (let g = 0; g < E.length; g++) {
        const w = E[g], S = [];
        for (let p = 0; p < w.length; p++) {
          const k = w[p], v = "" + g + p;
          S.push(v), T[v] = { node: k, lastCount: 0 }, y[v] = {};
          for (let I = 0; I < P.length; I++) {
            const M = P[I];
            T[M] && T[M].node.mode === k.mode ? (y[M][v] = h(T[M].lastCount + k.length, k.mode) - h(T[M].lastCount, k.mode), T[M].lastCount += k.length) : (T[M] && (T[M].lastCount = k.length), y[M][v] = h(k.length, k.mode) + 4 + e.getCharCountIndicator(k.mode, B));
          }
        }
        P = S;
      }
      for (let g = 0; g < P.length; g++)
        y[P[g]].end = 0;
      return { map: y, table: T };
    }
    function R(E, B) {
      let T;
      const y = e.getBestModeForData(E);
      if (T = e.from(B, y), T !== e.BYTE && T.bit < y.bit)
        throw new Error('"' + E + '" cannot be encoded with mode ' + e.toString(T) + `.
 Suggested mode is: ` + e.toString(y));
      switch (T === e.KANJI && !o.isKanjiModeEnabled() && (T = e.BYTE), T) {
        case e.NUMERIC:
          return new n(E);
        case e.ALPHANUMERIC:
          return new i(E);
        case e.KANJI:
          return new r(E);
        case e.BYTE:
          return new t(E);
      }
    }
    s.fromArray = function(B) {
      return B.reduce(function(T, y) {
        return typeof y == "string" ? T.push(R(y, null)) : y.data && T.push(R(y.data, y.mode)), T;
      }, []);
    }, s.fromString = function(B, T) {
      const y = f(B, o.isKanjiModeEnabled()), P = b(y), g = C(P, T), w = c.find_path(g.map, "start", "end"), S = [];
      for (let p = 1; p < w.length - 1; p++)
        S.push(g.table[w[p]].node);
      return s.fromArray(u(S));
    }, s.rawSplit = function(B) {
      return s.fromArray(
        f(B, o.isKanjiModeEnabled())
      );
    };
  }(dt)), dt;
}
var Jt;
function Be() {
  if (Jt) return Q;
  Jt = 1;
  const s = q(), e = St(), n = he(), i = ge(), t = me(), r = pe(), a = ye(), o = ee(), c = we(), l = ve(), d = Me(), f = U(), h = Ae();
  function u(g, w) {
    const S = g.size, p = r.getPositions(w);
    for (let k = 0; k < p.length; k++) {
      const v = p[k][0], I = p[k][1];
      for (let M = -1; M <= 7; M++)
        if (!(v + M <= -1 || S <= v + M))
          for (let A = -1; A <= 7; A++)
            I + A <= -1 || S <= I + A || (M >= 0 && M <= 6 && (A === 0 || A === 6) || A >= 0 && A <= 6 && (M === 0 || M === 6) || M >= 2 && M <= 4 && A >= 2 && A <= 4 ? g.set(v + M, I + A, !0, !0) : g.set(v + M, I + A, !1, !0));
    }
  }
  function b(g) {
    const w = g.size;
    for (let S = 8; S < w - 8; S++) {
      const p = S % 2 === 0;
      g.set(S, 6, p, !0), g.set(6, S, p, !0);
    }
  }
  function C(g, w) {
    const S = t.getPositions(w);
    for (let p = 0; p < S.length; p++) {
      const k = S[p][0], v = S[p][1];
      for (let I = -2; I <= 2; I++)
        for (let M = -2; M <= 2; M++)
          I === -2 || I === 2 || M === -2 || M === 2 || I === 0 && M === 0 ? g.set(k + I, v + M, !0, !0) : g.set(k + I, v + M, !1, !0);
    }
  }
  function R(g, w) {
    const S = g.size, p = l.getEncodedBits(w);
    let k, v, I;
    for (let M = 0; M < 18; M++)
      k = Math.floor(M / 3), v = M % 3 + S - 8 - 3, I = (p >> M & 1) === 1, g.set(k, v, I, !0), g.set(v, k, I, !0);
  }
  function E(g, w, S) {
    const p = g.size, k = d.getEncodedBits(w, S);
    let v, I;
    for (v = 0; v < 15; v++)
      I = (k >> v & 1) === 1, v < 6 ? g.set(v, 8, I, !0) : v < 8 ? g.set(v + 1, 8, I, !0) : g.set(p - 15 + v, 8, I, !0), v < 8 ? g.set(8, p - v - 1, I, !0) : v < 9 ? g.set(8, 15 - v - 1 + 1, I, !0) : g.set(8, 15 - v - 1, I, !0);
    g.set(p - 8, 8, 1, !0);
  }
  function B(g, w) {
    const S = g.size;
    let p = -1, k = S - 1, v = 7, I = 0;
    for (let M = S - 1; M > 0; M -= 2)
      for (M === 6 && M--; ; ) {
        for (let A = 0; A < 2; A++)
          if (!g.isReserved(k, M - A)) {
            let F = !1;
            I < w.length && (F = (w[I] >>> v & 1) === 1), g.set(k, M - A, F), v--, v === -1 && (I++, v = 7);
          }
        if (k += p, k < 0 || S <= k) {
          k -= p, p = -p;
          break;
        }
      }
  }
  function T(g, w, S) {
    const p = new n();
    S.forEach(function(A) {
      p.put(A.mode.bit, 4), p.put(A.getLength(), f.getCharCountIndicator(A.mode, g)), A.write(p);
    });
    const k = s.getSymbolTotalCodewords(g), v = o.getTotalCodewordsCount(g, w), I = (k - v) * 8;
    for (p.getLengthInBits() + 4 <= I && p.put(0, 4); p.getLengthInBits() % 8 !== 0; )
      p.putBit(0);
    const M = (I - p.getLengthInBits()) / 8;
    for (let A = 0; A < M; A++)
      p.put(A % 2 ? 17 : 236, 8);
    return y(p, g, w);
  }
  function y(g, w, S) {
    const p = s.getSymbolTotalCodewords(w), k = o.getTotalCodewordsCount(w, S), v = p - k, I = o.getBlocksCount(w, S), M = p % I, A = I - M, F = Math.floor(p / I), z = Math.floor(v / I), se = z + 1, wt = F - z, oe = new c(wt);
    let G = 0;
    const Y = new Array(I), vt = new Array(I);
    let V = 0;
    const ae = new Uint8Array(g.buffer);
    for (let _ = 0; _ < I; _++) {
      const K = _ < A ? z : se;
      Y[_] = ae.slice(G, G + K), vt[_] = oe.encode(Y[_]), G += K, V = Math.max(V, K);
    }
    const j = new Uint8Array(p);
    let Mt = 0, L, x;
    for (L = 0; L < V; L++)
      for (x = 0; x < I; x++)
        L < Y[x].length && (j[Mt++] = Y[x][L]);
    for (L = 0; L < wt; L++)
      for (x = 0; x < I; x++)
        j[Mt++] = vt[x][L];
    return j;
  }
  function P(g, w, S, p) {
    let k;
    if (Array.isArray(g))
      k = h.fromArray(g);
    else if (typeof g == "string") {
      let F = w;
      if (!F) {
        const z = h.rawSplit(g);
        F = l.getBestVersionForData(z, S);
      }
      k = h.fromString(g, F || 40);
    } else
      throw new Error("Invalid data");
    const v = l.getBestVersionForData(k, S);
    if (!v)
      throw new Error("The amount of data is too big to be stored in a QR Code");
    if (!w)
      w = v;
    else if (w < v)
      throw new Error(
        `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ` + v + `.
`
      );
    const I = T(w, S, k), M = s.getSymbolSize(w), A = new i(M);
    return u(A, w), b(A), C(A, w), E(A, S, 0), w >= 7 && R(A, w), B(A, I), isNaN(p) && (p = a.getBestMask(
      A,
      E.bind(null, A, S)
    )), a.applyMask(p, A), E(A, S, p), {
      modules: A,
      version: w,
      errorCorrectionLevel: S,
      maskPattern: p,
      segments: k
    };
  }
  return Q.create = function(w, S) {
    if (typeof w > "u" || w === "")
      throw new Error("No input text");
    let p = e.M, k, v;
    return typeof S < "u" && (p = e.from(S.errorCorrectionLevel, e.M), k = l.from(S.version), v = a.from(S.maskPattern), S.toSJISFunc && s.setToSJISFunction(S.toSJISFunc)), P(w, k, p, v);
  }, Q;
}
var pt = {}, yt = {}, Xt;
function re() {
  return Xt || (Xt = 1, function(s) {
    function e(n) {
      if (typeof n == "number" && (n = n.toString()), typeof n != "string")
        throw new Error("Color should be defined as hex string");
      let i = n.slice().replace("#", "").split("");
      if (i.length < 3 || i.length === 5 || i.length > 8)
        throw new Error("Invalid hex color: " + n);
      (i.length === 3 || i.length === 4) && (i = Array.prototype.concat.apply([], i.map(function(r) {
        return [r, r];
      }))), i.length === 6 && i.push("F", "F");
      const t = parseInt(i.join(""), 16);
      return {
        r: t >> 24 & 255,
        g: t >> 16 & 255,
        b: t >> 8 & 255,
        a: t & 255,
        hex: "#" + i.slice(0, 6).join("")
      };
    }
    s.getOptions = function(i) {
      i || (i = {}), i.color || (i.color = {});
      const t = typeof i.margin > "u" || i.margin === null || i.margin < 0 ? 4 : i.margin, r = i.width && i.width >= 21 ? i.width : void 0, a = i.scale || 4;
      return {
        width: r,
        scale: r ? 4 : a,
        margin: t,
        color: {
          dark: e(i.color.dark || "#000000ff"),
          light: e(i.color.light || "#ffffffff")
        },
        type: i.type,
        rendererOpts: i.rendererOpts || {}
      };
    }, s.getScale = function(i, t) {
      return t.width && t.width >= i + t.margin * 2 ? t.width / (i + t.margin * 2) : t.scale;
    }, s.getImageWidth = function(i, t) {
      const r = s.getScale(i, t);
      return Math.floor((i + t.margin * 2) * r);
    }, s.qrToImageData = function(i, t, r) {
      const a = t.modules.size, o = t.modules.data, c = s.getScale(a, r), l = Math.floor((a + r.margin * 2) * c), d = r.margin * c, f = [r.color.light, r.color.dark];
      for (let h = 0; h < l; h++)
        for (let u = 0; u < l; u++) {
          let b = (h * l + u) * 4, C = r.color.light;
          if (h >= d && u >= d && h < l - d && u < l - d) {
            const R = Math.floor((h - d) / c), E = Math.floor((u - d) / c);
            C = f[o[R * a + E] ? 1 : 0];
          }
          i[b++] = C.r, i[b++] = C.g, i[b++] = C.b, i[b] = C.a;
        }
    };
  }(yt)), yt;
}
var Qt;
function Re() {
  return Qt || (Qt = 1, function(s) {
    const e = re();
    function n(t, r, a) {
      t.clearRect(0, 0, r.width, r.height), r.style || (r.style = {}), r.height = a, r.width = a, r.style.height = a + "px", r.style.width = a + "px";
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
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), a || (l = i()), c = e.getOptions(c);
      const d = e.getImageWidth(r.modules.size, c), f = l.getContext("2d"), h = f.createImageData(d, d);
      return e.qrToImageData(h.data, r, c), n(f, l, d), f.putImageData(h, 0, 0), l;
    }, s.renderToDataURL = function(r, a, o) {
      let c = o;
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), c || (c = {});
      const l = s.render(r, a, c), d = c.type || "image/png", f = c.rendererOpts || {};
      return l.toDataURL(d, f.quality);
    };
  }(pt)), pt;
}
var Ct = {}, Wt;
function Pe() {
  if (Wt) return Ct;
  Wt = 1;
  const s = re();
  function e(t, r) {
    const a = t.a / 255, o = r + '="' + t.hex + '"';
    return a < 1 ? o + " " + r + '-opacity="' + a.toFixed(2).slice(1) + '"' : o;
  }
  function n(t, r, a) {
    let o = t + r;
    return typeof a < "u" && (o += " " + a), o;
  }
  function i(t, r, a) {
    let o = "", c = 0, l = !1, d = 0;
    for (let f = 0; f < t.length; f++) {
      const h = Math.floor(f % r), u = Math.floor(f / r);
      !h && !l && (l = !0), t[f] ? (d++, f > 0 && h > 0 && t[f - 1] || (o += l ? n("M", h + a, 0.5 + u + a) : n("m", c, 0), c = 0, l = !1), h + 1 < r && t[f + 1] || (o += n("h", d), d = 0)) : c++;
    }
    return o;
  }
  return Ct.render = function(r, a, o) {
    const c = s.getOptions(a), l = r.modules.size, d = r.modules.data, f = l + c.margin * 2, h = c.color.light.a ? "<path " + e(c.color.light, "fill") + ' d="M0 0h' + f + "v" + f + 'H0z"/>' : "", u = "<path " + e(c.color.dark, "stroke") + ' d="' + i(d, l, c.margin) + '"/>', b = 'viewBox="0 0 ' + f + " " + f + '"', R = '<svg xmlns="http://www.w3.org/2000/svg" ' + (c.width ? 'width="' + c.width + '" height="' + c.width + '" ' : "") + b + ' shape-rendering="crispEdges">' + h + u + `</svg>
`;
    return typeof o == "function" && o(null, R), R;
  }, Ct;
}
var Zt;
function Ne() {
  if (Zt) return O;
  Zt = 1;
  const s = fe(), e = Be(), n = Re(), i = Pe();
  function t(r, a, o, c, l) {
    const d = [].slice.call(arguments, 1), f = d.length, h = typeof d[f - 1] == "function";
    if (!h && !s())
      throw new Error("Callback required as last argument");
    if (h) {
      if (f < 2)
        throw new Error("Too few arguments provided");
      f === 2 ? (l = o, o = a, a = c = void 0) : f === 3 && (a.getContext && typeof l > "u" ? (l = c, c = void 0) : (l = c, c = o, o = a, a = void 0));
    } else {
      if (f < 1)
        throw new Error("Too few arguments provided");
      return f === 1 ? (o = a, a = c = void 0) : f === 2 && !a.getContext && (c = o, o = a, a = void 0), new Promise(function(u, b) {
        try {
          const C = e.create(o, c);
          u(r(C, a, c));
        } catch (C) {
          b(C);
        }
      });
    }
    try {
      const u = e.create(o, c);
      l(null, r(u, a, c));
    } catch (u) {
      l(u);
    }
  }
  return O.create = e.create, O.toCanvas = t.bind(null, n.render), O.toDataURL = t.bind(null, n.renderToDataURL), O.toString = t.bind(null, function(r, a, o) {
    return i.render(r, o);
  }), O;
}
var Le = Ne();
const xe = /* @__PURE__ */ ue(Le);
function Fe(s, e) {
  let n = (s || "").trim();
  (!n || n === "undefined" || n.includes("localhost") || n.includes("127.0.0.1") || n.startsWith("file:")) && (n = "https://adsense.davidpetrea.ro/offer");
  try {
    const i = new URL(n);
    return (i.hostname === "adsense.davidpetrea.ro" || i.hostname.endsWith(".davidpetrea.ro") || i.pathname.startsWith("/offer")) && (e && e !== "undefined" && e !== "display" && i.searchParams.set("d", e), i.searchParams.set("src", "tv")), i.toString();
  } catch {
    const i = e && e !== "undefined" && e !== "display" ? e : "";
    return i ? `https://adsense.davidpetrea.ro/offer?d=${encodeURIComponent(i)}&src=tv` : "https://adsense.davidpetrea.ro/offer?src=tv";
  }
}
function De(s, e, n) {
  const i = Math.min(e, n);
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
async function qe(s, e) {
  return xe.toDataURL(s, {
    errorCorrectionLevel: "M",
    margin: 4,
    color: {
      dark: "#0a0d14",
      light: "#ffffff"
    },
    width: e
  });
}
function Ue(s) {
  if (s.length === 0)
    return { peopleSide: "left", contentSide: "right" };
  const n = s.reduce((t, r) => t + r.x, 0) / s.length < 0.5 ? "left" : "right";
  return { peopleSide: n, contentSide: n === "left" ? "right" : "left" };
}
function _e(s, e, n, i, t, r, a = 0.03) {
  const o = Math.round(t * a), c = n + o, l = r - n - o, d = Math.max(c, Math.min(l, e));
  let f, h;
  return i === "left" ? (f = n + o, h = t / 2 - n - o) : (f = t / 2 + n + o, h = t - n - o), f > h ? { cx: i === "left" ? t * 0.25 : t * 0.75, cy: d } : { cx: Math.max(f, Math.min(h, s)), cy: d };
}
function Oe(s, e, n, i, t = 4) {
  const r = s.map((a) => ({ ...a }));
  for (let a = 0; a < t; a++) {
    for (let o = 0; o < r.length; o++)
      for (let c = o + 1; c < r.length; c++) {
        const l = r[o], d = r[c], f = d.cx - l.cx, h = d.cy - l.cy, u = Math.hypot(f, h) || 1, b = l.radius + d.radius;
        if (u < b) {
          const C = (b - u) / 2, R = f / u, E = h / u;
          l.cx -= R * C, l.cy -= E * C, d.cx += R * C, d.cy += E * C;
        }
      }
    for (const o of r) {
      const c = _e(
        o.cx,
        o.cy,
        o.radius,
        e,
        n,
        i
      );
      o.cx = c.cx, o.cy = c.cy;
    }
  }
  return r;
}
class ze {
  constructor() {
    m(this, "enabled", !1);
    m(this, "activeFaceId", 1);
    m(this, "faces", /* @__PURE__ */ new Map());
    m(this, "indicator", null);
    m(this, "listenersAttached", !1);
    if (typeof window < "u") {
      const e = new URLSearchParams(window.location.search);
      this.enabled = e.get("sim") === "1" || e.get("simulator") === "1";
    }
  }
  init(e) {
    !this.enabled || this.listenersAttached || (this.listenersAttached = !0, this.createSyntheticFace(1, 0.35, 0.45, !0), this.indicator = document.createElement("div"), this.indicator.className = "simulator-badge", this.updateBadge(), e.appendChild(this.indicator), window.addEventListener("mousemove", (n) => {
      if (!this.enabled) return;
      const i = Math.max(0.05, Math.min(0.95, n.clientX / window.innerWidth)), t = Math.max(0.05, Math.min(0.95, n.clientY / window.innerHeight)), r = this.faces.get(this.activeFaceId);
      r && (r.x = i - r.w / 2, r.y = t - r.h / 2);
    }), window.addEventListener("keydown", (n) => {
      if (this.enabled) {
        if (n.key === " " || n.key.toLowerCase() === "l") {
          n.preventDefault();
          const i = this.faces.get(this.activeFaceId);
          i && (i.looking = !i.looking, this.updateBadge());
        } else if (["1", "2", "3", "4"].includes(n.key)) {
          const i = Number(n.key);
          if (this.activeFaceId = i, !this.faces.has(i)) {
            const t = 0.2 + (i - 1) * 0.18;
            this.createSyntheticFace(i, t, 0.45, !0);
          }
          this.updateBadge();
        } else if (n.key.toLowerCase() === "c")
          this.faces.clear(), this.updateBadge();
        else if (n.key.toLowerCase() === "a") {
          const i = this.faces.size + 1;
          i <= 4 && (this.createSyntheticFace(i, 0.2 + (i - 1) * 0.18, 0.45, !0), this.activeFaceId = i, this.updateBadge());
        }
      }
    }));
  }
  createSyntheticFace(e, n, i, t) {
    let r;
    if (typeof document < "u") {
      const a = document.createElement("canvas");
      a.width = 320, a.height = 320;
      const o = a.getContext("2d");
      if (o) {
        const c = o.createLinearGradient(0, 0, 320, 320);
        c.addColorStop(0, "#334155"), c.addColorStop(1, "#1e293b"), o.fillStyle = c, o.fillRect(0, 0, 320, 320), o.fillStyle = e % 2 === 0 ? "#0284c7" : "#059669", o.beginPath(), o.ellipse(160, 330, 110, 80, 0, 0, Math.PI * 2), o.fill(), o.fillStyle = "#fbcfe8", o.fillRect(140, 200, 40, 60), o.fillStyle = e % 2 === 0 ? "#fed7aa" : "#fcd34d", o.beginPath(), o.ellipse(160, 150, 65, 80, 0, 0, Math.PI * 2), o.fill(), o.fillStyle = e % 2 === 0 ? "#3b2f2f" : "#1e1e1e", o.beginPath(), o.ellipse(160, 110, 70, 50, 0, 0, Math.PI * 2), o.fill(), o.fillStyle = "#1e293b", o.beginPath(), o.arc(140, 145, 6, 0, Math.PI * 2), o.arc(180, 145, 6, 0, Math.PI * 2), o.fill(), o.strokeStyle = "#be123c", o.lineWidth = 3, o.beginPath(), o.arc(160, 175, 20, 0.2 * Math.PI, 0.8 * Math.PI), o.stroke(), r = a.toDataURL("image/jpeg", 0.85);
      }
    }
    this.faces.set(e, {
      x: n,
      y: i,
      w: 0.15,
      h: 0.22,
      looking: t,
      crop_jpeg: r
    });
  }
  updateBadge() {
    if (!this.indicator) return;
    const e = this.faces.get(this.activeFaceId), n = e ? e.looking ? "👀 LOOKING (ACTIVE)" : "🙈 LOOKING AWAY" : "NO FACE";
    this.indicator.innerHTML = `
      <div style="font-family: monospace; font-size: 13px; background: rgba(15,23,42,0.92); color: #38bdf8; padding: 8px 12px; border-radius: 8px; border: 1px solid #0284c7; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        <div>🎮 <strong>SIMULATOR ACTIVE</strong> (Face #${this.activeFaceId} / Total: ${this.faces.size})</div>
        <div style="color: ${e != null && e.looking ? "#4ade80" : "#f87171"}; font-weight: bold; margin-top: 2px;">${n}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Move mouse = move face | Space/L = toggle look | 1-4 = select | A = add | C = clear</div>
      </div>
    `;
  }
  getFaces() {
    return this.enabled ? Array.from(this.faces.entries()).map(([e, n]) => ({
      id: e,
      x: n.x,
      y: n.y,
      w: n.w,
      h: n.h,
      looking: n.looking,
      crop_jpeg: n.crop_jpeg,
      score: 0.95
    })) : [];
  }
}
const te = [
  "crossfade",
  "zoom dissolve",
  "push",
  "soft wipe",
  "dip to black"
];
function $e(s) {
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
class Ye {
  constructor() {
    m(this, "lastType", null);
  }
  resolve(e) {
    let n = (e || "crossfade").toLowerCase().replace(/_/g, " ");
    if (n === "auto") {
      const t = te.filter((a) => a !== this.lastType), r = t[Math.floor(Math.random() * t.length)] || "crossfade";
      return this.lastType = r, r;
    }
    te.includes(n) || (n = "crossfade");
    const i = n;
    return this.lastType = i, i;
  }
}
function He(s) {
  const e = -(Math.cos(Math.PI * s) - 1) / 2;
  return e === 0 ? 0 : e;
}
function Ge(s, e) {
  const n = Math.max(0, Math.min(1, e)), i = He(n);
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
      const t = 1 + 0.06 * i, r = 1.04 - 0.04 * i;
      return {
        outgoing: {
          opacity: 1 - i,
          transform: `scale(${t.toFixed(4)})`
        },
        incoming: {
          opacity: i,
          transform: `scale(${r.toFixed(4)})`
        }
      };
    }
    case "push": {
      const t = (1 - i) * 100, r = -i * 30, a = 1 - 0.4 * i;
      return {
        outgoing: {
          opacity: 1,
          transform: `translate3d(${r.toFixed(2)}%, 0, 0)`,
          filter: `brightness(${a.toFixed(3)})`
        },
        incoming: {
          opacity: 1,
          transform: `translate3d(${t.toFixed(2)}%, 0, 0)`
        }
      };
    }
    case "soft wipe": {
      const t = n * 115, a = `linear-gradient(to right, #000 0%, #000 ${Math.max(0, t - 15).toFixed(1)}%, transparent ${t.toFixed(1)}%)`;
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
      if (n < 0.5)
        return {
          outgoing: {
            opacity: 1 - n * 2,
            transform: "none"
          },
          incoming: {
            opacity: 0,
            transform: "none"
          }
        };
      {
        const t = (n - 0.5) * 2;
        return {
          outgoing: {
            opacity: 0,
            transform: "none"
          },
          incoming: {
            opacity: t,
            transform: "none"
          }
        };
      }
    }
  }
}
function Ve(s) {
  let e = (s || "#111827").replace("#", "");
  e.length === 3 && (e = e.split("").map((a) => a + a).join(""));
  const n = parseInt(e.slice(0, 2), 16) || 17, i = parseInt(e.slice(2, 4), 16) || 24, t = parseInt(e.slice(4, 6), 16) || 39;
  return (0.2126 * n + 0.7152 * i + 0.0722 * t) / 255 > 0.55 ? { text: "#0f172a", muted: "#475569" } : { text: "#f8fafc", muted: "#cbd5e1" };
}
function je(s) {
  return s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
}
function Ke(s) {
  if (s === 0) return 0;
  if (s === 1) return 1;
  const e = je(s), n = Math.sin(s * Math.PI) * 0.08 * (1 - s);
  return e + n;
}
class Je {
  constructor(e) {
    m(this, "root");
    m(this, "simulator", new ze());
    m(this, "stateMachine", new bt());
    m(this, "blender", new de(4));
    m(this, "transitionSelector", new Ye());
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
    this.root = e, this.root.innerHTML = "";
    const n = new URLSearchParams(window.location.search);
    this.isDebugMode = n.get("debug") === "1", this.standbyContainer = document.createElement("div"), this.standbyContainer.className = "layer standby-layer", this.root.appendChild(this.standbyContainer), this.faceCanvas = document.createElement("canvas"), this.faceCanvas.className = "layer canvas-layer", this.root.appendChild(this.faceCanvas), this.faceCtx = this.faceCanvas.getContext("2d"), this.irisCanvas = document.createElement("canvas"), this.irisCanvas.className = "layer iris-layer", this.root.appendChild(this.irisCanvas), this.irisCtx = this.irisCanvas.getContext("2d"), this.offerContainer = document.createElement("div"), this.offerContainer.className = "layer offer-layer", this.root.appendChild(this.offerContainer), this.setupContainer = document.createElement("div"), this.setupContainer.className = "layer setup-layer", this.root.appendChild(this.setupContainer), this.debugOverlay = document.createElement("div"), this.debugOverlay.className = "debug-overlay", this.debugOverlay.style.display = this.isDebugMode ? "block" : "none", this.root.appendChild(this.debugOverlay), this.simulator.init(this.root), this.resizeCanvas(), window.addEventListener("resize", () => this.resizeCanvas()), this.connectVision(), this.pollState(), setInterval(() => this.pollState(), 2500), requestAnimationFrame((i) => this.renderLoop(i));
  }
  resizeCanvas() {
    const e = window.innerWidth, n = window.innerHeight;
    this.faceCanvas.width = e, this.faceCanvas.height = n, this.irisCanvas.width = e, this.irisCanvas.height = n;
  }
  connectVision() {
    const e = `ws://${location.hostname || "127.0.0.1"}:8766`;
    let n;
    const i = () => {
      n = new WebSocket(e), n.onmessage = (t) => {
        try {
          const r = JSON.parse(t.data);
          r && r.t === "faces" && Array.isArray(r.faces) && (this.simulator.enabled || (this.activeFaces = r.faces));
        } catch {
        }
      }, n.onclose = () => setTimeout(i, 3e3), n.onerror = () => n.close();
    };
    i();
  }
  async pollState() {
    try {
      const e = await fetch("/api/state", { cache: "no-store" });
      if (e.ok) {
        const n = await e.json();
        this.updateState(n);
      }
    } catch {
    }
  }
  updateState(e) {
    var o, c, l, d, f;
    this.state = e;
    const n = ((o = this.state.sync) == null ? void 0 : o.device_config) || {};
    this.stateMachine = new bt({
      dwellSeconds: n.lookTime || 3,
      offerMinSeconds: 20,
      exitAfterNobodySeconds: 6,
      cooldownSeconds: 8
    });
    const i = ((c = this.state.sync) == null ? void 0 : c.media) || [], t = ((l = this.state.sync) == null ? void 0 : l.playlist) || [];
    t.length > 0 ? this.mediaList = t.map((h) => i.find((u) => u.id === h)).filter(Boolean) : this.mediaList = i;
    const r = (f = (d = this.state.sync) == null ? void 0 : d.pairing) != null && f.code ? "display" : this.state.device_id || "", a = Fe(n.offerLink, r);
    if (a !== this.lastGeneratedQrUrl) {
      this.lastGeneratedQrUrl = a;
      const h = De(n.qrSize, window.innerWidth, window.innerHeight);
      qe(a, h).then((u) => {
        this.qrDataUrl = u;
      });
    }
  }
  renderLoop(e) {
    var i;
    if (this.frameCount++, e - this.lastFpsTime >= 1e3 && (this.fps = Math.round(this.frameCount * 1e3 / (e - this.lastFpsTime)), this.frameCount = 0, this.lastFpsTime = e), !!!((i = this.state.sync) != null && i.device_token))
      this.renderSetup(), this.standbyContainer.style.display = "none", this.offerContainer.style.display = "none", this.faceCanvas.style.display = "none", this.irisCanvas.style.display = "none";
    else {
      this.setupContainer.style.display = "none", this.standbyContainer.style.display = "block", this.faceCanvas.style.display = "block", this.irisCanvas.style.display = "block", this.offerContainer.style.display = "block";
      const t = this.simulator.enabled ? this.simulator.getFaces() : this.activeFaces, r = this.stateMachine.state, a = this.stateMachine.update(t, e);
      if (r === "STANDBY" && a === "TRIGGERING") {
        const o = Ue(t);
        this.lockedPeopleSide = o.peopleSide;
      }
      this.renderMedia(e), this.renderFaceBlending(t, e), this.renderTemplate(a, e);
    }
    this.isDebugMode && this.renderDebug(e), requestAnimationFrame((t) => this.renderLoop(t));
  }
  renderSetup() {
    var r;
    this.setupContainer.style.display = "flex";
    const e = (r = this.state.sync) == null ? void 0 : r.pairing, n = String((e == null ? void 0 : e.code) || ""), i = n.length === 6 ? `${n.slice(0, 3)} ${n.slice(3)}` : n, t = new URLSearchParams(window.location.search).get("lang") === "en";
    this.setupContainer.innerHTML = `
      <div class="setup-card">
        <div class="brand-badge">AdSense Smart Display</div>
        <h1>${t ? "Connect this display" : "Conectează acest ecran"}</h1>
        <p class="setup-instruction">${t ? "Go to <strong>adsense.davidpetrea.ro</strong> → <em>Add display</em> and enter this code:" : "Mergi pe <strong>adsense.davidpetrea.ro</strong> → <em>Adaugă ecran</em> și introdu codul:"}</p>
        <div class="pairing-code">${i || "••• •••"}</div>
        <p class="setup-footer">${t ? "Waiting for connection…" : "Se așteaptă conectarea…"}</p>
      </div>
    `;
  }
  renderMedia(e) {
    var r, a;
    if (this.mediaList.length === 0) {
      this.standbyContainer.dataset.loaded !== "brand" && (this.standbyContainer.dataset.loaded = "brand", this.standbyContainer.innerHTML = `
          <div class="standby-brand">
            <h1>${((r = this.state.sync) == null ? void 0 : r.display_name) || "AdSense"}</h1>
            <p>Smart Display</p>
          </div>
        `);
      return;
    }
    const n = ((a = this.state.sync) == null ? void 0 : a.device_config) || {}, i = (n.standbyDuration || 8) * 1e3;
    this.currentItemStartedMs || (this.currentItemStartedMs = e, this.renderActiveMediaSlot());
    const t = e - this.currentItemStartedMs;
    if (t >= i && !this.isTransitioning && this.mediaList.length > 1 && (this.isTransitioning = !0, this.transitionStartMs = e, this.activeTransitionType = this.transitionSelector.resolve(n.transition), this.activeTransitionDuration = $e(n.transitionSpeed), this.prepareNextMediaSlot()), this.isTransitioning) {
      const o = e - this.transitionStartMs, c = Math.min(1, o / this.activeTransitionDuration), l = Ge(this.activeTransitionType, c), d = this.standbyContainer.querySelector(".media-slot.outgoing"), f = this.standbyContainer.querySelector(".media-slot.incoming");
      d && (d.style.opacity = String(l.outgoing.opacity), d.style.transform = l.outgoing.transform, l.outgoing.filter && (d.style.filter = l.outgoing.filter)), f && (f.style.opacity = String(l.incoming.opacity), f.style.transform = l.incoming.transform, l.incoming.maskImage && (f.style.webkitMaskImage = l.incoming.maskImage)), c >= 1 && (this.isTransitioning = !1, this.currentMediaIndex = (this.currentMediaIndex + 1) % this.mediaList.length, this.currentItemStartedMs = e, this.finalizeMediaTransition());
    } else {
      const o = this.standbyContainer.querySelector(".media-slot.active");
      if (o && o.dataset.type === "image") {
        const c = Math.min(1, t / i), l = 1 + 0.08 * c, d = -1.5 + 3 * c, f = -0.75 + 1.5 * c;
        o.style.transform = `translate3d(${d.toFixed(2)}%, ${f.toFixed(2)}%, 0) scale(${l.toFixed(4)})`;
      }
    }
  }
  renderActiveMediaSlot() {
    var i;
    const e = this.mediaList[this.currentMediaIndex % this.mediaList.length];
    if (!e) return;
    const n = (i = e.content_type) == null ? void 0 : i.startsWith("video/");
    this.standbyContainer.innerHTML = `
      <div class="media-slot active" data-type="${n ? "video" : "image"}" style="opacity: 1; transform: none;">
        ${n ? `<video src="${e.local}" autoplay muted loop playsinline></video>` : `<img src="${e.local}" alt="">`}
      </div>
    `;
  }
  prepareNextMediaSlot() {
    var a;
    const e = (this.currentMediaIndex + 1) % this.mediaList.length, n = this.mediaList[e];
    if (!n) return;
    const i = (a = n.content_type) == null ? void 0 : a.startsWith("video/"), t = this.standbyContainer.querySelector(".media-slot.active");
    t && (t.className = "media-slot outgoing");
    const r = document.createElement("div");
    r.className = "media-slot incoming", r.dataset.type = i ? "video" : "image", r.style.opacity = "0", r.innerHTML = i ? `<video src="${n.local}" autoplay muted loop playsinline></video>` : `<img src="${n.local}" alt="">`, this.standbyContainer.appendChild(r);
  }
  finalizeMediaTransition() {
    const e = this.standbyContainer.querySelector(".media-slot.outgoing"), n = this.standbyContainer.querySelector(".media-slot.incoming");
    e && e.remove(), n && (n.className = "media-slot active", n.style.opacity = "1", n.style.transform = "none", n.style.filter = "none", n.style.webkitMaskImage = "none");
  }
  renderFaceBlending(e, n) {
    var l;
    if (!this.faceCtx) return;
    const i = this.faceCanvas.width, t = this.faceCanvas.height;
    if (this.faceCtx.clearRect(0, 0, i, t), (((l = this.state.sync) == null ? void 0 : l.device_config) || {}).liveFaces === !1) return;
    this.blender.update(e, n, i, t);
    const a = this.blender.getActiveTracks();
    if (a.length === 0) return;
    const o = a.map((d) => ({
      id: d.id,
      cx: d.currentX,
      cy: d.currentY,
      radius: d.currentSize / 2
    })), c = Oe(o, this.lockedPeopleSide, i, t);
    for (let d = 0; d < a.length; d++)
      a[d].currentX = c[d].cx, a[d].currentY = c[d].cy;
    this.blender.render(this.faceCtx, i, t);
  }
  renderTemplate(e, n) {
    var B;
    const i = ((B = this.state.sync) == null ? void 0 : B.device_config) || {}, t = i.template || "simple", r = Ve(i.offerBackground), a = i.offerBackground || "#111827", o = window.innerWidth, c = window.innerHeight;
    if (!this.irisCtx) return;
    if (this.irisCtx.clearRect(0, 0, o, c), e === "STANDBY" || e === "COOLDOWN") {
      this.offerContainer.style.display = "none", this.offerContainer.innerHTML = "";
      return;
    }
    this.offerContainer.style.display = "flex";
    let l = 1, d = 1, f = 1;
    const h = n - this.stateMachine.stateStartedMs;
    if (e === "TRIGGERING")
      l = Math.min(1, h / 1e3), d = Math.max(0, (h - 600) / 400), f = 0.92 + 0.08 * d;
    else if (e === "OFFER")
      l = 1, d = 1, f = 1;
    else if (e === "EXITING") {
      const y = Math.min(1, h / 1e3);
      d = Math.max(0, 1 - y * 2.5), f = 0.92 + 0.08 * d, l = Math.max(0, 1 - y);
    }
    if (t === "recruit") {
      const T = Ke(l), y = Math.hypot(o, c), P = this.blender.getActiveTracks();
      if (this.irisCtx.save(), this.irisCtx.fillStyle = a, this.irisCtx.fillRect(0, 0, o, c), this.irisCtx.globalCompositeOperation = "destination-out", P.length > 0)
        for (const g of P) {
          const w = g.currentSize / 2 * 1.15, S = y + (w - y) * T;
          this.irisCtx.beginPath(), this.irisCtx.arc(g.currentX, g.currentY, S, 0, Math.PI * 2), this.irisCtx.fill();
        }
      else {
        const g = y * (1 - T);
        this.irisCtx.beginPath(), this.irisCtx.arc(o / 4, c / 2, g, 0, Math.PI * 2), this.irisCtx.fill();
      }
      this.irisCtx.restore();
    } else
      this.irisCtx.save(), this.irisCtx.globalAlpha = l, this.irisCtx.fillStyle = a, this.irisCtx.fillRect(0, 0, o, c), this.irisCtx.restore();
    const u = this.lockedPeopleSide === "left" ? "right" : "left", b = t === "simple" ? (1 - d) * (u === "right" ? 40 : -40) : 0, C = i.headline || "20% reducere", R = i.subtext || "Scanează codul QR cu telefonul", E = i.caption || "";
    this.offerContainer.style.flexDirection = u === "right" ? "row" : "row-reverse", this.offerContainer.innerHTML = `
      <div class="offer-half media-half" style="opacity: ${d}"></div>
      <div class="offer-half content-half" style="
        opacity: ${d};
        transform: translate3d(${b}px, 0, 0);
        color: ${r.text};
      ">
        <div class="offer-card" style="background: transparent;">
          <h1 class="offer-headline" style="color: ${r.text};">${C}</h1>
          <p class="offer-subtext" style="color: ${r.muted};">${R}</p>
          <div class="qr-wrapper" style="transform: scale(${f.toFixed(4)});">
            <div class="qr-card">
              ${this.qrDataUrl ? `<img src="${this.qrDataUrl}" alt="QR" class="qr-image">` : ""}
            </div>
            ${E ? `<p class="qr-caption" style="color: ${r.muted};">${E}</p>` : ""}
          </div>
        </div>
      </div>
    `;
  }
  renderDebug(e) {
    var i, t, r;
    const n = this.stateMachine.state === "STANDBY" && ((i = this.activeFaces[0]) != null && i.looking) ? ((e - ((r = (t = this.stateMachine.tracks) == null ? void 0 : t.get(this.activeFaces[0].id)) == null ? void 0 : r.lookingSinceMs) || 0) / 1e3).toFixed(1) : "0.0";
    this.debugOverlay.innerHTML = `
      <div><strong>AdSense Debug HUD</strong></div>
      <div>FPS: ${this.fps}</div>
      <div>State: ${this.stateMachine.state} (phase: ${this.stateMachine.effectivePhase})</div>
      <div>People Side: ${this.lockedPeopleSide}</div>
      <div>Faces: ${this.activeFaces.length}</div>
      <div>Dwell: ${n}s</div>
      <div>Cooldown: ${this.stateMachine.isCooldownActive ? "ACTIVE" : "none"}</div>
    `;
  }
}
typeof document < "u" && window.addEventListener("DOMContentLoaded", () => {
  const s = document.querySelector("#app");
  s && new Je(s);
});
export {
  Je as App
};
