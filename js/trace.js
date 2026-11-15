// 한글 따라쓰기: 글자 데이터 + 손가락으로 따라 쓰는 칸(TRACE.createPad)
// 판정 방식: 글자 모양을 120×120 격자로 만들고, 화면에 그려진 잉크와 똑같은 굵기로 판정용 격자에도 그림.
//   - 글자 면적의 90% 이상을 칠하고, 두께 있는 빈 덩어리가 남아 있지 않아야 통과
//     (획 가장자리·모서리의 얇은 틈은 봐주고, 짧은 획 하나를 통째로 빼먹으면 통과 안 됨)
//   - 덜 칠하고 손을 떼면 빈 곳을 노랗게 깜빡여 알려 줌
//   - 획의 30% 이상이 글자 밖이면 지우고 다시 쓰게 함
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
  var N = 120, PASS = 0.9, ERODE = 2, HOLE = 0.25, OUT_MAX = 0.3;

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
    var mask = null, near = null, maskCount = 1, inkSamples = 0, outSamples = 0;
    var D = 10, strokeT = 10, brush = 12, last = { cov: 0, hole: 0, ok: false, missing: null };
    // 판정용 잉크 격자: 화면 잉크와 같은 획을 N×N 크기에 같은 굵기로 그림
    var kcv = document.createElement('canvas'); kcv.width = kcv.height = N;
    var kc = kcv.getContext('2d', { willReadFrequently: true });
    var strokes = [], cur = null, activePointer = null, lastG = null;

    function buildMask() {
      var c = document.createElement('canvas'); c.width = c.height = N;
      var x = c.getContext('2d', { willReadFrequently: true });
      var f = fit(x, ch, N);
      x.font = f.font; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = '#000';
      x.fillText(ch, f.x, f.y);
      var data = x.getImageData(0, 0, N, N).data, i, y, xx, dx, dy;
      mask = new Uint8Array(N * N); near = new Uint8Array(N * N);
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
      // 붓 굵기: 글자 획보다 약간 굵게(가운데를 따라가면 획 전체가 칠해지도록). 화면과 판정에 같은 값 사용
      brush = Math.max(7, Math.min(22, strokeT * 1.3));
      D = Math.round(brush / 2) + 3;
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
      inkSamples = 0; outSamples = 0;
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
      ic.lineWidth = S * brush / N;
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
    // 선 밖 판정용 표본: 손가락이 지나간 점이 글자 근처(near)인지
    function sample(gx, gy) {
      inkSamples++;
      var ix = Math.min(N - 1, Math.max(0, Math.round(gx))), iy = Math.min(N - 1, Math.max(0, Math.round(gy)));
      if (!near[iy * N + ix]) outSamples++;
    }
    function trace(nx, ny) {
      var gx = nx * N, gy = ny * N;
      if (!lastG) { sample(gx, gy); lastG = [gx, gy]; return; }
      var dx = gx - lastG[0], dy = gy - lastG[1];
      var steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 1.5));
      for (var s = 1; s <= steps; s++) sample(lastG[0] + dx * s / steps, lastG[1] + dy * s / steps);
      lastG = [gx, gy];
    }
    // 판정 격자에 획 하나 그리기(점 하나 또는 선분)
    function kDot(p) { kc.beginPath(); kc.arc(p[0] * N, p[1] * N, brush / 2, 0, Math.PI * 2); kc.fill(); }
    function kSeg(q, p) { kc.beginPath(); kc.moveTo(q[0] * N, q[1] * N); kc.lineTo(p[0] * N, p[1] * N); kc.stroke(); }
    function kStyle() { kc.setTransform(1, 0, 0, 1, 0, 0); kc.lineCap = 'round'; kc.lineJoin = 'round'; kc.lineWidth = brush; kc.strokeStyle = kc.fillStyle = '#000'; }
    // 칠한 정도 재기: 전체 비율 + 가장 큰 빈 덩어리 크기 + 빈 칸 지도
    function measure() {
      if (!mask) return last;
      var d = kc.getImageData(0, 0, N, N).data, missing = new Uint8Array(N * N), covered = 0, i, x, y, it;
      for (i = 0; i < N * N; i++) {
        if (!mask[i]) continue;
        if (d[i * 4 + 3] >= 128) covered++; else missing[i] = 1;
      }
      // 칠한 곳에 맞닿은 빈 칸을 2겹 벗겨 냄 → 얇은 틈(획 가장자리, 모서리)은 사라지고 두께 있는 빈 곳만 남음
      var core = missing.slice();
      for (it = 0; it < ERODE; it++) {
        var nx = core.slice();
        for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
          i = y * N + x; if (!core[i]) continue;
          // 이웃이 '칠한 글자 칸'이면 벗겨 냄 (글자 바깥은 빈 곳과 같은 편으로 봄)
          if ((x > 0 && mask[i - 1] && !core[i - 1]) || (x < N - 1 && mask[i + 1] && !core[i + 1]) ||
              (y > 0 && mask[i - N] && !core[i - N]) || (y < N - 1 && mask[i + N] && !core[i + N])) nx[i] = 0;
        }
        core = nx;
      }
      // 남은 빈 덩어리 중 가장 큰 것
      var seen = new Uint8Array(N * N), stack = [], hole = 0;
      for (i = 0; i < N * N; i++) {
        if (!core[i] || seen[i]) continue;
        var n = 0; stack.push(i); seen[i] = 1;
        while (stack.length) {
          var j = stack.pop(); n++;
          var jx = j % N;
          if (jx > 0 && core[j - 1] && !seen[j - 1]) { seen[j - 1] = 1; stack.push(j - 1); }
          if (jx < N - 1 && core[j + 1] && !seen[j + 1]) { seen[j + 1] = 1; stack.push(j + 1); }
          if (j >= N && core[j - N] && !seen[j - N]) { seen[j - N] = 1; stack.push(j - N); }
          if (j < N * N - N && core[j + N] && !seen[j + N]) { seen[j + N] = 1; stack.push(j + N); }
        }
        if (n > hole) hole = n;
      }
      var cov = covered / maskCount, holeMax = Math.max(12, HOLE * strokeT * strokeT);
      last = { cov: cov, hole: hole / holeMax, ok: cov >= PASS && hole < holeMax, missing: missing };
      return last;
    }
    // 진행 막대: 통과 조건을 다 채우기 전에는 95%에서 멈춤
    function progress(m) { return m.ok ? 1 : Math.min(0.95, m.cov / PASS); }
    var rafPending = false;
    function report(now) {
      if (!opts.onProgress) return;
      if (now) { opts.onProgress(progress(measure())); return; }
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () { rafPending = false; if (alive && !solved) opts.onProgress(progress(measure())); });
    }
    // 덜 칠한 곳을 노랗게 세 번 깜빡임
    function flashMissing(m) {
      if (!m.missing) return;
      var my = token, t0 = performance.now(), cell = S / N;
      (function frame(t) {
        clearCanvas(cvF, fc);
        var k = (t - t0) / 1500;
        if (k >= 1 || my !== token || !alive || solved) return;
        fc.setTransform(dpr, 0, 0, dpr, 0, 0);
        fc.globalAlpha = 0.75 * Math.abs(Math.sin(k * Math.PI * 3));
        fc.fillStyle = '#ffc83d';
        for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (m.missing[y * N + x]) fc.fillRect(x * cell, y * cell, cell + 0.6, cell + 0.6);
        fc.globalAlpha = 1;
        requestAnimationFrame(frame);
      })(t0);
    }
    function evaluate() {
      var out = inkSamples ? outSamples / inkSamples : 0;
      if (out > OUT_MAX && inkSamples > 30) {
        pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake');
        if (opts.onOut) opts.onOut();
        var t = token;
        setTimeout(function () { if (t === token && !solved) clear(); }, 700);
        return;
      }
      var m = measure();
      if (opts.onProgress) opts.onProgress(progress(m));
      if (m.ok) { success(); return; }
      if (m.cov >= 0.5) flashMissing(m);
      if (opts.onHint) opts.onHint(m.cov, m);
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
      clearCanvas(cvF, fc);
      inkStyle();
      ic.beginPath(); ic.arc(p[0] * S, p[1] * S, ic.lineWidth / 2, 0, Math.PI * 2); ic.fill();
      kStyle(); kDot(p);
      trace(p[0], p[1]); report();
    });
    cvI.addEventListener('pointermove', function (e) {
      if (e.pointerId !== activePointer || !cur) return;
      e.preventDefault();
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (!evs.length) evs = [e];
      inkStyle(); kStyle();
      evs.forEach(function (ev) {
        var p = pos(ev), q = cur[cur.length - 1];
        ic.beginPath(); ic.moveTo(q[0] * S, q[1] * S); ic.lineTo(p[0] * S, p[1] * S); ic.stroke();
        kSeg(q, p);
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
      inkSamples = 0; outSamples = 0;
      kc.setTransform(1, 0, 0, 1, 0, 0); kc.clearRect(0, 0, N, N);
      clearCanvas(cvI, ic); clearCanvas(cvF, fc);
      last = { cov: 0, hole: 0, ok: false, missing: null };
      if (opts.onProgress) opts.onProgress(0);
    }

    function onFonts() { if (ch && !solved && inkSamples === 0 && alive) { buildMask(); drawGuide(false); } }
    try { document.fonts.addEventListener('loadingdone', onFonts); } catch (e) {}

    return {
      el: pad,
      // 새 글자 놓기. 글꼴을 기다린 뒤 칸을 그림.
      setLetter: function (letter, inkColor) {
        var my = ++token;
        ch = letter; color = inkColor || INK[0]; solved = false; strokes = []; mask = null;
        kc.setTransform(1, 0, 0, 1, 0, 0); kc.clearRect(0, 0, N, N);
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
      stats: function () { return { cov: last.cov, hole: last.hole, ok: last.ok, brush: brush, strokeT: strokeT, missing: last.missing, mask: mask }; },
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
