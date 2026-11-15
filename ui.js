/*
 * ui.js — every DOM read/write lives here (render + input + localStorage + timers).
 * Layout follows wireframe v3 (status bar → gauges → rule chips → request card → 2-column grid → Decline/Accept).
 * Skin: gold "second phone" case, Swipr dating app, fixer dossier, MVDA terminal, Johnson's reaction cam.
 * To re-skin: replace this file + style.css. game.js (logic) and data.js (content) stay untouched.
 *
 * Skin-only words (badges like LIVE / BREAKING) read data.ui first and fall back to the English default
 * here — see sk(). Add the key to data.ui to change them without touching this file.
 */
(function () {
  'use strict';
  var D = window.GAME_DATA, L = window.MVLogic, U = D.ui, S = window.MVSfx;
  var SAVE_KEY = 'mvidia-ceo-sim/save/v1';
  var app = document.getElementById('app');
  var stockEl = document.getElementById('ticker'); // desktop stock window (optional)
  var camEl = document.getElementById('cam');      // desktop reaction cam (optional)
  var state = null;
  var view = { overlay: null, restartArmed: false, busy: false, debug: false, mood: null, react: null, dv: 0, lastStock: null, screenKey: null, shownAt: 0, reply: null };
  var timers = [];
  var loaded = {}; // image src → true once it has loaded at least once (re-rendered art shows instantly, no placeholder flash)
  var BIG_MOVE = 4; // stock points: an accept that moves the price this much = "big" (happy face, terminal shake)

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function t(key, vars) { return L.fill(U[key] != null ? U[key] : key, vars); }
  function sk(key, fallback) { return U[key] != null ? U[key] : fallback; } // skin-only badge words
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n); }
  function pctText(p) { var a = Math.abs(p); return (p >= 0 ? '▲ ' : '▼ ') + (a >= 10 ? a.toFixed(0) : a.toFixed(1)) + '%'; }
  function ruleById(id) { return L.rulesList(D).filter(function (r) { return r.id === id; })[0]; }
  function rivalNames() { return (D.rivals || []).map(function (r) { return r.name; }).join(', '); }
  function hueOf(id) { return L.hashStr(id) % 360; }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

  /* ---------------- storage ---------------- */
  function save() {
    if (view.debug || !state) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked: play without saving */ }
  }
  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      return L.validateSave(s, D) ? s : null;
    } catch (e) { return null; }
  }
  function wipeSave() { if (view.debug) return; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  /* ---------------- pieces ---------------- */
  function imgTag(src, cls) { return src ? '<img class="' + cls + (loaded[src] ? ' ok' : '') + '" src="' + esc(src) + '" alt="" draggable="false">' : ''; }

  /* visual clue stickers on the profile photo (data: candidate.clue). Drawn the same for real people and fakes
   * — some real people carry decoys — so the sticker itself never tells you which one you're looking at. No text. */
  var INK = '#1d1a24';
  var CLUES = {
    earpiece: { label: 'earpiece', svg: '<svg viewBox="0 0 40 44"><path d="M17 18q7 3 4 8t4 7q6 2 2 7" fill="none" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/><path d="M17 18q7 3 4 8t4 7q6 2 2 7" fill="none" stroke="#cfe9f5" stroke-width="2.6" stroke-linecap="round"/><circle cx="13" cy="12" r="8.5" fill="#2a2632" stroke="' + INK + '" stroke-width="3"/><circle cx="10.5" cy="9.5" r="2.4" fill="#9b95a8"/></svg>' },
    neckSeam: { label: 'neck seam', svg: '<svg viewBox="0 0 64 22"><path d="M7 11Q32 17 57 11" fill="none" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/><path d="M7 11Q32 17 57 11" fill="none" stroke="#6ff3ff" stroke-width="2.4" stroke-dasharray="4 3" stroke-linecap="round"/><circle cx="7" cy="11" r="5.5" fill="#c9ccd4" stroke="' + INK + '" stroke-width="2.6"/><path d="M4 11h6M7 8v6" stroke="' + INK + '" stroke-width="1.8"/><circle cx="57" cy="11" r="5.5" fill="#c9ccd4" stroke="' + INK + '" stroke-width="2.6"/><path d="M54 11h6M57 8v6" stroke="' + INK + '" stroke-width="1.8"/></svg>' },
    rivalBadge: { label: 'rival badge', svg: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#e8402f" stroke="' + INK + '" stroke-width="3"/><circle cx="20" cy="20" r="10" fill="#fff6e0" stroke="' + INK + '" stroke-width="2.2"/><path d="M17 12.5v3M20 12.5v3M23 12.5v3M17 24.5v3M20 24.5v3M23 24.5v3M12.5 17h3M12.5 20h3M12.5 23h3M24.5 17h3M24.5 20h3M24.5 23h3" stroke="' + INK + '" stroke-width="1.6"/><rect x="15" y="15" width="10" height="10" rx="1.5" fill="#2f6be8" stroke="' + INK + '" stroke-width="2"/><path d="M10 11a13 13 0 0 1 7-5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".8"/></svg>' },
    weddingRing: { label: 'wedding ring', svg: '<svg viewBox="0 0 40 40"><ellipse cx="20" cy="26" rx="11.5" ry="9" fill="none" stroke="' + INK + '" stroke-width="7.5"/><ellipse cx="20" cy="26" rx="11.5" ry="9" fill="none" stroke="#f5c542" stroke-width="3.6"/><path d="M14.5 14l5.5-8 5.5 8-5.5 4z" fill="#d9f6ff" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/><path d="M32 5v7M28.5 8.5h7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>' },
    lanyard: { label: 'lanyard', svg: '<svg viewBox="0 0 40 48"><path d="M7 0L18 21M33 0L22 21" stroke="' + INK + '" stroke-width="7.5" stroke-linecap="round"/><path d="M7 0L18 21M33 0L22 21" stroke="#8a2be2" stroke-width="3.6" stroke-linecap="round"/><rect x="15.5" y="18" width="9" height="7" rx="1.8" fill="#c9ccd4" stroke="' + INK + '" stroke-width="2.2"/><rect x="8.5" y="24" width="23" height="22" rx="3" fill="#fbf3e4" stroke="' + INK + '" stroke-width="2.6"/><path d="M9.8 25.3h20.4v3.6H9.8z" fill="#76b900"/><rect x="11.5" y="31" width="7" height="8" rx="1" fill="#8fa39b" stroke="' + INK + '" stroke-width="1.6"/><path d="M21 32h7M21 35.5h5M12 42.5h16" stroke="' + INK + '" stroke-width="1.8" stroke-linecap="round"/></svg>' }
  };
  function clueHtml(c) {
    var k = c.clue || view.debugClue, cl = k && CLUES.hasOwnProperty(k) ? CLUES[k] : null;
    return cl ? '<i class="clue clue-' + k + '" role="img" aria-label="' + esc(cl.label) + '">' + cl.svg + '</i>' : '';
  }

  function faceHtml(c) {
    var initial = (c.profile.name || '?').charAt(0).toUpperCase();
    return '<div class="face" style="--hue:' + hueOf(c.id) + '"><span class="ph">' + esc(initial) + '</span>' + imgTag(c.image, 'art') + clueHtml(c) + '</div>';
  }

  function ceoHtml(mood, extra) {
    var src = (D.art && D.art.ceo && D.art.ceo[mood]) || '';
    return '<div class="ceo mood-' + esc(mood) + ' ' + (extra || '') + '" role="img" aria-label="' + esc(D.ceoName) + '">' +
      '<div class="ceo-ph" aria-hidden="true"><i class="jacket"></i><i class="collar"></i><i class="neck"></i><i class="head"></i><i class="hair"></i>' +
      '<i class="brow l"></i><i class="brow r"></i><i class="eye l"></i><i class="eye r"></i><i class="mouth"></i></div>' + imgTag(src, 'art') + '</div>';
  }

  function sparkline(values) {
    var v = values.length > 1 ? values : [values[0], values[0]];
    var min = Math.min.apply(null, v), max = Math.max.apply(null, v), span = max - min || 1;
    var pts = v.map(function (x, i) { return (i * 60 / (v.length - 1)).toFixed(1) + ',' + (10.5 - ((x - min) / span) * 9).toFixed(1); }).join(' ');
    if (max === min) pts = '0,6 60,6';
    return '<svg class="spark" viewBox="0 0 60 12" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '"/></svg>';
  }

  function past(th, v) { return !!th && ((th.gte != null && v >= th.gte) || (th.lte != null && v <= th.lte)); }
  // one colour language for every gauge: ok (safe) → mid (careful) → hot (past the gauge's warn line)
  function gaugeLevel(g, v) {
    var lo = g.min == null ? 0 : g.min, hi = g.max == null ? 100 : g.max;
    var bad = g.good === 'low' ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo);
    if (past(g.warn, v) || past(g.gameOver, v) || (!g.warn && bad >= 0.7)) return 'hot';
    return bad >= 0.35 ? 'mid' : 'ok';
  }
  function anyHot(s) {
    return !!s && D.gauges.some(function (g) { return g.display !== 'trend' && gaugeLevel(g, s.gauges[g.id]) === 'hot'; });
  }

  // phone status bar: the in-game clock IS the phone clock; "n left" rides next to it; battery drains through the day
  function soundButton() { return '<button class="sound-toggle" data-act="sound" aria-label="Sound effects" aria-pressed="' + S.enabled() + '">SFX ' + (S.enabled() ? 'ON' : 'OFF') + '</button>'; }
  function musicControls() { if (S.recordingMode()) return '<div class="music-controls"><span class="sound-toggle">RECORDING · BGM OFF</span></div>'; return '<div class="music-controls"><button class="sound-toggle" data-act="music" aria-label="Background music" aria-pressed="' + S.musicEnabled() + '">BGM ' + (S.musicEnabled() ? 'ON' : 'OFF') + '</button><label>VOL <input data-music-volume type="range" min="0" max="100" value="' + Math.round(S.musicVolume() * 100) + '" aria-label="Music volume"></label></div>'; }
  function statusBarHtml(clockMin, leftText) {
    var k = L.clockOf(D), frac = 1 - Math.max(0, Math.min(1, (clockMin - k.start) / ((k.end - k.start) || 1))) * 0.85;
    var b = Math.round(frac * 100);
    return '<div class="statusbar"><span class="sb-time">' + esc(L.fmtClock(clockMin)) + '</span>' +
      (leftText ? '<span class="sb-left">' + esc(leftText) + '</span>' : '') +
      '<i class="island" aria-hidden="true"><i></i></i>' +
      soundButton() + '</div>';
  }

  function moneyDelta(dv) { var sd = D.stockDisplay; return (dv > 0 ? '+' : '−') + (sd.prefix || '') + Math.abs(Math.round(dv * (sd.perPoint == null ? 1 : sd.perPoint))); }

  function gaugesHtml(s) {
    var cols = D.gauges.filter(function (g) { return g.display !== 'hidden'; }).map(function (g) { return g.display === 'trend' ? '1.1fr' : '1fr'; }).join(' ');
    var h = '<div class="gauges" style="grid-template-columns:' + cols + '">';
    D.gauges.filter(function (g) { return g.display !== 'hidden'; }).forEach(function (g) {
      var v = L.liveValue(s, D, g.id), lo = g.min == null ? 0 : g.min, hi = g.max == null ? 100 : g.max;
      if (g.display === 'trend') {
        var hist = s.history[g.id], p = L.pctChange(hist[0], v, D);
        var line = s.phase === 'desk' ? hist.concat([v]) : hist;
        var bump = view.dv ? ' bump ' + (view.dv > 0 ? 'b-up' : 'b-down') : '';
        h += '<div class="g trend' + bump + '"><div class="t"><span>' + esc(g.label) + '</span><span class="' + (p < 0 ? 'down' : 'up') + '">' + esc(pctText(p)) + '</span></div>' + sparkline(line) +
          (view.dv ? '<span class="pop ' + (view.dv > 0 ? 'up' : 'down') + '" aria-hidden="true">' + esc(moneyDelta(view.dv)) + '</span>' : '') + '</div>';
      } else {
        // bar length = the number itself (Security 100 = full bar, Suspicion 0 = empty); colour = how dangerous it is
        var fill = Math.round(Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100);
        h += '<div class="g meter ' + gaugeLevel(g, v) + '"><div class="t"><span>' + esc(g.label) + '</span><span>' + v + '</span></div>' +
          '<div class="bar" role="meter" aria-label="' + esc(g.label) + '" aria-valuemin="' + lo + '" aria-valuemax="' + hi + '" aria-valuenow="' + v + '"><i style="width:' + fill + '%"></i></div></div>';
      }
    });
    return h + '</div>';
  }

  // chip = what to compare only (never the consequence)
  function chipHtml(rule, isNew) {
    return '<span class="chip' + (isNew ? ' new' : '') + '"><b>' + rule.id + '</b>' + esc(rule.chip) + '</span>';
  }
  function ruleDesc(rule) {
    return esc(L.fill(rule.desc, { rivals: rivalNames() })) + (L.ruleCounts(rule, D) ? '' : ' <em class="muted">' + esc(U.advisory) + '</em>');
  }

  function rulesBarHtml(day) {
    var act = L.activeRules(D, day);
    var fresh = act.filter(function (r) { return r.day === day; });
    var past = act.filter(function (r) { return r.day < day; });
    var h = '<div class="rulewrap"><div class="rules">';
    h += fresh.length ? fresh.map(function (r) { return chipHtml(r, true); }).join('') : '<span class="chip new">' + esc(U.noNewRule) + '</span>';
    if (past.length) h += '<button class="chipbtn" data-act="rules" aria-expanded="' + (view.overlay === 'rules') + '"><span class="chip more">' + esc(t('earlierRules', { n: past.length })) + ' ▾</span></button>';
    h += '<button class="menubtn" data-act="menu" aria-label="' + esc(U.menu) + '"><span>···</span></button>';
    h += '</div>';
    if (view.overlay === 'rules') {
      h += '<div class="drop" role="dialog">' + act.map(function (r) {
        return '<div class="drop-row">' + chipHtml(r, r.day === day) + '<p>' + ruleDesc(r) + '</p></div>';
      }).join('') + '</div>';
    }
    return h + '</div>';
  }

  function chatHtml(c) {
    return c.chat.map(function (m) {
      return typeof m === 'string' ? '<p class="bubble">' + esc(m) + '</p>' : '<p class="sys">' + esc(m.sys) + '</p>';
    }).join('');
  }

  function sceneHtml(scene) {
    if (scene === 'living') return '<svg viewBox="0 0 320 110" role="img" aria-label="Illustration: green sofa beside a yellow duck lamp"><rect width="320" height="110" fill="#c3afa0"/><path d="M0 85H320V110H0" fill="#745e50"/><rect x="30" y="49" width="182" height="45" rx="8" fill="#355e4b"/><rect x="42" y="35" width="73" height="39" rx="8" fill="#49745b"/><rect x="119" y="35" width="79" height="39" rx="8" fill="#49745b"/><path d="M258 60V94M238 95H279" stroke="#594231" stroke-width="5"/><ellipse cx="258" cy="46" rx="23" ry="15" fill="#efca56"/><circle cx="274" cy="29" r="13" fill="#efca56"/><path d="M284 28L302 34L284 37" fill="#dc793c"/><circle cx="277" cy="26" r="2" fill="#302923"/></svg>';
    return '<svg viewBox="0 0 320 110" role="img" aria-label="Illustration: courtroom interpreter booth and headset"><rect width="320" height="110" fill="#b3b4ac"/><path d="M10 85H310V110H10" fill="#775c46"/><rect x="30" y="12" width="122" height="68" fill="#829ea0" stroke="#e0d8c5" stroke-width="5"/><path d="M91 12V80M30 46H152" stroke="#e0d8c5" stroke-width="4"/><path d="M199 65V45A26 26 0 0 1 251 45V65" fill="none" stroke="#323b40" stroke-width="8"/><rect x="190" y="51" width="13" height="26" rx="5" fill="#323b40"/><rect x="247" y="51" width="13" height="26" rx="5" fill="#323b40"/><path d="M255 72Q255 88 231 86" fill="none" stroke="#323b40" stroke-width="4"/></svg>';
  }

  function docsHtml(c, day) {
    if (c.evidence) return '<div class="evidence-pack" aria-label="Messages and photos">' + c.evidence.items.map(function (item) {
      return '<article class="evidence-item"><strong>' + esc(item.source) + '</strong>' + (item.scene ? sceneHtml(item.scene) : '') + '<p>' + esc(item.text) + '</p></article>';
    }).join('') + '</div>';
    var h = '<div class="docs"><div class="h h0"></div><div class="h d1"><span>' + esc(U.profile) + '</span></div><div class="h d3"><span class="stamp">' + esc(U.report) + '</span></div>';
    L.rulesList(D).forEach(function (r) {
      // locked row = redacted (keeps its height, so the grid never jumps when a row unlocks)
      if (r.day > day) { h += '<div class="l lock"><b>' + r.id + '</b></div><div class="empty" aria-label="locked"><i></i><i></i></div>'; return; }
      var pv = L.getField(c.profile, r.profileField), rv = L.getField(c.report, r.reportField) || r.emptyText || '';
      h += '<div class="l' + (r.day === day ? ' new' : '') + '"><b>' + r.id + '</b><span>' + esc(r.profileLabel) + '</span></div>' +
        '<div class="c d1">' + esc(pv) + '</div>' +
        '<div class="c d3"><small>' + esc(r.reportLabel) + '</small><span class="rv">' + esc(rv) + '</span></div>';
    });
    return h + '</div>';
  }

  function overlayHtml() {
    if (view.overlay === 'evidence') return '<div class="overlay"><div class="sheet evidence-result" role="dialog" aria-modal="true" aria-label="What connected">' + soundButton() + '<h2>' + esc(view.verdict) + '</h2><p>' + esc(view.evidenceExplanation) + '</p><button class="btn ok" data-act="close">Continue</button></div></div>';
    if (view.overlay === 'menu') {
      return '<div class="overlay" data-act="close"><div class="sheet" data-stop="1">' +
        soundButton() + '<p class="muted">' + esc(t('seed', { seed: state ? state.seed : '-' })) + '</p>' +
        '<button class="btn" data-act="credits">' + esc(U.credits) + '</button>' +
        '<button class="btn danger" data-act="restart">' + esc(view.restartArmed ? U.restartConfirm : U.restart) + '</button>' +
        '<button class="btn ok" data-act="close">' + esc(U.close) + '</button></div></div>';
    }
    if (view.overlay === 'credits') {
      return '<div class="overlay" data-act="close"><div class="sheet" data-stop="1"><p><b>' + esc(U.creditsIntro) + '</b></p><ul class="credits">' +
        (D.credits || []).map(function (cr) {
          return '<li>' + esc(cr.name) + ' — <a href="' + esc(cr.source) + '" target="_blank" rel="noopener">Commons</a> · ' + esc(cr.license) + '</li>';
        }).join('') + '</ul><p class="muted">' + esc(U.disclaimer) + '</p><button class="btn ok" data-act="close">' + esc(U.close) + '</button></div></div>';
    }
    return '';
  }

  /* ---------------- Johnson's mood (reaction face) ----------------
   * One mood for every reactive face (desktop cam beside the phone, avatar between the phone buttons,
   * news TV): accept → smug for a beat, big stock jump → happy, anything red / caught → shocked, else neutral.
   * End-of-day and ending screens use their own mood (summaryMood / ending.mood). Mood change = tiny bounce. */
  function summaryMood(sm) {
    if (sm.over) return 'shocked';
    var worse = D.gauges.some(function (g) {
      var d = sm.after[g.id] - sm.before[g.id];
      return (g.good === 'low' && d >= 15) || (g.good === 'high' && g.display !== 'trend' && d <= -10);
    });
    if (worse || sm.citations.length) return 'shocked';
    var sg = D.stockDisplay.gauge;
    return sm.after[sg] > sm.before[sg] ? 'happy' : 'smug';
  }
  function currentEnding() { return L.endingById(D, state.endingId) || L.pickEnding(state, D); }
  function screenMood() {
    if (!state) return 'smug';
    switch (state.phase) {
      case 'ending': return currentEnding().mood || (state.over ? 'shocked' : 'neutral');
      case 'summary': return state.summary ? summaryMood(state.summary) : 'neutral';
      case 'keynote': return view.keynoteRaised ? 'neutral' : 'smug';
    }
    return state.over || anyHot(state) ? 'shocked' : 'neutral';
  }
  function currentMood() { return view.react && state && state.phase === 'desk' ? view.react : screenMood(); }
  function swapCeoArt(ceo, mood) {
    var img = ceo.querySelector('img.art'), src = (D.art && D.art.ceo && D.art.ceo[mood]) || '';
    if (img && src && img.getAttribute('src') !== src) img.src = src;
  }
  // bring every reactive face in line with the current mood; bounce them if the mood just changed
  function syncMood() {
    var m = currentMood(), changed = view.mood != null && m !== view.mood;
    view.mood = m;
    Array.prototype.forEach.call(document.querySelectorAll('.ceo.react'), function (el) {
      if (!el.classList.contains('mood-' + m)) { el.className = el.className.replace(/mood-\w+/, 'mood-' + m); swapCeoArt(el, m); }
      if (changed) { el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce'); }
    });
  }
  function react(mood, ms) {
    view.react = mood;
    clearTimeout(view.reactTimer);
    view.reactTimer = setTimeout(function () { view.react = null; syncMood(); }, ms);
  }

  /* ---------------- fail cut: you accepted a fake ----------------
   * ~3s gag over the phone: shake + soulslike stamp + one effect per disguise. Gauges are untouched
   * (consequences still land at day end as before). Copy comes from data.failCuts[disguise] =
   * { stamp, line, effect, title?, preview? }; anything missing falls back to the English defaults below. */
  var CUT_MS = 3200, CUT_GUARD_MS = 600;
  var CUT_DEFAULTS = {
    wife_spy: { stamp: 'HONEYPOTTED', line: 'She was never your date. She was your wife\'s source.', effect: 'wifeCall', title: 'Wife' },
    android: { stamp: 'HONEYPOTTED', line: 'Your date is installing an update. On your laptop.', effect: 'firmware', title: 'Firmware update available' },
    rival_spy: { stamp: 'HONEYPOTTED', line: 'Your roadmap just changed employers.', effect: 'crash' },
    insider: { stamp: 'HONEYPOTTED', line: 'Your date bought call options before dessert.', effect: 'secMail', title: 'SEC has entered the chat', preview: 'Re: your "date". We have questions.' }
  };
  var FX_OWNER = { wifeCall: 'wife_spy', firmware: 'android', crash: 'rival_spy', secMail: 'insider' }; // whose defaults an effect's title/preview use
  function failCut(disguise) {
    var fc = (D.failCuts || {})[disguise] || {}, base = CUT_DEFAULTS[disguise] || CUT_DEFAULTS.rival_spy;
    var effect = FX_OWNER[fc.effect] ? fc.effect : base.effect, fx = CUT_DEFAULTS[FX_OWNER[effect]];
    return { stamp: fc.stamp || base.stamp, line: fc.line != null ? fc.line : base.line, effect: effect,
      title: fc.title || fx.title || '', preview: fc.preview || fx.preview || '' };
  }
  function cutSceneHtml(cut, c) {
    switch (cut.effect) {
      case 'wifeCall':
        return '<div class="fx call"><div class="call-av"><i></i></div><p class="call-name">' + esc(cut.title) + '</p><p class="call-dots"><i></i><i></i><i></i></p>' +
          '<div class="call-btns"><i class="cb no"></i><i class="cb yes"></i></div></div>';
      case 'firmware':
        return '<div class="fx fw"><div class="fw-box"><div class="fw-face">' + faceHtml(c) + '<i class="fw-scan"></i></div><p class="fw-t">' + esc(cut.title) + '</p>' +
          '<div class="fw-bar"><i></i></div><p class="fw-n"></p></div></div>';
      case 'secMail':
        return '<div class="fx mail"><div class="mail-stack"><div class="mail-banner"><i class="mail-ico"></i><div class="mail-txt"><b>' + esc(cut.title) + '</b><span>' + esc(cut.preview) + '</span></div></div></div></div>';
    }
    // crash: the stock line falls off a cliff (desktop: the terminal beside the phone crashes too)
    return '<div class="fx crash"><div class="crash-box"><div class="crash-h"><b>' + esc(D.stockDisplay.ticker) + '</b><span>▼▼▼</span></div>' +
      '<svg viewBox="0 0 200 90" aria-hidden="true"><polyline class="crash-line" points="4,22 22,18 38,24 54,14 70,20 86,12 100,16 112,15 124,40 136,34 150,62 164,58 178,84 196,88"/></svg></div></div>';
  }
  function cutHtml(cut, c) {
    return '<div class="cut fx-' + esc(cut.effect) + '" data-act="cutclose" role="alertdialog" aria-label="' + esc(cut.stamp) + '"><div class="cut-scrim"></div>' + cutSceneHtml(cut, c) +
      '<div class="cut-band">' + soundButton() + '<p class="cut-stamp">' + esc(cut.stamp) + '</p>' + (cut.line ? '<p class="cut-line">' + esc(cut.line) + '</p>' : '') + '</div>' +
      ceoHtml('shocked', 'ceo-cut react') + '</div>';
  }
  function showCut(c, disguise) {
    var cut = failCut(disguise || c.disguise);
    S.play(cut.effect === 'wifeCall' ? 'ring' : 'drop');
    clearReply(); // a reply still floating from the previous real date never sits under the gag
    view.busy = true;
    view.cut = { guard: Date.now() + CUT_GUARD_MS };
    S.musicActive(false);
    clearTimeout(view.reactTimer); view.react = 'shocked';
    app.insertAdjacentHTML('beforeend', cutHtml(cut, c));
    app.parentNode.classList.add('quake', cut.effect === 'wifeCall' ? 'buzz' : 'thud');
    if (cut.effect === 'crash' && stockEl) stockEl.classList.add('crashed');
    syncMood();
    if (!view.debug) view.cutTimer = setTimeout(endCut, CUT_MS);
  }
  function endCut(force) {
    if (!view.cut || (!force && Date.now() < view.cut.guard)) return;
    clearTimeout(view.cutTimer);
    view.cut = null; view.react = null; view.busy = false;
    app.parentNode.classList.remove('quake', 'buzz', 'thud');
    if (stockEl) stockEl.classList.remove('crashed');
    render();
  }

  /* ---------------- accept reply: you accepted a REAL date ----------------
   * Her one-line answer floats above the buttons for REPLY_MS (data: candidate.acceptLine, else a seeded pick
   * from data.acceptLines). Pure decoration: pointer-events none, never sets view.busy, survives re-renders
   * (a negative animation-delay resumes the fade where it was), and a fail cut clears it. Desk only. */
  var REPLY_MS = 1800;
  function replyLine(c) {
    if (c.acceptLine) return c.acceptLine;
    var pool = D.acceptLines || [];
    return pool.length ? pool[Math.floor(L.rngFor(state ? state.seed : 0, 'reply', c.id)() * pool.length)] : '';
  }
  function showReply(c) {
    var line = replyLine(c);
    clearReply();
    if (!line) return;
    view.reply = { name: c.profile.name, line: line, at: Date.now() };
    if (!view.debug) view.replyTimer = setTimeout(clearReply, REPLY_MS);
  }
  function clearReply() {
    clearTimeout(view.replyTimer);
    view.reply = null;
    var el = app.querySelector('.reply');
    if (el) el.remove();
  }
  function replyHtml() {
    var r = view.reply, age = r ? Date.now() - r.at : 0;
    if (!r || (!view.debug && age >= REPLY_MS)) return '';
    return '<div class="reply" role="status" style="animation-delay:-' + Math.max(0, age) + 'ms"><b>' + esc(r.name) + '</b><span>' + esc(r.line) + '</span></div>';
  }

  /* ---------------- screens ---------------- */
  function titleHtml() {
    var title = esc(U.title), co = esc(D.playerCompany || '');
    return co && title.indexOf(co) >= 0 ? title.replace(co, '<span class="co">' + co + '</span>') : title;
  }

  function screenTitle() {
    var saved = loadSave();
    var h = '<section class="screen titlescreen">' + statusBarHtml(L.clockOf(D).start, '');
    h += '<div class="tbody"><div class="brand"><h1>' + titleHtml() + '</h1><p class="sub">' + esc(U.subtitle) + '</p></div>';
    h += ceoHtml('smug', 'ceo-title');
    h += '<ol class="howto">' + U.howto.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    h += '<div class="fill"></div>';
    h += '<div class="tbtns">';
    if (saved && saved.phase !== 'title') h += '<button class="btn ok" data-act="resume">' + esc(t('resume', { day: saved.day })) + '</button>';
    h += '<button class="btn' + (saved ? '' : ' ok') + '" data-act="new">' + esc(saved ? (view.restartArmed ? U.restartConfirm : U.restart) : U.start) + '</button></div>';
    h += '<p class="disclaimer">' + esc(U.disclaimer) + '</p></div>';
    return h + '</section>';
  }

  function screenIntro() {
    var info = L.dayInfo(D, state.day), k = L.clockOf(D);
    var h = '<section class="screen intro">' + statusBarHtml(k.start, t('left', { n: L.dayCandidates(D, state.day).length })) + gaugesHtml(state) + rulesBarHtml(state.day);
    h += '<div class="card brief"><i class="clip" aria-hidden="true"></i><p class="kicker">' + esc(t('dayShort', { day: state.day })) + ' · ' + esc(info.label) + '</p>';
    var fresh = L.activeRules(D, state.day).filter(function (r) { return r.day === state.day; });
    if (fresh.length) h += '<p class="kicker2">' + esc(U.newRule) + '</p>' + fresh.map(function (r) { return '<div class="bigchip">' + chipHtml(r, true) + '<p>' + ruleDesc(r) + '</p></div>'; }).join('');
    h += '<p class="introtext">' + esc(info.intro) + '</p><p class="introtext">The clock runs while you inspect. Each date takes 75 minutes. Correct calls build a streak: 100 points, then +25 per step up to 200. Mistakes cost 100 and break the streak. Menu pauses the clock.</p></div>';
    h += '<div class="btns lead">' + ceoHtml(currentMood(), 'ceo-btn react') + '<button class="btn ok" data-act="begin">' + esc(U.beginDay) + '</button></div>';
    return h + '</section>';
  }

  function screenDesk() {
    var c = L.current(state, D);
    if (!c) return screenIntro();
    var q = L.dayQueue(state.seed, D, state.day), src = c.requestSource || 'Chat';
    var inspection = L.inspectionStats(state, D, state.day);
    var skin = esc(t('skin', { source: '\u0001', day: state.day })).replace('\u0001', '<b class="app">' + esc(src) + '</b>');
    var h = '<section class="screen desk">' + statusBarHtml(state.clock, t('left', { n: L.remaining(state, D) })) + gaugesHtml(state) + rulesBarHtml(state.day);
    h += '<div class="req enter" id="req" data-src="' + esc(slug(src)) + '"><div class="skin"><span class="skin-l">' + skin + '</span><span class="count">' + inspection.score + ' pts · x' + inspection.streak + '</span></div>';
    h += '<div class="body">' + faceHtml(c) + '<div class="who"><strong>' + esc(c.profile.name) + '<span class="age">, ' + esc(c.profile.age) + '</span></strong>' +
      '<span class="nationality">' + esc(U.nationalityLabel) + ': ' + esc(c.nationality || U.nationalityUnknown) + '</span><span class="intro-line">' + esc(c.profile.intro) + '</span>' + chatHtml(c) + '</div></div></div>';
    h += docsHtml(c, state.day);
    if (view.verdict && performance.now() < view.verdictUntil) h += '<div class="inspection-feedback ' + (view.verdictGood ? 'correct' : 'incorrect') + '" role="status">' + esc(view.verdict) + '</div>';
    h += '<div class="btns duo">' + replyHtml() + '<button class="btn no" data-act="decline"><i class="ico" aria-hidden="true"></i>' + esc(U.reject) + '</button>' +
      ceoHtml(currentMood(), 'ceo-btn react') +
      '<button class="btn ok yes" data-act="accept"><i class="ico" aria-hidden="true"></i>' + esc(U.accept) + '</button></div>';
    return h + '</section>';
  }

  function deltasHtml(before, after, finalMode) {
    return '<div class="deltas">' + D.gauges.filter(function (g) { return g.display !== 'hidden'; }).map(function (g) {
      var val;
      if (g.display === 'trend') val = pctText(L.pctChange(before[g.id], after[g.id], D)).replace('▲ ', finalMode ? '+' : '▲ ').replace('▼ ', finalMode ? '−' : '▼ ');
      else val = finalMode ? String(after[g.id]) : signed(after[g.id] - before[g.id]);
      var bad = (g.good === 'low' && after[g.id] > before[g.id]) || (g.good === 'high' && after[g.id] < before[g.id]);
      var cls = finalMode ? (g.display === 'trend' ? (bad ? 'worse' : '') : gaugeLevel(g, after[g.id]) === 'hot' ? 'worse' : '') : (bad ? 'worse' : '');
      return '<div' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(g.label) + '<em>' + esc(val) + '</em></div>';
    }).join('') + '</div>';
  }

  // ticker items: MVDA + the rivals (rival quotes are pure decoration: they drift opposite to MVDA's move today)
  function tapeItems(open, live) {
    var sd = D.stockDisplay, p = L.pctChange(open, live, D);
    var item = function (sym, price, pct, me) {
      return '<span class="ti' + (me ? ' me' : '') + '"><b>' + esc(sym) + '</b> ' + price.toFixed(2) + ' <em class="' + (pct < 0 ? 'down' : 'up') + '">' + esc(pctText(pct)) + '</em></span>';
    };
    var out = [item(sd.ticker, L.priceOf(live, D), p, true)];
    (D.rivals || []).forEach(function (r) {
      var hsh = L.hashStr(r.name), base = 30 + hsh % 140, k = 0.25 + ((hsh >>> 8) % 60) / 100, rp = -p * k;
      out.push(item(r.name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase(), base * (1 + rp / 100), rp));
    });
    return out;
  }
  function tapeHtml(items, cls) {
    var run = items.join('<i class="sep"></i>');
    return '<div class="' + cls + '" aria-hidden="true"><div class="tape-in"><span class="tape-run">' + run + '<i class="sep"></i></span><span class="tape-run">' + run + '<i class="sep"></i></span></div></div>';
  }

  function screenNews() {
    var sm = state.summary, info = L.dayInfo(D, sm.day), sg = D.stockDisplay.gauge;
    var h = '<section class="screen news">' + statusBarHtml(L.clockOf(D).end, '');
    h += '<div class="nbody"><div class="newshead"><div class="tv">' + ceoHtml(summaryMood(sm), 'ceo-mini react') + '<span class="onair">' + esc(sk('skinLive', 'LIVE')) + '</span></div>' +
      '<div class="nh-txt"><p class="kicker">' + esc(t('eveningNews', { day: sm.day })) + '</p><p class="nh-date">' + esc(info.label) + '</p></div></div>';
    if (sm.trumpCall) h += '<aside class="president-call" aria-label="' + esc(U.trumpCaller) + '"><span class="kicker">' + esc(U.trumpCaller) + '</span><b>' + esc(U.trumpName) + '</b><p>' + esc(U.trumpLine) + '</p><small>' + esc(U.trumpImpact) + '</small></aside>';
    sm.headlines.forEach(function (x, i) {
      h += i ? '<div class="hl sm">' + esc(x) + '</div>'
        : '<div class="hl lead"><span class="tag">' + esc(sk('skinBreaking', 'BREAKING')) + '</span><span class="hl-t">' + esc(x) + '</span></div>';
    });
    h += deltasHtml(sm.before, sm.after, false);
    var inspection = L.inspectionStats(state, D, sm.day);
    h += '<div class="hl stat">Inspection: ' + inspection.correct + ' / ' + inspection.total + ' correct · ' + inspection.score + ' pts · best streak ' + inspection.best + ' · ' + sm.counts.expired + ' unread</div>';
    h += '<div class="hl stat">' + esc(t('todayStats', sm.counts)) + ' / ' + esc(t('missed', { n: sm.citations.length })) + '</div>';
    if (sm.citations.length) {
      h += '<div class="citation shake"><b>' + esc(U.citationTitle) + '</b>' + sm.citations.map(function (ct) {
        var c = L.candidateById(D, ct.id);
        return '<span>' + esc(t('citationLine', { name: c.profile.name, rules: ct.rules.map(function (id) { var r = ruleById(id); return id + ' (' + r.chip + ')'; }).join(', ') })) + '</span>';
      }).join('') + '</div>';
    }
    if (sm.over) h += '<div class="hl gameover shake">' + esc((D.gameOverText || {})[sm.over] || 'Game over.') + '</div>';
    var label = sm.over ? U.toEnding : (sm.day >= L.lastDay(D) || (info && info.keynote)) ? U.toKeynote : U.nextDay;
    var crawl = tapeItems(sm.before[sg], sm.after[sg]).concat(D.gauges.filter(function (g) { return g.display !== 'trend' && g.display !== 'hidden'; }).map(function (g) {
      var d = sm.after[g.id] - sm.before[g.id], bad = (g.good === 'low' && d > 0) || (g.good === 'high' && d < 0);
      return '<span class="ti"><b>' + esc(g.label.toUpperCase()) + '</b> ' + sm.after[g.id] + ' <em class="' + (bad ? 'down' : 'up') + '">' + esc(signed(d)) + '</em></span>';
    }));
    h += '<div class="fill"></div></div>' + tapeHtml(crawl, 'crawl');
    h += '<div class="btns one"><button class="btn ok" data-act="advance">' + esc(label) + '</button></div>';
    return h + '</section>';
  }

  function screenKeynote() {
    var bg = D.art && D.art.keynoteBackground;
    return '<section class="screen keynote"' + (bg && loaded[bg] ? ' style="--kbg:url(\'' + esc(bg) + '\')"' : '') + '><div class="spot"></div><div class="beams" aria-hidden="true"></div>' +
      '<p class="kline" id="kline">&nbsp;</p>' + ceoHtml('smug', 'ceo-stage') + '<div class="chip-prop" id="chip" aria-hidden="true"><i></i></div><div class="crowd" aria-hidden="true"></div></section>';
  }

  function money(v) { return (D.stockDisplay.prefix || '') + Math.round(L.priceOf(v, D)); }

  // Ending chart. Axis labels live inside the SVG (one per point, so they can't drift from the dots);
  // price labels go on the side of the dot the line doesn't use, so they never sit on the line.
  function chartSvg(values) {
    var W = 330, H = 138, padX = 24, top = 22, bottom = 94, axisY = H - 4; // price labels sit within ±17 of a dot, axis row keeps clear below
    var n = values.length, min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (max - min < 10) { var mid = (max + min) / 2; min = mid - 5; max = mid + 5; }
    var x = function (i) { return n > 1 ? padX + i * (W - 2 * padX) / (n - 1) : W / 2; };
    var y = function (v) { return top + (1 - (v - min) / (max - min)) * (bottom - top); };
    var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="' + esc(D.stockDisplay.ticker) + ' price by day">';
    [0, 0.5, 1].forEach(function (f) { var yy = (top + f * (bottom - top)).toFixed(1); h += '<line class="grid" x1="0" x2="' + W + '" y1="' + yy + '" y2="' + yy + '"/>'; });
    var pts = values.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
    if (n > 1) h += '<polygon class="area" points="' + x(0).toFixed(1) + ',' + bottom + ' ' + pts.join(' ') + ' ' + x(n - 1).toFixed(1) + ',' + bottom + '"/>';
    h += '<polyline class="line" points="' + pts.join(' ') + '"/>';
    values.forEach(function (v, i) {
      var name = i ? t('chartDay', { day: i }) : U.chartStart, dir = i ? (v > values[i - 1] ? ' up' : v < values[i - 1] ? ' down' : '') : '';
      h += '<circle class="pt' + dir + '" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="4"><title>' + esc(name + ': ' + money(v)) + '</title></circle>';
      h += '<text class="ax" x="' + x(i).toFixed(1) + '" y="' + axisY + '" text-anchor="middle">' + esc(name) + '</text>';
    });
    // first label: below if the line climbs away from it, else above. last label: above if the line climbs into it, else below.
    var label = function (i, below, cls) {
      var yy = y(values[i]) + (below ? 17 : -9);
      return '<text class="vl' + (cls || '') + '" x="' + x(i).toFixed(1) + '" y="' + yy.toFixed(1) + '" text-anchor="middle">' + esc(money(values[i])) + '</text>';
    };
    h += label(0, n > 1 && values[1] > values[0]);
    if (n > 1) h += label(n - 1, values[n - 2] > values[n - 1], ' strong');
    return h + '</svg>';
  }

  function screenEnding() {
    var e = currentEnding();
    var st = L.stats(state, D), sg = D.stockDisplay.gauge, hist = state.history[sg];
    var start = {}; D.gauges.forEach(function (g) { start[g.id] = state.history[g.id][0]; });
    var h = '<section class="screen end' + (state.over ? ' caught' : '') + '"><div class="ebody">';
    h += '<div class="endhero">' + ceoHtml(screenMood(), 'ceo-end react') + '<div class="title">' + esc(e.title) + '</div></div>';
    h += '<div class="hl stat">' + esc(t(state.over ? 'endingKickerCaught' : 'endingKicker', { day: state.day })) + '<br><b>' + esc(L.fill(e.line, { ceo: D.ceoName })) + '</b></div>';
    h += '<div class="graph"><div class="graph-h"><b>' + esc(D.stockDisplay.ticker) + '</b><span>' + esc(money(hist[0])) + ' → ' + esc(money(hist[hist.length - 1])) + '</span></div>' + chartSvg(hist) + '</div>';
    h += deltasHtml(start, state.gauges, true);
    var shares = D.balance.fictionalShares, finalPrice = L.priceOf(state.gauges[sg], D);
    var wealth = finalPrice * shares, gain = (finalPrice - L.priceOf(hist[0], D)) * shares;
    var peak = L.priceOf(state.peakStock, D);
    h += '<div class="hl"><b>' + esc(D.ceoName) + ' EQUITY: $' + (wealth / 1e9).toFixed(2) + 'B</b><br>' + (gain >= 0 ? '+' : '-') + '$' + (Math.abs(gain) / 1e9).toFixed(2) + 'B FROM YOUR DATES<br>Peak $' + Math.round(peak) + ' · Final $' + Math.round(finalPrice) + '<br><small>Simulated · ' + (shares / 1e6) + 'M fictional shares · Not actual net worth</small></div>';
    h += '<p class="endstats">' + esc(t('endingStats', st)) + '</p>';
    if (e.id === 'dnd' && D.art.declineVideo) h += '<details class="meme-replay"><summary>' + esc(U.declineVideoLabel) + '</summary><video controls playsinline preload="none" src="' + esc(D.art.declineVideo) + '"></video></details>';
    var dn = D.donate || {};
    h += '<p class="donate"><b>' + esc(dn.title) + ':</b> ' + esc((dn.tiers || []).join(' / ')) + ' — ' +
      (dn.url ? '<a href="' + esc(dn.url) + '" target="_blank" rel="noopener">itch.io</a>' : '<span class="muted">' + esc(dn.pending) + '</span>') + '</p>';
    h += '<div class="fill"></div><div class="btns one"><button class="btn ok" data-act="replay">' + esc(U.replay) + '</button></div>';
    h += '<p class="footline">' + esc(t('seed', { seed: state.seed })) + '</p>';
    return h + '</div></section>';
  }

  /* ---------------- desktop stock window (beside the phone; CSS hides it under 900px wide) ---------------- */
  // x = game clock (open → close), one dot per decision, hollow dot = now, dashed = time left today
  function stockChartSvg(d) {
    var W = 270, H = 170, padL = 12, padR = 14, top = 16, bottom = 140, axisY = 162;
    var vals = d.points.map(function (p) { return p.v; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 6) { var mid = (max + min) / 2; min = mid - 3; max = mid + 3; }
    var padV = (max - min) * 0.12; min -= padV; max += padV;
    var x = function (tm) { return padL + (tm - d.start) / ((d.end - d.start) || 1) * (W - padL - padR); };
    var y = function (v) { return top + (1 - (v - min) / (max - min)) * (bottom - top); };
    var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(D.stockDisplay.ticker) + ' today">';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) { var yy = (top + f * (bottom - top)).toFixed(1); h += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '"/>'; });
    [0, 1, 2, 3].forEach(function (i) {
      var tm = d.start + i * (d.end - d.start) / 3, anchor = i === 0 ? 'start' : i === 3 ? 'end' : 'middle';
      h += '<text class="ax" x="' + x(tm).toFixed(1) + '" y="' + axisY + '" text-anchor="' + anchor + '">' + esc(L.fmtClock(Math.round(tm / 30) * 30)) + '</text>';
    });
    var last = d.points[d.points.length - 1];
    if (!d.closed) {
      h += '<line class="nowline" x1="' + x(d.now).toFixed(1) + '" x2="' + x(d.now).toFixed(1) + '" y1="' + (top - 6) + '" y2="' + (bottom + 6) + '"/>';
      h += '<line class="rest" x1="' + x(d.now).toFixed(1) + '" x2="' + x(d.end).toFixed(1) + '" y1="' + y(last.v).toFixed(1) + '" y2="' + y(last.v).toFixed(1) + '"/>';
    }
    if (d.points.length > 1) {
      var pts = d.points.map(function (p) { return x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1); });
      h += '<polygon class="area" points="' + x(d.points[0].t).toFixed(1) + ',' + bottom + ' ' + pts.join(' ') + ' ' + x(last.t).toFixed(1) + ',' + bottom + '"/>';
      h += '<polyline class="line" points="' + pts.join(' ') + '"/>';
    }
    d.points.forEach(function (p, i) {
      var isLast = i === d.points.length - 1;
      h += '<circle class="pt ' + p.kind + (isLast ? ' now' : '') + '" cx="' + x(p.t).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="' + (isLast ? 5 : 4) + '"/>';
    });
    d.lastAt = { x: x(last.t) / W * 100, y: y(last.v) / H * 100 }; // for the floating +$ pop
    return h + '</svg>';
  }

  function stockWinHtml() {
    var s = state || L.newGame(D, 1), d = L.intraday(s, D);
    if (!d) return '';
    var p = L.pctChange(d.open, d.live, D), pts = d.points, last = pts[pts.length - 1], prev = pts[pts.length - 2];
    var h = '<div class="bb-top"><i class="fk r"></i><i class="fk y"></i><i class="fk g"></i><b class="bb-sym">' + esc(D.stockDisplay.ticker) + '</b>' +
      '<span class="bb-co">' + esc(D.playerCompany) + '</span><span class="bb-time">' + esc(t('dayShort', { day: s.day }) + ' ' + L.fmtClock(d.now)) + '</span></div>';
    h += '<div class="bb-px"><div class="px">' + esc(money(d.live)) + '<small>.00</small></div><div class="chg ' + (p < 0 ? 'down' : 'up') + '">' + esc(t('stockToday', { pct: pctText(p) })) + '</div></div>';
    var chart = stockChartSvg(d);
    var pop = view.dv ? '<span class="pop ' + (view.dv > 0 ? 'up' : 'down') + '" style="left:' + d.lastAt.x.toFixed(1) + '%;top:' + d.lastAt.y.toFixed(1) + '%">' + esc(moneyDelta(view.dv)) + '</span>' : '';
    h += '<div class="pchart">' + chart + pop + '</div>';
    var line, c = last.id ? L.candidateById(D, last.id) : null, time = L.fmtClock(last.t);
    if (last.kind === 'open') line = t('stockOpen', { time: time });
    else if (last.kind === 'close') line = t('stockClose', { time: time });
    else line = t(last.kind === 'accept' ? 'stockAccepted' : 'stockDeclined', { time: time, name: c ? c.profile.name : '' });
    var dp = prev ? L.pctChange(prev.v, last.v, D) : 0;
    h += '<div class="last">&gt; ' + esc(line) + (dp ? ' <b class="' + (dp < 0 ? 'down' : 'up') + '">' + esc(pctText(dp)) + '</b>' : '') + '<i class="cursor"></i></div>';
    h += tapeHtml(tapeItems(d.open, d.live), 'tape');
    return h;
  }

  // how far the price moved since the last render (only when a new tick appeared on today's chart)
  function stockMove() {
    if (!state) { view.lastStock = null; return 0; }
    var d = L.intraday(state, D);
    if (!d) return 0;
    var key = state.seed + ':' + state.day, prev = view.lastStock;
    view.lastStock = { key: key, live: d.live, n: d.points.length };
    return prev && prev.key === key && d.points.length === prev.n + 1 ? d.live - prev.live : 0;
  }

  function renderCam() {
    if (!camEl) return;
    if (!camEl.firstChild) {
      camEl.innerHTML = '<div class="cam-frame">' + ceoHtml(currentMood(), 'ceo-cam react') +
        '<span class="cam-live"><i></i>' + esc(sk('skinLive', 'LIVE')) + '</span><span class="cam-view"><i></i><b></b></span>' +
        '<span class="cam-name">' + esc(D.ceoName) + '</span></div>';
    }
    // viewer count rides the stock price (pure decoration)
    var s = state || L.newGame(D, 1), d = L.intraday(s, D), v = d ? L.priceOf(d.live, D) : 100;
    var n = Math.round(v * 47.3 + (s.decisions ? s.decisions.length * 311 : 0));
    camEl.querySelector('.cam-view b').textContent = n.toLocaleString('en-US');
    camEl.setAttribute('data-phase', state ? state.phase : 'title');
  }

  /* ---------------- render ---------------- */
  function render() {
    var phase = state ? state.phase : 'title';
    if (phase !== 'keynote') view.keynoteRaised = false;
    view.dv = stockMove();
    var html = phase === 'title' || !state ? screenTitle()
      : phase === 'intro' ? screenIntro()
      : phase === 'desk' ? screenDesk()
      : phase === 'summary' ? screenNews()
      : phase === 'keynote' ? screenKeynote()
      : screenEnding();
    app.innerHTML = html + (html.indexOf('data-act="sound"') < 0 ? '<div class="ending-sound">' + soundButton() + '</div>' : '') + musicControls() + overlayHtml();
    S.musicActive(['intro', 'desk', 'summary'].indexOf(phase) >= 0 && !view.overlay && !view.cut);
    if (view.lastPhase === phase && app.firstElementChild) app.firstElementChild.classList.add('same'); // screen fade only on phase change
    view.lastPhase = phase;
    // new screen under the pointer (phase change, next card, cut closed onto the next card) → start the input guard
    var key = phase + (state ? ':' + state.day + ':' + state.idx : '');
    if (key !== view.screenKey) { view.screenKey = key; view.shownAt = Date.now(); }
    app.setAttribute('data-phase', phase);
    app.classList.toggle('danger', !!state && (phase === 'intro' || phase === 'desk' || phase === 'summary') && (anyHot(state) || !!state.over));
    if (stockEl) {
      stockEl.innerHTML = stockWinHtml(); stockEl.setAttribute('data-phase', phase);
      stockEl.classList.remove('flash-up', 'flash-down', 'big');
      if (view.dv) { void stockEl.offsetWidth; stockEl.classList.add(view.dv > 0 ? 'flash-up' : 'flash-down'); if (Math.abs(view.dv) >= BIG_MOVE) stockEl.classList.add('big'); }
    }
    renderCam();
    syncMood();
    if (phase === 'keynote' && !view.keynoteRunning) runKeynote();
  }

  function commit(next) {
    var previousPhase = state && state.phase;
    if (next.phase !== previousPhase) {
      if (next.phase === 'summary') S.play(next.summary && next.summary.trumpCall ? 'ring' : 'notify');
      else if (next.phase === 'ending') S.play(next.over ? 'fail' : 'win');
    }
    state = next;
    deskTickAt = performance.now();
    save();
    render();
  }

  var deskTickAt = performance.now(), leavingPage = false;
  window.addEventListener('beforeunload', function () {
    leavingPage = true;
    try { if (localStorage.getItem(SAVE_KEY)) save(); } catch (e) {}
  });
  function saveExisting() {
    try { if (localStorage.getItem(SAVE_KEY)) save(); } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () {
    deskTickAt = performance.now();
    if (document.hidden) saveExisting();
  });
  window.addEventListener('pagehide', function () { leavingPage = true; saveExisting(); });
  window.addEventListener('pageshow', function () { leavingPage = false; deskTickAt = performance.now(); });
  setInterval(function () {
    var now = performance.now(), elapsed = now - deskTickAt;
    deskTickAt = now;
    if (leavingPage || view.debug || !state || state.phase !== 'desk' || view.busy || view.cut || view.overlay || document.hidden) return;
    state = L.tick(state, D, elapsed / 250);
    if (state.phase !== 'desk') { view.verdict = null; save(); render(); return; }
    var clock = app.querySelector('.sb-time');
    if (clock) clock.textContent = L.fmtClock(Math.floor(state.clock));
    var note = app.querySelector('.inspection-feedback');
    if (note && performance.now() > view.verdictUntil) note.remove();
  }, 250);

  function runKeynote() {
    clearTimers();
    view.keynoteRunning = true;
    var K = D.keynote || {}, lines = K.lines || [], step = K.lineMs || 1500;
    var setLine = function (txt) { var el = document.getElementById('kline'); if (el) { el.textContent = txt; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); } };
    lines.forEach(function (ln, i) { later(function () { setLine(ln); }, 400 + i * step); });
    var raiseAt = 400 + lines.length * step;
    later(function () {
      setLine(K.chipLine || '');
      var chip = document.getElementById('chip'); if (chip) chip.classList.add('raise');
      app.classList.add('raised');
      var ceo = app.querySelector('.ceo'); if (ceo) { ceo.className = ceo.className.replace(/mood-\w+/, 'mood-neutral'); swapCeoArt(ceo, 'neutral'); }
      view.keynoteRaised = true; syncMood();
    }, raiseAt);
    // the bit: nothing happens for silenceMs (ending fairy moment)
    later(function () { view.keynoteRunning = false; app.classList.remove('raised'); commit(L.finishKeynote(state, D)); }, raiseAt + 700 + (K.silenceMs == null ? 3000 : K.silenceMs));
  }

  /* ---------------- input ---------------- */
  function decideNow(accept) {
    if (view.busy || view.overlay || !state || state.phase !== 'desk') return;
    view.busy = true;
    var card = document.getElementById('req'), docs = app.querySelector('.docs'), btn = app.querySelector('[data-act="' + (accept ? 'accept' : 'decline') + '"]');
    if (card) card.classList.add(accept ? 'out-accept' : 'out-decline');
    if (docs) docs.classList.add('out-docs');
    if (btn) btn.classList.add('pressed');
    later(function () {
      view.busy = false; view.overlay = null;
      var c = L.current(state, D), before = L.liveValue(state, D, D.stockDisplay.gauge), next = L.decide(state, D, accept, !view.debug);
      var result = L.inspectionResult(c, D, state.day, accept);
      S.play(result.correct ? (accept ? 'cash' : 'bonk') : 'wrong');
      view.verdict = result.correct ? 'CLEARED · Correct call' : accept ? 'CITATION · Missed contradiction' : 'MISSED DATE · No rule broken';
      view.verdictGood = result.correct;
      view.verdictUntil = performance.now() + 2400;
      if (c && c.evidence) {
        view.evidenceExplanation = c.evidence.explanation;
        view.evidenceCut = accept && c.disguise ? c : null;
        view.overlay = 'evidence';
        view.verdictUntil = 0;
        clearReply();
        commit(next);
        return;
      }
      // accepted a fake → the decision is saved now, but the next screen waits until the gag cut is over
      if (accept && c && c.disguise) { state = next; save(); showCut(c); return; }
      // reaction face: accepted → smug for a beat; accepted and the stock jumped → happy. Real date → her reply pops up.
      if (accept && next.phase === 'desk') {
        var jump = L.liveValue(next, D, D.stockDisplay.gauge) - before;
        if (jump >= BIG_MOVE) react('happy', 1700); else react('smug', 1300);
        if (c) showReply(c);
      } else { view.react = null; clearReply(); }
      commit(next);
    }, 180);
  }

  function newGame(seedOverride) {
    clearTimers(); view.keynoteRunning = false; view.overlay = null; view.restartArmed = false; view.react = null;
    commit(L.newGame(D, seedOverride || view.seedParam || L.randomSeed()));
  }

  function armRestart() {
    if (view.restartArmed) {
      if (Date.now() - view.armedAt < INPUT_GUARD_MS) return; // a double-click must not arm AND confirm the wipe
      view.restartArmed = false; wipeSave(); newGame(); return;
    }
    view.restartArmed = true; view.armedAt = Date.now(); render();
    later(function () { if (view.restartArmed) { view.restartArmed = false; render(); } }, 3000);
  }

  /* Input guard: a button that just appeared under the pointer ignores clicks for INPUT_GUARD_MS, so the 2nd click
   * of a double-click can't land on it (begin → desk drew Accept/Decline right there; news → intro; the next card;
   * the card after a fail cut; keynote → ending's replay). Keys: auto-repeat is ignored (holding a key = one step). */
  var INPUT_GUARD_MS = 350;
  var GUARDED = { begin: 1, advance: 1, accept: 1, decline: 1, replay: 1 };
  app.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) return;
    if (ev.target.closest('[data-stop]') && el.classList.contains('overlay')) return; // taps inside the sheet don't close it
    if (el.tagName === 'A') return;
    var act = el.getAttribute('data-act');
    if (act === 'music') {
      var musicOn = S.musicToggle(ev);
      el.setAttribute('aria-pressed', String(musicOn)); el.textContent = 'BGM ' + (musicOn ? 'ON' : 'OFF');
      return;
    }
    if (act === 'sound') {
      var soundOn = S.toggle(ev);
      app.querySelectorAll('[data-act="sound"]').forEach(function (button) { button.setAttribute('aria-pressed', String(soundOn)); button.textContent = 'SFX ' + (soundOn ? 'ON' : 'OFF'); });
      return;
    }
    if (view.cut) { if (act === 'cutclose') endCut(); return; }
    if (GUARDED[act] && Date.now() - view.shownAt < INPUT_GUARD_MS) return;
    switch (act) {
      case 'new': if (loadSave()) armRestart(); else newGame(); break;
      case 'resume': state = loadSave(); view.overlay = null; render(); break;
      case 'begin': commit(L.beginDay(state, D)); S.play('notify'); break;
      case 'accept': decideNow(true); break;
      case 'decline': decideNow(false); break;
      case 'advance': commit(L.advance(state, D)); break;
      case 'replay': wipeSave(); newGame(); break;
      case 'rules': view.overlay = view.overlay === 'rules' ? null : 'rules'; render(); break;
      case 'menu': view.overlay = 'menu'; view.restartArmed = false; render(); break;
      case 'credits': view.overlay = 'credits'; render(); break;
      case 'close':
        var evidenceCut = view.overlay === 'evidence' ? view.evidenceCut : null;
        view.evidenceCut = null; view.overlay = null; view.restartArmed = false;
        render();
        if (evidenceCut) showCut(evidenceCut);
        break;
      case 'restart': armRestart(); break;
    }
  });

  // keys: → / Y = Accept (right button), ← / N = Decline (left button). Holding a key does one step.
  app.addEventListener('input', function (ev) { if (ev.target.matches('[data-music-volume]')) S.musicVolume(ev.target.value / 100); });
  document.addEventListener('keydown', function (ev) {
    if (ev.target.closest('input, select, textarea')) return;
    if (ev.repeat) return;
    if (view.cut) { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); endCut(); } return; }
    if (!state || view.overlay) { if (ev.key === 'Escape' && view.overlay) { view.overlay = null; render(); } return; }
    if (state.phase === 'desk') {
      var k = ev.ctrlKey || ev.metaKey || ev.altKey ? '' : String(ev.key).toLowerCase();
      if (ev.key === 'ArrowRight' || k === 'y') decideNow(true);
      else if (ev.key === 'ArrowLeft' || k === 'n') decideNow(false);
    } else if (ev.key === 'Enter' && !ev.target.closest('button')) {
      if (state.phase === 'intro') { commit(L.beginDay(state, D)); S.play('notify'); }
      else if (state.phase === 'summary') commit(L.advance(state, D));
    }
  });

  // image fallback: keep the CSS placeholder unless the image actually loads (phone + reaction cam)
  document.addEventListener('load', function (ev) {
    if (ev.target.tagName === 'IMG') { loaded[ev.target.getAttribute('src')] = true; ev.target.classList.add('ok'); }
  }, true);
  document.addEventListener('error', function (ev) { if (ev.target.tagName === 'IMG') ev.target.remove(); }, true);

  /* ---------------- boot ---------------- */
  function preload(src, cb) {
    if (!src) return;
    var im = new Image();
    im.onload = function () { loaded[src] = true; if (cb) cb(src); };
    im.src = src;
  }
  function applyArt() {
    var A = D.art || {};
    // the office photo only goes in once it has actually loaded; until then the CSS night office shows
    preload(A.background, function (src) { document.body.style.setProperty('--bgimg', 'url("' + src.replace(/"/g, '') + '")'); document.body.classList.add('has-bg'); });
    preload(A.keynoteBackground);
    Object.keys(A.ceo || {}).forEach(function (m) { preload(A.ceo[m]); }); // mood swaps are instant
    var neon = document.getElementById('neon');
    if (neon) neon.textContent = D.playerCompany || '';
  }

  function boot() {
    document.documentElement.lang = D.lang || 'en';
    document.title = U.title;
    applyArt();
    var v = L.validateData(D);
    if (v.errors.length && window.console) console.warn('[mVIDIA] data.js problems:\n' + v.errors.join('\n'));

    var q = new URLSearchParams(location.search);
    var seed = parseInt(q.get('seed'), 10) || null;
    // Dev-only jump for screenshots, reachable ONLY by typing a URL — no button, key or menu leads here:
    //   ?debug=title|intro|desk|news|keynote|ending [&day=N&id=cXX&strategy=ruleFollower&seed=N&overlay=rules|menu|credits&anim=1]
    //   desk extras: &find=<disguise>|legit &at=N (pick a card)  &mood=happy|smug|shocked (reaction face)  &set=suspicion:88 (force gauges)
    //                &clue=earpiece|neckSeam|rivalBadge|weddingRing|lanyard (sticker preview)  &cut=1|<disguise> (freeze the fail cut)
    //                &reply=1 (freeze the accept reply bubble)
    // A bare "?debug" or any other value is ignored (normal game). Debug runs never touch the player's save.
    var DEBUG_VIEWS = { title: 1, intro: 1, desk: 1, news: 1, keynote: 1, ending: 1 };
    var dbg = q.get('debug');
    if (dbg && DEBUG_VIEWS.hasOwnProperty(dbg)) {
      view.debug = true;
      if (q.get('anim') !== '1') document.documentElement.classList.add('no-anim'); // stable screenshots
      var day = parseInt(q.get('day'), 10) || 1, id = q.get('id'), find = q.get('find'), at = parseInt(q.get('at'), 10) || 0;
      var anyDay = !q.get('day') && !!(find || id); // find/id without day → first match on any day
      var strat = L.STRATEGIES[q.get('strategy') || 'ruleFollower'] || L.STRATEGIES.ruleFollower;
      var s = L.newGame(D, seed || 1234);
      var stop = {
        title: function () { return true; },
        intro: function (x) { return x.phase === 'intro' && x.day === day; },
        // desk: &find=wife_spy|android|rival_spy|insider|legit picks a card by kind (survives copy edits), &at=N = Nth card of the day or later
        desk: function (x) {
          var c = L.current(x, D);
          return x.phase === 'desk' && (anyDay || x.day === day) && x.idx >= at && !!c && (!id || c.id === id) && (!find || (c.disguise || 'legit') === find);
        },
        news: function (x) { return x.phase === 'summary' && x.day === day; },
        keynote: function (x) { return x.phase === 'keynote'; },
        ending: null
      }[dbg];
      if (dbg === 'title') { state = null; render(); return; }
      state = L.autoplay(s, D, strat, stop);
      if (q.get('overlay')) view.overlay = q.get('overlay');
      // &set=suspicion:88,security:40 → force gauge values (screenshot the danger state)
      (q.get('set') || '').split(',').forEach(function (kv) {
        var p = kv.split(':'), g = L.gaugeDef(D, p[0]), v = parseInt(p[1], 10);
        if (g && !isNaN(v)) state.gauges[g.id] = v;
      });
      if (q.get('mood') && state.phase === 'desk') view.react = q.get('mood'); // screenshot a reaction face
      // &reply=1 → freeze the accept reply of today's last accepted real date (none yet → the current card's)
      if (q.get('reply') && state.phase === 'desk') {
        var lastReal = state.decisions.filter(function (d) { var dc = L.candidateById(D, d.id); return d.day === state.day && d.accept && dc && !dc.disguise; }).pop();
        var rc = lastReal ? L.candidateById(D, lastReal.id) : L.current(state, D);
        if (rc) showReply(rc);
      }
      if (q.get('clue') && CLUES.hasOwnProperty(q.get('clue'))) view.debugClue = q.get('clue'); // preview a clue sticker on any face
      render();
      // &cut=1 (current card's disguise) or &cut=wife_spy|android|rival_spy|insider: freeze the fail cut over the desk
      var cutQ = q.get('cut'), cur = L.current(state, D);
      if (cutQ && cur) {
        var card = document.getElementById('req'), docs = app.querySelector('.docs');
        if (card) card.classList.add('out-accept');
        if (docs) docs.classList.add('out-docs');
        showCut(cur, CUT_DEFAULTS[cutQ] ? cutQ : cur.disguise || 'wife_spy');
      }
      return;
    }
    view.seedParam = seed; // ?seed=N → the next new game uses N (reproduce a run)
    state = null;
    render();
  }

  boot();
})();
