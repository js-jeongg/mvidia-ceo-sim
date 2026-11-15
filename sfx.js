(function () {
  'use strict';
  var ctx, master, voices = [], enabled = true, unlocked = false, buffers = {}, loading = false;
  function loadClips() {
    if (loading) return;
    loading = true;
    ['cash', 'wrong', 'drop', 'ring', 'fail'].forEach(function (cue) {
      fetch('img/sfx/' + cue + '.mp3').then(function (r) { if (!r.ok) throw new Error('audio ' + r.status); return r.arrayBuffer(); })
        .then(function (data) { return ctx.decodeAudioData(data); }).then(function (buffer) { buffers[cue] = buffer; }).catch(function () {});
    });
  }
  var key = 'mvidia-ceo-sim/sound/v1';
  try { enabled = localStorage.getItem(key) !== 'off'; } catch (e) {}
  function stop() {
    voices.splice(0).forEach(function (v) { try { v.stop(); } catch (e) {} });
    document.querySelectorAll('video').forEach(function (v) { v.muted = true; });
  }
  function unlock(ev) {
    if (!ev.isTrusted) return;
    unlocked = true;
    var Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio || !enabled) return;
    try {
      if (!ctx) { ctx = new Audio(); master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination); }
      loadClips();
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
    } catch (e) {}
  }
  function tone(hz, endHz, at, duration, type, volume) {
    var osc = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + at;
    osc.type = type || 'sine'; osc.frequency.setValueAtTime(hz, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, endHz), start + duration);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume || 0.4, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain); gain.connect(master); voices.push(osc);
    osc.onended = function () { osc.disconnect(); gain.disconnect(); var i = voices.indexOf(osc); if (i >= 0) voices.splice(i, 1); };
    osc.start(start); osc.stop(start + duration + 0.02);
  }
  function play(cue) {
    if (!enabled || !unlocked || !ctx || ctx.state !== 'running' || document.hidden) return;
    if (voices.length > 24) stop();
    if (buffers[cue]) {
      var source = ctx.createBufferSource(); source.buffer = buffers[cue]; source.connect(master); voices.push(source);
      source.onended = function () { source.disconnect(); var i = voices.indexOf(source); if (i >= 0) voices.splice(i, 1); };
      source.start();
      return;
    }
    if (cue === 'fail') cue = 'wrong';
    if (cue === 'cash') {
      [1046, 1568, 2093].forEach(function (f, i) { tone(f, f, i * 0.075, 0.18, 'square', 0.12); });
      tone(240, 70, 0, 0.1, 'triangle', 0.5);
    } else if (cue === 'bonk') {
      tone(380, 85, 0, 0.16, 'triangle', 0.7); tone(900, 140, 0.025, 0.1, 'sine', 0.25);
    } else if (cue === 'wrong') {
      tone(180, 47, 0, 0.55, 'sawtooth', 0.35);
      [0, 0.08, 0.16].forEach(function (t) { tone(1400, 180, t, 0.065, 'sawtooth', 0.12); });
    } else if (cue === 'drop') {
      tone(140, 28, 0, 0.95, 'sine', 0.85); tone(75, 30, 0, 0.65, 'triangle', 0.45);
      tone(720, 65, 0, 0.22, 'sawtooth', 0.16);
    } else if (cue === 'ring') {
      [0, 0.22, 0.75, 0.97].forEach(function (t) { tone(660, 660, t, 0.15, 'square', 0.14); tone(880, 880, t, 0.15, 'sine', 0.2); });
    } else if (cue === 'win') {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, f, i * 0.12, 0.28, 'square', 0.13); });
    } else if (cue === 'notify') {
      tone(880, 1320, 0, 0.1, 'sine', 0.3); tone(1320, 1760, 0.11, 0.12, 'sine', 0.25);
    }
  }
  function toggle(ev) {
    enabled = !enabled;
    if (enabled && ev) unlock(ev);
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch (e) {}
    if (!enabled) stop();
    document.querySelectorAll('video').forEach(function (v) { v.muted = !enabled; });
    return enabled;
  }
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); if (ctx && ctx.state === 'running') ctx.suspend().catch(function () {}); }
  });
  window.addEventListener('pagehide', stop);
  document.addEventListener('play', function (ev) { if (ev.target.tagName === 'VIDEO') ev.target.muted = !enabled || document.hidden; }, true);
  window.MVSfx = { play: play, stop: stop, toggle: toggle, enabled: function () { return enabled; } };
})();
