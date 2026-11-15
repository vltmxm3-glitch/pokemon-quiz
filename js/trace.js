// 한글 따라쓰기: 글자 데이터 + 손가락으로 따라 쓰는 칸(TRACE.createPad)
// 판정 방식: 글자 모양을 120×120 격자로 만들고, 손가락이 지나간 자리가 글자 면적을 80% 이상 덮으면 통과.
//            획의 30% 이상이 글자 밖이면 지우고 다시 쓰게 함.
(function () {
  'use strict';

  // ---------- 글자 데이터 ----------
  var CHO = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('');
  var CHO_IDX = [0, 2, 3, 5, 6, 7, 9, 11, 12, 14, 15, 16, 17, 18];
  var CHO_NAME = ['기역', '니은', '디귿', '리을', '미음', '비읍', '시옷', '이응', '지읒', '치읓', '키읔', '티읕', '피읖', '히읗'];
  var VOW = 'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'.split('');
  var VOW_SAY = '아야어여오요우유으이'.split('');
  function syl(c, j) { return String.fromCharCode(0xAC00 + (c * 21 + j) * 28); }
  function sylStage(id, j, color) {
    var items = CHO_IDX.map(function (c) { return syl(c, j); });
    return { id: id, name: items.slice(0, 3).join(''), sub: items[0] + ' ~ ' + items[13], items: items, say: items, color: color };
  }
  var STAGES = [
    { id: 'cons', name: '자음', sub: 'ㄱ ~ ㅎ', items: CHO, say: CHO_NAME, color: '#ff4d5a' },
    { id: 'vow', name: '모음', sub: 'ㅏ ~ ㅣ', items: VOW, say: VOW_SAY, color: '#3fa7ff' },
    sylStage('a', 0, '#f07a2c'),
    sylStage('eo', 4, '#c98a00'),
    sylStage('o', 8, '#23974b'),
    sylStage('u', 13, '#1f9fa8'),
    sylStage('eu', 18, '#6c63d9'),
    sylStage('i', 20, '#c8509e')
  ];
  var INK = ['#ff4d5a', '#f07a2c', '#e0a000', '#23974b', '#3fa7ff', '#6c63d9', '#c8509e'];
  var FONT = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

  // ---------- 판정 설정 ----------
  var N = 120, PASS = 0.8, OUT_MAX = 0.3;

  // ---------- 음성 (기기의 한국어 음성) ----------
  function speak(text) {
    try {
      if (window.SFX && !window.SFX.isEnabled()) return;
      var s = window.speechSynthesis; if (!s) return;
      s.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR'; u.rate = 0.8; u.pitch = 1.1;
      var v = s.getVoices().filter(function (v) { return /^ko/i.test(v.lang); })[0];
      if (v) u.voice = v;
      s.speak(u);
    } catch (e) { /* 음성 없음은 무시 */ }
  }
  try { if (window.speechSynthesis) window.speechSynthesis.getVoices(); } catch (e) {}

  // ---------- 글꼴 ----------
  function fontReady(text) {
    try {
      return Promise.race([
        document.fonts.load('700 100px "Noto Sans KR"', text),
        new Promise(function (r) { setTimeout(r, 2500); })
      ]).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }
  fontReady(STAGES.map(function (s) { return s.items.join(''); }).join(''));

  // 글자를 칸 안 74% 상자에 맞춰 가운데 배치
  function fit(ctx, ch, size) {
    ctx.font = '700 100px ' + FONT;
    var m = ctx.measureText(ch);
    var l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight, a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent;
    if (!(r + l > 0) || !(a + d > 0)) { l = 0; r = m.width || 100; a = 80; d = 10; }
    var box = size * 0.74, k = Math.min(box / (l + r), box / (a + d));
    return { font: '700 ' + (100 * k) + 'px ' + FONT, x: size / 2 + (l - r) / 2 * k, y: size / 2 + (a - d) / 2 * k };
  }

  function starPath(c, x, y, ro, ri) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath();
  }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =====================================================================
  // 따라 쓰는 칸
  // host: 칸이 들어갈 상자(크기가 정해진 요소). 칸은 host 안에서 가장 큰 정사각형으로 맞춤.
  // opts.onProgress(0~1), opts.onSuccess(), opts.onOut()
  // =====================================================================
  function createPad(host, opts) {
    opts = opts || {};
    var pad = document.createElement('div');
    pad.className = 'tpad';
    pad.innerHTML = '<canvas class="tg"></canvas><canvas class="ti"></canvas><canvas class="tf"></canvas>';
    host.appendChild(pad);
    var cvG = pad.children[0], cvI = pad.children[1], cvF = pad.children[2];
    var g = cvG.getContext('2d'), ic = cvI.getContext('2d'), fc = cvF.getContext('2d');

    var S = 200, dpr = 1, ch = null, color = INK[0], solved = false, token = 0, alive = true;
    var mask = null, near = null, inked = null, maskCount = 1, covered = 0, inkSamples = 0, outSamples = 0;
    var R = 6, D = 10, strokeT = 10, offsets = [];
    var strokes = [], cur = null, activePointer = null, lastG = null;

    function buildMask() {
      var c = document.createElement('canvas'); c.width = c.height = N;
      var x = c.getContext('2d', { willReadFrequently: true });
      var f = fit(x, ch, N);
      x.font = f.font; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = '#000';
      x.fillText(ch, f.x, f.y);
      var data = x.getImageData(0, 0, N, N).data, i, y, xx, dx, dy;
      mask = new Uint8Array(N * N); near = new Uint8Array(N * N); inked = new Uint8Array(N * N);
      maskCount = 0;
      for (i = 0; i < N * N; i++) if (data[i * 4 + 3] >= 128) { mask[i] = 1; maskCount++; }
      if (!maskCount) maskCount = 1;
      // 획 두께 ≈ 2 × 면적 / 둘레 → 손가락 판정 반경을 글자 굵기에 맞춤
      var edge = 0;
      for (y = 1; y < N - 1; y++) for (xx = 1; xx < N - 1; xx++) {
        i = y * N + xx;
        if (mask[i] && (!mask[i - 1] || !mask[i + 1] || !mask[i - N] || !mask[i + N])) edge++;
      }
      strokeT = edge ? Math.max(4, Math.min(20, 2 * maskCount / edge)) : 10;
      R = Math.max(4, Math.min(10, Math.round(strokeT * 0.55) + 1));
      D = R + 4;
      offsets = [];
      for (dy = -R; dy <= R; dy++) for (dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R) offsets.push([dx, dy]);
      for (y = 0; y < N; y++) for (xx = 0; xx < N; xx++) {
        if (!mask[y * N + xx]) continue;
        for (dy = -D; dy <= D; dy++) {
          var yy = y + dy; if (yy < 0 || yy >= N) continue;
          for (dx = -D; dx <= D; dx++) {
            var x2 = xx + dx; if (x2 < 0 || x2 >= N || dx * dx + dy * dy > D * D) continue;
            near[yy * N + x2] = 1;
          }
        }
      }
      covered = 0; inkSamples = 0; outSamples = 0;
    }

    function drawGuide(filled) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, S, S);
      // 국어 쓰기 공책 칸 + 십자 점선
      g.save();
      g.strokeStyle = 'rgba(240,140,140,.7)'; g.lineWidth = Math.max(1.5, S * 0.005);
      g.setLineDash([S * 0.02, S * 0.018]);
      g.beginPath(); g.moveTo(S / 2, S * 0.04); g.lineTo(S / 2, S * 0.96); g.moveTo(S * 0.04, S / 2); g.lineTo(S * 0.96, S / 2); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = 'rgba(240,140,140,.9)'; g.lineWidth = Math.max(2, S * 0.008);
      var inset = S * 0.035;
      g.beginPath();
      if (g.roundRect) g.roundRect(inset, inset, S - inset * 2, S - inset * 2, S * 0.05); else g.rect(inset, inset, S - inset * 2, S - inset * 2);
      g.stroke();
      g.restore();
      if (!ch) return;
      var f = fit(g, ch, S);
      g.font = f.font; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      if (filled) { g.fillStyle = color; g.fillText(ch, f.x, f.y); return; }
      g.fillStyle = '#e7edf4'; g.fillText(ch, f.x, f.y);
      g.setLineDash([S * 0.014, S * 0.012]); g.lineWidth = Math.max(1.5, S * 0.006); g.lineJoin = 'round';
      g.strokeStyle = '#a9b6c8'; g.strokeText(ch, f.x, f.y); g.setLineDash([]);
    }
    function inkStyle() {
      ic.setTransform(dpr, 0, 0, dpr, 0, 0);
      ic.lineCap = 'round'; ic.lineJoin = 'round';
      ic.lineWidth = Math.max(S * 0.055, S * strokeT / N * 0.95);
      ic.strokeStyle = color; ic.fillStyle = color;
    }
    function clearCanvas(c, x) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); }
    function redrawInk() {
      clearCanvas(cvI, ic); inkStyle();
      strokes.forEach(function (s) {
        if (s.length === 1) { ic.beginPath(); ic.arc(s[0][0] * S, s[0][1] * S, ic.lineWidth / 2, 0, Math.PI * 2); ic.fill(); return; }
        ic.beginPath(); ic.moveTo(s[0][0] * S, s[0][1] * S);
        for (var i = 1; i < s.length; i++) ic.lineTo(s[i][0] * S, s[i][1] * S);
        ic.stroke();
      });
    }
    function resize() {
      if (!alive) return;
      var size = Math.floor(Math.min(host.clientWidth, host.clientHeight));
      if (size < 60) return;
      S = size; dpr = Math.min(window.devicePixelRatio || 1, 3);
      pad.style.width = pad.style.height = size + 'px';
      [cvG, cvI, cvF].forEach(function (c) { c.width = Math.round(size * dpr); c.height = Math.round(size * dpr); });
      drawGuide(solved);
      redrawInk();
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', resize);

    // ---------- 판정 ----------
    function stamp(gx, gy) {
      var cx = Math.round(gx), cy = Math.round(gy);
      for (var k = 0; k < offsets.length; k++) {
        var x = cx + offsets[k][0], y = cy + offsets[k][1];
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        var i = y * N + x;
        if (!inked[i]) { inked[i] = 1; if (mask[i]) covered++; }
      }
      inkSamples++;
      var ix = Math.min(N - 1, Math.max(0, cx)), iy = Math.min(N - 1, Math.max(0, cy));
      if (!near[iy * N + ix]) outSamples++;
    }
    function trace(nx, ny) {
      var gx = nx * N, gy = ny * N;
      if (!lastG) { stamp(gx, gy); lastG = [gx, gy]; return; }
      var dx = gx - lastG[0], dy = gy - lastG[1];
      var steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 1.5));
      for (var s = 1; s <= steps; s++) stamp(lastG[0] + dx * s / steps, lastG[1] + dy * s / steps);
      lastG = [gx, gy];
    }
    function progress() { return Math.min(1, covered / maskCount / PASS); }
    function report() { if (opts.onProgress) opts.onProgress(progress()); }
    function evaluate() {
      var cov = covered / maskCount, out = inkSamples ? outSamples / inkSamples : 0;
      if (out > OUT_MAX && inkSamples > 30) {
        pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake');
        if (opts.onOut) opts.onOut();
        var t = token;
        setTimeout(function () { if (t === token && !solved) clear(); }, 700);
        return;
      }
      if (cov >= PASS) success();
      else if (opts.onHint) opts.onHint(cov);
    }
    function success() {
      solved = true;
      drawGuide(true);
      clearCanvas(cvI, ic);
      pad.classList.remove('pop'); void pad.offsetWidth; pad.classList.add('pop');
      confetti();
      if (opts.onProgress) opts.onProgress(1);
      if (opts.onSuccess) opts.onSuccess();
    }
    function confetti() {
      if (reduceMotion) return;
      var parts = [];
      for (var i = 0; i < 60; i++) {
        var a = Math.random() * Math.PI * 2, sp = S * (0.006 + Math.random() * 0.014);
        parts.push({ x: S / 2, y: S / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.008,
          s: S * (0.012 + Math.random() * 0.016), c: INK[i % INK.length], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, star: i % 3 === 0 });
      }
      var t0 = performance.now(), my = token;
      (function frame(t) {
        var k = (t - t0) / 1300;
        clearCanvas(cvF, fc);
        if (k >= 1 || my !== token || !alive) return;
        fc.setTransform(dpr, 0, 0, dpr, 0, 0);
        fc.globalAlpha = 1 - k * k;
        parts.forEach(function (p) {
          p.x += p.vx; p.y += p.vy; p.vy += S * 0.0006; p.r += p.vr;
          fc.save(); fc.translate(p.x, p.y); fc.rotate(p.r); fc.fillStyle = p.c;
          if (p.star) { starPath(fc, 0, 0, p.s, p.s * 0.45); fc.fill(); } else fc.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
          fc.restore();
        });
        fc.globalAlpha = 1;
        requestAnimationFrame(frame);
      })(t0);
    }

    // ---------- 터치 ----------
    function pos(e) {
      var r = cvI.getBoundingClientRect();
      return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
    }
    cvI.addEventListener('pointerdown', function (e) {
      if (activePointer !== null || solved || !mask) return;
      e.preventDefault();
      activePointer = e.pointerId;
      try { cvI.setPointerCapture(e.pointerId); } catch (x) {}
      var p = pos(e);
      cur = [p]; strokes.push(cur); lastG = null;
      inkStyle();
      ic.beginPath(); ic.arc(p[0] * S, p[1] * S, ic.lineWidth / 2, 0, Math.PI * 2); ic.fill();
      trace(p[0], p[1]); report();
    });
    cvI.addEventListener('pointermove', function (e) {
      if (e.pointerId !== activePointer || !cur) return;
      e.preventDefault();
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e];
      inkStyle();
      evs.forEach(function (ev) {
        var p = pos(ev), q = cur[cur.length - 1];
        ic.beginPath(); ic.moveTo(q[0] * S, q[1] * S); ic.lineTo(p[0] * S, p[1] * S); ic.stroke();
        cur.push(p); trace(p[0], p[1]);
      });
      report();
    });
    function end(e) {
      if (e.pointerId !== activePointer) return;
      activePointer = null; cur = null; lastG = null;
      if (!solved) evaluate();
    }
    cvI.addEventListener('pointerup', end);
    cvI.addEventListener('pointercancel', end);
    cvI.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

    function clear() {
      token++;
      strokes = []; cur = null; lastG = null; activePointer = null;
      if (inked) inked.fill(0);
      covered = 0; inkSamples = 0; outSamples = 0;
      clearCanvas(cvI, ic);
      report();
    }

    function onFonts() { if (ch && !solved && inkSamples === 0 && alive) { buildMask(); drawGuide(false); } }
    try { document.fonts.addEventListener('loadingdone', onFonts); } catch (e) {}

    return {
      el: pad,
      // 새 글자 놓기. 글꼴을 기다린 뒤 칸을 그림.
      setLetter: function (letter, inkColor) {
        var my = ++token;
        ch = letter; color = inkColor || INK[0]; solved = false; strokes = []; mask = null;
        clearCanvas(cvI, ic); clearCanvas(cvF, fc);
        resize();
        return fontReady(letter).then(function () {
          if (my !== token || !alive) return;
          buildMask(); resize(); clear();
        });
      },
      clear: clear,
      resize: resize,
      isSolved: function () { return solved; },
      destroy: function () {
        alive = false; token++;
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        try { document.fonts.removeEventListener('loadingdone', onFonts); } catch (e) {}
        if (pad.parentNode) pad.parentNode.removeChild(pad);
      }
    };
  }

  // 배틀용: 무작위 글자 하나 (자음·모음이 조금 더 자주)
  function randomLetter() {
    var w = [3, 2, 1, 1, 1, 1, 1, 1], total = 0, i;
    for (i = 0; i < w.length; i++) total += w[i];
    var r = Math.random() * total;
    for (i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) break; }
    var st = STAGES[Math.min(i, STAGES.length - 1)], k = Math.floor(Math.random() * st.items.length);
    return { ch: st.items[k], say: st.say[k], stage: st.id };
  }

  window.TRACE = { STAGES: STAGES, INK: INK, createPad: createPad, speak: speak, randomLetter: randomLetter };
})();
