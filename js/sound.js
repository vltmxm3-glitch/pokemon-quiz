// 효과음: 소리 파일 없이 Web Audio 로 합성합니다.
(function () {
  'use strict';
  var ctx = null, enabled = true;
  function ac() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // 첫 터치/클릭 때 오디오를 깨워 둡니다(휴대폰 정책).
  ['pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () { if (enabled) ac(); }, { passive: true });
  });

  function tone(freq, at, dur, type, vol, freqEnd) {
    var c = ac(); if (!c || !enabled) return;
    var t0 = c.currentTime + (at || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(at, dur, vol) {
    var c = ac(); if (!c || !enabled) return;
    var len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800;
    s.buffer = buf; g.gain.value = vol || 0.15;
    s.connect(f); f.connect(g); g.connect(c.destination);
    s.start(c.currentTime + (at || 0));
  }

  var N = { C4: 261.6, E4: 329.6, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, A5: 880, B5: 987.8, C6: 1046.5 };
  var S = {
    tap: function () { tone(N.A5, 0, 0.06, 'sine', 0.08); },
    correct: function () { tone(N.C5, 0, 0.12, 'triangle', 0.25); tone(N.E5, 0.1, 0.12, 'triangle', 0.25); tone(N.G5, 0.2, 0.25, 'triangle', 0.25); },
    wrong: function () { tone(311, 0, 0.18, 'square', 0.08, 220); tone(233, 0.17, 0.3, 'square', 0.08, 160); },
    battle: function () {
      noise(0, 0.25, 0.12);
      [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6].forEach(function (f, i) { tone(f, 0.05 + i * 0.07, 0.1, 'square', 0.09); });
    },
    throwBall: function () { tone(400, 0, 0.35, 'sine', 0.15, 1200); },
    wobble: function () { tone(180, 0, 0.08, 'square', 0.1); noise(0, 0.06, 0.08); },
    caught: function () {
      tone(1500, 0, 0.05, 'square', 0.1);
      [N.G4, N.C5, N.E5, N.G5].forEach(function (f, i) { tone(f, 0.15 + i * 0.12, 0.14, 'triangle', 0.25); });
      tone(N.C6, 0.65, 0.5, 'triangle', 0.25); tone(N.E5, 0.65, 0.5, 'triangle', 0.15); tone(N.G5, 0.65, 0.5, 'triangle', 0.15);
    },
    flee: function () { [N.G5, N.E5, N.C5, N.G4].forEach(function (f, i) { tone(f, i * 0.12, 0.12, 'triangle', 0.18); }); },
    stamp: function () { noise(0, 0.12, 0.25); tone(N.C5, 0.12, 0.12, 'triangle', 0.2); tone(N.G5, 0.24, 0.3, 'triangle', 0.2); },
    gold: function () { [N.E5, N.G5, N.B5, N.E5 * 2].forEach(function (f, i) { tone(f, i * 0.06, 0.25, 'sine', 0.12); }); }
  };
  window.SFX = {
    play: function (name) { try { if (enabled && S[name]) S[name](); } catch (e) { /* 소리 실패는 무시 */ } },
    setEnabled: function (v) { enabled = !!v; if (enabled) ac(); },
    isEnabled: function () { return enabled; }
  };
})();
