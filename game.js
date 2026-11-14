/*
 * game.js — pure game logic for mVIDIA CEO Simulator. No DOM access here.
 * Browser: attaches to window.MVLogic.  Node: module.exports (see tools/sim.mjs).
 * All content/tuning comes from GAME_DATA (data.js). Rendering lives in ui.js.
 */
(function (root) {
  'use strict';

  /* ---------------- RNG (seeded, reproducible) ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(str) { // FNV-1a 32-bit
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function rngFor() { return mulberry32(hashStr(Array.prototype.join.call(arguments, '|'))); }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pick(arr, rng) { return arr && arr.length ? arr[Math.floor(rng() * arr.length)] : null; }
  function randomSeed() { return 100000 + Math.floor(Math.random() * 900000); }

  /* ---------------- helpers ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isEmptyObj(o) { if (!o) return true; for (var k in o) if (o[k]) return false; return true; }
  function getField(obj, path) {
    var parts = String(path).split('.'), v = obj;
    for (var i = 0; i < parts.length; i++) { if (v == null) return ''; v = v[parts[i]]; }
    return v == null ? '' : v;
  }
  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }
  function toMinutes(hhmm) { var p = String(hhmm).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function fmtClock(min) { var h = Math.floor(min / 60), m = min % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function addEffects(acc, eff, times) {
    if (!eff) return acc;
    var n = times == null ? 1 : times;
    for (var k in eff) if (Object.prototype.hasOwnProperty.call(eff, k)) acc[k] = (acc[k] || 0) + eff[k] * n;
    return acc;
  }
  function testThreshold(t, v) {
    if (!t) return false;
    if (t.gte != null && v >= t.gte) return true;
    if (t.lte != null && v <= t.lte) return true;
    return false;
  }
  function gaugeDef(data, id) { for (var i = 0; i < data.gauges.length; i++) if (data.gauges[i].id === id) return data.gauges[i]; return null; }

  /* ---------------- candidates & days ---------------- */
  function allCandidates(data) { return (data.candidates || []).concat(data.cameos || []); }
  function candidateById(data, id) {
    var all = allCandidates(data);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function dayCandidates(data, day) { return allCandidates(data).filter(function (c) { return c.day === day; }); }
  function lastDay(data) { return data.days[data.days.length - 1].day; }
  function dayInfo(data, day) { for (var i = 0; i < data.days.length; i++) if (data.days[i].day === day) return data.days[i]; return null; }
  /**
   * The day's card order. A card with `slot` (1-based) is pinned to that position; every other card is
   * shuffled by the seed into the free positions. A slot outside 1..n or already taken is ignored (card
   * gets shuffled). Days with no pinned cards give exactly the plain seeded shuffle.
   */
  function dayQueue(seed, data, day) {
    var cs = dayCandidates(data, day), n = cs.length, pinned = [], rest = [];
    cs.forEach(function (c) {
      var k = c.slot;
      if (typeof k === 'number' && k % 1 === 0 && k >= 1 && k <= n && !pinned[k - 1]) pinned[k - 1] = c.id;
      else rest.push(c.id);
    });
    rest = shuffle(rest, rngFor(seed, 'order', day));
    var q = [];
    for (var i = 0; i < n; i++) q.push(pinned[i] || rest.shift());
    return q;
  }

  /* ---------------- rules (one rule = one comparison row) ---------------- */
  function rulesList(data) { return (data.rules && data.rules.list) || []; }
  function listFor(data, name) {
    if (name === 'rivals') return (data.rivals || []).map(function (r) { return r.name; });
    return (data.lists && data.lists[name]) || [];
  }
  var CHECKS = {
    matches: function (c, p) { return new RegExp(p.pattern, p.flags || '').test(String(getField(c, p.field))); },
    notEmpty: function (c, p) { return String(getField(c, p.field)).trim() !== ''; },
    containsAny: function (c, p, data) {
      var v = String(getField(c, p.field)).toLowerCase();
      return listFor(data, p.list).some(function (n) { return n && v.indexOf(String(n).toLowerCase()) >= 0; });
    },
    ageMatchesBirth: function (c, p, data) {
      var am = String(getField(c, p.ageField)).match(/\d+/);
      var bm = String(getField(c, p.birthField)).match(new RegExp(p.birthPattern || '(\\d{4})'));
      if (!am || !bm) return true;
      var year = p.year || data.calendarYear || new Date().getFullYear();
      return Math.abs(year - parseInt(bm[1], 10) - parseInt(am[0], 10)) > (p.tolerance == null ? 1 : p.tolerance);
    }
  };
  function rowContradicts(c, rule, data) {
    var fn = CHECKS[rule.check && rule.check.type];
    if (!fn) throw new Error('Unknown rule check type: ' + (rule.check && rule.check.type));
    return !!fn(c, rule.check, data);
  }
  function ruleUnlocked(rule, day) { return rule.day <= day; }
  function ruleCounts(rule, data) { return !rule.violationIf || !!(data.rules && data.rules[rule.violationIf]); }
  function activeRules(data, day) { return rulesList(data).filter(function (r) { return ruleUnlocked(r, day); }); }
  /** ids of every row that contradicts the profile, regardless of day (used by data checks). */
  function contradictions(c, data) {
    return rulesList(data).filter(function (r) { return rowContradicts(c, r, data); }).map(function (r) { return r.id; });
  }
  /** ids of rules this candidate breaks on `day` (row unlocked + counts as a violation). */
  function violations(c, data, day) {
    return activeRules(data, day).filter(function (r) { return ruleCounts(r, data) && rowContradicts(c, r, data); }).map(function (r) { return r.id; });
  }

  /* ---------------- effects ---------------- */
  function effectsOf(c, data) {
    var B = data.balance || {}, dz = c.disguise ? (data.disguises || {})[c.disguise] : null;
    var now = {}, later = {};
    if (!(dz && dz.replaceBase)) addEffects(now, B.accept);
    if (dz) { addEffects(now, dz.accept); addEffects(later, dz.later); }
    addEffects(now, c.effects);
    addEffects(later, c.laterEffects);
    if (!c.disguise && c.nationality === 'Chinese' && now.stock > 0) now.stock *= B.chineseDateMultiplier || 1;
    return { now: now, later: later };
  }

  /* ---------------- state machine ---------------- */
  function clockOf(data) {
    var k = data.clock || {};
    return {
      start: toMinutes(k.start || '09:00'), end: toMinutes(k.end || '18:00'),
      review: k.reviewMinutes || 60, accept: k.acceptMinutes || 0, reject: k.rejectMinutes || 0
    };
  }
  function reviewCost(c, data) { return c.timeCost != null ? c.timeCost : clockOf(data).review; }
  function dataSignature(data) {
    // slot is part of the signature: pinning changes the day's queue, so a mid-day save from another order is invalid
    return hashStr([data.version, allCandidates(data).map(function (c) { return c.id + '@' + c.day + (c.slot != null ? '#' + c.slot : ''); }).join(','),
      rulesList(data).map(function (r) { return r.id + '@' + r.day; }).join(','),
      data.gauges.map(function (g) { return g.id; }).join(',')].join('|'));
  }
  function newGame(data, seed) {
    var g = {}, hist = {};
    data.gauges.forEach(function (d) { g[d.id] = d.start; hist[d.id] = [d.start]; });
    return {
      v: 1, sig: dataSignature(data), seed: seed, phase: 'intro', day: data.days[0].day, idx: 0,
      clock: clockOf(data).start, gauges: g, history: hist, pending: [], decisions: [],
      summary: null, over: null, endingId: null, peakStock: g.stock
    };
  }
  function validateSave(s, data) {
    return !!(s && s.v === 1 && s.sig === dataSignature(data) && s.gauges && s.history && s.decisions && s.phase);
  }
  function current(s, data) {
    if (s.phase !== 'desk') return null;
    var q = dayQueue(s.seed, data, s.day);
    return s.idx < q.length ? candidateById(data, q[s.idx]) : null;
  }
  function remaining(s, data) { return Math.max(0, dayQueue(s.seed, data, s.day).length - s.idx); }
  function openOrSettle(s, data) {
    var q = dayQueue(s.seed, data, s.day), k = clockOf(data);
    if (s.idx >= q.length) return settleDay(s, data);
    var c = candidateById(data, q[s.idx]);
    if (s.clock + reviewCost(c, data) > k.end) {
      for (var i = s.idx; i < q.length; i++) s.decisions.push({ id: q[i], day: s.day, accept: null, expired: true, violations: [] });
      s.idx = q.length;
      return settleDay(s, data);
    }
    return s;
  }
  function beginDay(state, data) {
    var s = clone(state);
    s.phase = 'desk'; s.idx = 0; s.clock = clockOf(data).start; s.summary = null;
    return openOrSettle(s, data);
  }
  function decide(state, data, accept) {
    var s = clone(state), c = current(s, data), k = clockOf(data);
    if (!c) return s;
    s.decisions.push({ id: c.id, day: s.day, accept: !!accept, violations: violations(c, data, s.day) });
    s.clock += reviewCost(c, data) + (accept ? k.accept : k.reject);
    s.idx++;
    s.peakStock = Math.max(s.peakStock, intraday(s, data).live);
    return openOrSettle(s, data);
  }

  function settleDay(s, data) {
    var day = s.day, last = lastDay(data), B = data.balance || {};
    var before = clone(s.gauges), delta = {}, events = [], citations = [];
    var cnt = { accepted: 0, rejected: 0, expired: 0 };

    // effects scheduled yesterday (e.g. insider probe)
    s.pending = s.pending.filter(function (p) {
      if (p.due !== day) return true;
      addEffects(delta, p.effects);
      events.push({ kind: 'later:' + (p.disguise || 'legit'), id: p.id });
      return false;
    });

    s.decisions.forEach(function (d) {
      if (d.day !== day) return;
      var c = candidateById(data, d.id), tag = c.disguise || 'legit';
      if (d.expired) { cnt.expired++; return; }
      if (d.accept) {
        cnt.accepted++;
        var e = effectsOf(c, data);
        addEffects(delta, e.now);
        if (!isEmptyObj(e.later)) {
          if (day < last) s.pending.push({ due: day + 1, id: c.id, disguise: c.disguise, effects: e.later });
          else { addEffects(delta, e.later); events.push({ kind: 'later:' + tag, id: c.id }); }
        }
        if (d.violations.length) { citations.push({ id: c.id, rules: d.violations.slice() }); addEffects(delta, B.citation, d.violations.length); }
        events.push({ kind: 'accept:' + tag, id: c.id });
      } else {
        cnt.rejected++;
        addEffects(delta, B.reject);
        events.push({ kind: 'reject:' + tag, id: c.id });
      }
    });
    if (cnt.expired) { addEffects(delta, B.expiredEach, cnt.expired); events.push({ kind: 'expired', n: cnt.expired }); }
    if (citations.length) events.push({ kind: 'citation', n: citations.length });
    addEffects(delta, B.daily);
    var chinaDates = s.decisions.filter(function (d) {
      var c = candidateById(data, d.id);
      return d.day === day && d.accept && c.nationality === 'Chinese';
    }).length;
    if (chinaDates && rngFor(s.seed, 'trump', day)() < 0.5) {
      addEffects(delta, { stock: -(B.trumpShock || 8) });
      events.push({ kind: 'trumpCall' });
    }
    delta.suspicion = Math.max(0, delta.suspicion || 0);

    data.gauges.forEach(function (g) {
      var lo = g.min == null ? 0 : g.min, hi = g.max == null ? 100 : g.max;
      s.gauges[g.id] = clamp(Math.round(before[g.id] + (delta[g.id] || 0)), lo, hi);
      s.history[g.id].push(s.gauges[g.id]);
    });
    data.gauges.forEach(function (g) {
      // warn = past the line, or (warnRise) moved that far the bad way in one day — news only, gauges untouched
      var worse = (s.gauges[g.id] - before[g.id]) * (g.good === 'high' ? -1 : 1);
      if (testThreshold(g.warn, s.gauges[g.id]) || (g.warnRise != null && worse >= g.warnRise)) events.push({ kind: 'warn:' + g.id });
      if (!s.over && testThreshold(g.gameOver, s.gauges[g.id])) s.over = g.id;
    });
    var sg = (data.stockDisplay || {}).gauge;
    s.peakStock = Math.max(s.peakStock, s.gauges[sg]);
    if (s.over === 'suspicion' && sg) {
      var display = data.stockDisplay || {};
      var crashedPrice = priceOf(s.gauges[sg], data) * (B.firingStockMultiplier || 0.35);
      s.gauges[sg] = (crashedPrice - (display.base || 0)) / (display.perPoint || 1);
      s.history[sg][s.history[sg].length - 1] = s.gauges[sg];
      events.push({ kind: 'fired' });
    }
    if (sg && s.gauges[sg] != null) {
      var dv = s.gauges[sg] - before[sg];
      if (dv >= 5) events.push({ kind: 'stockUp' }); else if (dv <= -5) events.push({ kind: 'stockDown' });
    }

    s.summary = {
      day: day, before: before, after: clone(s.gauges), counts: cnt, citations: citations,
      headlines: buildHeadlines(events, s, data, day), over: s.over,
      trumpCall: events.some(function (event) { return event.kind === 'trumpCall'; })
    };
    s.phase = 'summary';
    return s;
  }

  function buildHeadlines(events, s, data, day) {
    var N = data.news || {}, T = N.templates || {}, P = N.priority || {};
    var rng = rngFor(s.seed, 'news', day), pool = [], seen = {};
    var vars = { ceo: data.ceoName, price: priceLabel(s, data) };
    events.forEach(function (ev) {
      var c = ev.id ? candidateById(data, ev.id) : null;
      var verb = ev.kind.split(':')[0];
      var text = (c && c.news && c.news[verb]) || pick(T[ev.kind], rng);
      if (!text) return;
      var v = { ceo: vars.ceo, price: vars.price, n: ev.n, name: c ? c.profile.name : '', job: c ? c.profile.job : '' };
      pool.push({ text: fill(text, v), pri: P[ev.kind] != null ? P[ev.kind] : (P['default'] || 1), r: rng() });
    });
    pool.sort(function (a, b) { return (b.pri - a.pri) || (a.r - b.r); });
    var out = [];
    pool.forEach(function (h) { if (out.length < (N.maxPerDay || 3) && !seen[h.text]) { seen[h.text] = 1; out.push(h.text); } });
    var fillers = shuffle(T.filler || [], rng);
    for (var i = 0; out.length < (N.minPerDay || 2) && i < fillers.length; i++) {
      var f = fill(fillers[i], vars);
      if (!seen[f]) { seen[f] = 1; out.push(f); }
    }
    return out;
  }

  function advance(state, data) {
    var s = clone(state);
    if (s.phase !== 'summary') return s;
    if (s.over) { s.phase = 'ending'; s.endingId = pickEnding(s, data).id; return s; }
    var info = dayInfo(data, s.day);
    if (s.day >= lastDay(data) || (info && info.keynote)) { s.phase = 'keynote'; return s; }
    s.day += 1; s.phase = 'intro'; s.idx = 0; s.clock = clockOf(data).start;
    return s;
  }
  function finishKeynote(state, data) {
    var s = clone(state);
    s.phase = 'ending'; s.endingId = pickEnding(s, data).id;
    return s;
  }

  /* ---------------- stats & endings ---------------- */
  function stats(s, data) {
    var st = { accepted: 0, rejected: 0, expired: 0, citations: 0, legitAccepted: 0, legitRejected: 0 };
    Object.keys(data.disguises || {}).forEach(function (d) { st[d + 'Accepted'] = 0; st[d + 'Rejected'] = 0; });
    s.decisions.forEach(function (dc) {
      var c = candidateById(data, dc.id), tag = (c && c.disguise) || 'legit';
      if (dc.expired) { st.expired++; return; }
      if (dc.accept) { st.accepted++; st[tag + 'Accepted'] = (st[tag + 'Accepted'] || 0) + 1; if (dc.violations.length) st.citations++; }
      else { st.rejected++; st[tag + 'Rejected'] = (st[tag + 'Rejected'] || 0) + 1; }
    });
    return st;
  }
  function endingContext(s, data) {
    var ctx = stats(s, data);
    for (var k in s.gauges) ctx[k] = s.gauges[k];
    ctx.peakStock = s.peakStock;
    ctx.gameOver = s.over || null;
    ctx.daysPlayed = s.day;
    return ctx;
  }
  function matchWhen(when, ctx) {
    for (var k in when) {
      if (!Object.prototype.hasOwnProperty.call(when, k)) continue;
      var w = when[k], v = ctx[k];
      if (Array.isArray(w)) { if (typeof v !== 'number' || v < w[0] || v > w[1]) return false; }
      else if (v !== w) return false;
    }
    return true;
  }
  function pickEnding(s, data) {
    var ctx = endingContext(s, data), E = data.endings;
    for (var i = 0; i < E.length; i++) if (matchWhen(E[i].when || {}, ctx)) return E[i];
    return E[E.length - 1];
  }
  function endingById(data, id) { for (var i = 0; i < data.endings.length; i++) if (data.endings[i].id === id) return data.endings[i]; return null; }

  /* ---------------- stock display ---------------- */
  function priceOf(v, data) { var d = data.stockDisplay || {}; return (d.base || 0) + v * (d.perPoint == null ? 1 : d.perPoint); }
  function priceLabel(s, data) {
    var d = data.stockDisplay || {};
    return (d.prefix || '') + Math.round(priceOf(s.gauges[d.gauge], data));
  }
  function pctChange(from, to, data) {
    var a = priceOf(from, data), b = priceOf(to, data);
    return a ? ((b - a) / a) * 100 : 0;
  }
  /**
   * Today's stock ticks for the desktop stock window (display only — gauges still settle at day end).
   * One point per decision at the clock time it finished; an accept moves the price by that
   * candidate's immediate stock effect, a decline leaves it flat. After the day settles a 'close'
   * point at end-of-day carries the settled value (daily drift, probes, citations land there).
   */
  function intraday(s, data) {
    var sg = (data.stockDisplay || {}).gauge, k = clockOf(data);
    if (!sg || !s || !s.gauges || s.gauges[sg] == null) return null;
    var settled = s.phase === 'summary' || s.phase === 'keynote' || s.phase === 'ending';
    var open = settled && s.summary ? s.summary.before[sg] : s.gauges[sg];
    var t = k.start, v = open, points = [{ t: t, v: v, kind: 'open' }];
    (s.decisions || []).forEach(function (d) {
      if (d.day !== s.day || d.expired) return;
      var c = candidateById(data, d.id);
      if (!c) return;
      t += reviewCost(c, data) + (d.accept ? k.accept : k.reject);
      if (d.accept) v += effectsOf(c, data).now[sg] || 0;
      points.push({ t: Math.min(t, k.end), v: v, kind: d.accept ? 'accept' : 'decline', id: d.id });
    });
    if (settled) points.push({ t: k.end, v: s.gauges[sg], kind: 'close' });
    var last = points[points.length - 1];
    return { gauge: sg, open: open, live: last.v, now: settled ? k.end : Math.min(s.clock, k.end), start: k.start, end: k.end, closed: settled, points: points };
  }
  /** gauge value as the player should see it right now (stock moves intraday on the desk). */
  function liveValue(s, data, id) {
    if (s && s.phase === 'desk' && id === (data.stockDisplay || {}).gauge) { var d = intraday(s, data); if (d) return d.live; }
    return s.gauges[id];
  }

  /* ---------------- autoplay strategies (sim + debug screenshots) ---------------- */
  var STRATEGIES = {
    acceptAll: function () { return true; },
    rejectAll: function () { return false; },
    ruleFollower: function (c, s, data) { return violations(c, data, s.day).length === 0; },
    truthReader: function (c) { return !c.disguise; },
    // ruleFollower that also skips higher-risk legit partners (suspicion extra >= 3)
    choosy: function (c, s, data) {
      return violations(c, data, s.day).length === 0 && !c.disguise && !((c.effects || {}).suspicion >= 3);
    }
  };
  /** play from `state` with strategy until stop(state) is true or the game ends. */
  function autoplay(state, data, strategy, stop) {
    var s = state, guard = 0;
    while (s.phase !== 'ending' && guard++ < 1000) {
      if (stop && stop(s)) return s;
      if (s.phase === 'intro') s = beginDay(s, data);
      else if (s.phase === 'desk') { var c = current(s, data); s = decide(s, data, strategy(c, s, data)); }
      else if (s.phase === 'summary') s = advance(s, data);
      else if (s.phase === 'keynote') s = finishKeynote(s, data);
      else break;
    }
    return s;
  }

  /* ---------------- data consistency checks ---------------- */
  function validateData(data, opts) {
    opts = opts || {};
    var errors = [], warnings = [];
    var REPORT_MAX = opts.reportMax || 17, PROFILE_MAX = opts.profileMax || 49;
    var gaugeIds = {}; data.gauges.forEach(function (g) { gaugeIds[g.id] = 1; });
    var rules = rulesList(data), byCatch = {};
    function checkEff(where, eff) { for (var k in (eff || {})) if (!gaugeIds[k]) errors.push(where + ': unknown gauge "' + k + '"'); }

    rules.forEach(function (r) {
      if (!CHECKS[r.check && r.check.type]) errors.push('rule ' + r.id + ': unknown check type');
      if (r.catches) {
        if (!(data.disguises || {})[r.catches]) errors.push('rule ' + r.id + ': catches unknown disguise ' + r.catches);
        byCatch[r.catches] = r;
      }
      if (r.violationIf && !(data.rules && r.violationIf in data.rules)) errors.push('rule ' + r.id + ': violationIf "' + r.violationIf + '" missing in rules');
    });
    Object.keys(data.disguises || {}).forEach(function (d) {
      if (!byCatch[d]) errors.push('disguise ' + d + ': no rule row catches it');
      checkEff('disguise ' + d + '.accept', data.disguises[d].accept);
      checkEff('disguise ' + d + '.later', data.disguises[d].later);
    });
    ['accept', 'reject', 'expiredEach', 'citation', 'daily'].forEach(function (k) { checkEff('balance.' + k, (data.balance || {})[k]); });

    var ids = {}, perDay = {}, firstDay = {};
    var credits = {}; (data.credits || []).forEach(function (cr) { credits[cr.id] = cr; });
    allCandidates(data).forEach(function (c) {
      var where = 'candidate ' + c.id;
      if (ids[c.id]) errors.push(where + ': duplicate id'); ids[c.id] = 1;
      if (!dayInfo(data, c.day)) errors.push(where + ': day ' + c.day + ' not in days[]');
      perDay[c.day] = (perDay[c.day] || 0) + 1;
      if (!c.profile || !c.profile.name || !c.profile.intro) errors.push(where + ': profile.name/intro required');
      if (!Array.isArray(c.chat) || c.chat.length < 1 || c.chat.length > 3) errors.push(where + ': chat must have 1-3 entries');
      rules.forEach(function (r) {
        var pv = String(getField(c.profile || {}, r.profileField)), rv = String(getField(c.report || {}, r.reportField));
        if (!pv) errors.push(where + ': profile.' + r.profileField + ' empty');
        if (pv.length > PROFILE_MAX) errors.push(where + ': profile.' + r.profileField + ' is ' + pv.length + ' chars (max ' + PROFILE_MAX + '): "' + pv + '"');
        var shown = rv || r.emptyText || '';
        if (shown.length > REPORT_MAX) errors.push(where + ': report.' + r.reportField + ' is ' + shown.length + ' chars (max ' + REPORT_MAX + '): "' + shown + '"');
      });
      ['name', 'intro'].forEach(function (f) {
        var v = String((c.profile || {})[f] || '');
        if (v.length > PROFILE_MAX) errors.push(where + ': profile.' + f + ' is ' + v.length + ' chars (max ' + PROFILE_MAX + ')');
      });
      checkEff(where + '.effects', c.effects);
      if (c.cameo && !credits[c.cameo]) errors.push(where + ': cameo "' + c.cameo + '" has no credits entry');

      var contra = contradictions(c, data);
      if (!c.disguise) {
        if (contra.length) errors.push(where + ': legit candidate has contradicting row(s) ' + contra.join(','));
        if (!(c.effects && c.effects.stock > 0)) errors.push(where + ': legit candidate needs effects.stock > 0 (reason to accept)');
      } else {
        var dz = (data.disguises || {})[c.disguise], rule = byCatch[c.disguise];
        if (!dz) { errors.push(where + ': unknown disguise ' + c.disguise); return; }
        if (!rule) return;
        if (contra.length !== 1 || contra[0] !== rule.id) errors.push(where + ': ' + c.disguise + ' must contradict exactly row ' + rule.id + ' (got ' + (contra.join(',') || 'none') + ')');
        if (c.day < rule.day) errors.push(where + ': ' + c.disguise + ' appears on day ' + c.day + ' before row ' + rule.id + ' unlocks (day ' + rule.day + ')');
        firstDay[c.disguise] = Math.min(firstDay[c.disguise] || 99, c.day);
      }
    });
    data.days.forEach(function (d) {
      if (!perDay[d.day]) errors.push('day ' + d.day + ': no candidates');
      else if (perDay[d.day] !== 6) warnings.push('day ' + d.day + ': ' + perDay[d.day] + ' candidates (design says 6)');
    });
    var statNames = { accepted: 1, rejected: 1, expired: 1, citations: 1, legitAccepted: 1, legitRejected: 1, gameOver: 1, daysPlayed: 1, peakStock: 1 };
    Object.keys(data.disguises || {}).forEach(function (d) { statNames[d + 'Accepted'] = 1; statNames[d + 'Rejected'] = 1; });
    (data.endings || []).forEach(function (e) {
      for (var k in (e.when || {})) if (!gaugeIds[k] && !statNames[k]) errors.push('ending ' + e.id + ': unknown condition key ' + k);
    });
    if (!data.endings || !data.endings.length || !isEmptyObj(data.endings[data.endings.length - 1].when)) warnings.push('last ending should be a catch-all (when: {})');
    return { errors: errors, warnings: warnings, firstDay: firstDay, perDay: perDay };
  }

  var api = {
    mulberry32: mulberry32, hashStr: hashStr, rngFor: rngFor, shuffle: shuffle, randomSeed: randomSeed,
    clone: clone, fill: fill, getField: getField, toMinutes: toMinutes, fmtClock: fmtClock, gaugeDef: gaugeDef,
    allCandidates: allCandidates, candidateById: candidateById, dayCandidates: dayCandidates, dayInfo: dayInfo,
    lastDay: lastDay, dayQueue: dayQueue,
    rulesList: rulesList, activeRules: activeRules, ruleCounts: ruleCounts, rowContradicts: rowContradicts,
    contradictions: contradictions, violations: violations, effectsOf: effectsOf,
    clockOf: clockOf, reviewCost: reviewCost, dataSignature: dataSignature,
    newGame: newGame, validateSave: validateSave, beginDay: beginDay, current: current, remaining: remaining,
    decide: decide, advance: advance, finishKeynote: finishKeynote, settleDay: settleDay,
    stats: stats, endingContext: endingContext, matchWhen: matchWhen, pickEnding: pickEnding, endingById: endingById,
    priceOf: priceOf, priceLabel: priceLabel, pctChange: pctChange, intraday: intraday, liveValue: liveValue,
    STRATEGIES: STRATEGIES, autoplay: autoplay, validateData: validateData
  };
  root.MVLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
