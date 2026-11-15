// 한글 따라쓰기: 글자 획 데이터 + 손가락으로 따라 쓰는 칸(TRACE.createPad)
//
// 글자는 글꼴이 아니라 '획 데이터'로 그립니다. 획마다 쓰는 순서와 방향이 들어 있어서
//   - 획 순서별 색(①빨강 ②주황 ③초록 ④파랑)과 가운데 흰 실선, 시작점 번호·방향 화살표를 보여 주고
//   - 쓰기 전에 피카츄가 획 순서대로 2번 시범을 보이고
//   - 아이가 쓴 한 획이 '지금 차례인 획'을 시작점부터 끝까지, 맞는 방향으로 따라갔는지 판정합니다.
(function () {
  'use strict';

  // =====================================================================
  // 획 데이터 (0~1 상자 안 좌표, 쓰는 방향대로). 획 하나 = 점 배열
  // 국어 교과서 획순 기준
  // =====================================================================
  function circle(cx, cy, rx, ry) { // 위에서 시작해 시계 반대 방향(왼쪽으로)
    var pts = [];
    for (var i = 0; i <= 40; i++) { var a = -Math.PI / 2 - i / 40 * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return pts;
  }
  var JAMO = {
    'ㄱ': [[[0.12, 0.18], [0.84, 0.18], [0.84, 0.88]]],
    'ㄴ': [[[0.16, 0.12], [0.16, 0.82], [0.88, 0.82]]],
    'ㄷ': [[[0.14, 0.18], [0.86, 0.18]], [[0.14, 0.18], [0.14, 0.82], [0.88, 0.82]]],
    'ㄹ': [[[0.14, 0.12], [0.84, 0.12], [0.84, 0.48]], [[0.16, 0.48], [0.84, 0.48]], [[0.16, 0.48], [0.16, 0.88], [0.88, 0.88]]],
    'ㅁ': [[[0.16, 0.16], [0.16, 0.84]], [[0.16, 0.16], [0.84, 0.16], [0.84, 0.84]], [[0.16, 0.84], [0.84, 0.84]]],
    'ㅂ': [[[0.18, 0.12], [0.18, 0.86]], [[0.82, 0.12], [0.82, 0.86]], [[0.18, 0.48], [0.82, 0.48]], [[0.18, 0.86], [0.82, 0.86]]],
    'ㅅ': [[[0.5, 0.12], [0.14, 0.88]], [[0.36, 0.42], [0.86, 0.88]]],
    'ㅇ': [circle(0.5, 0.5, 0.36, 0.36)],
    'ㅈ': [[[0.14, 0.16], [0.82, 0.16], [0.16, 0.88]], [[0.52, 0.48], [0.88, 0.88]]],
    'ㅊ': [[[0.5, 0.02], [0.5, 0.17]], [[0.14, 0.27], [0.82, 0.27], [0.16, 0.9]], [[0.52, 0.55], [0.88, 0.9]]],
    'ㅋ': [[[0.12, 0.16], [0.84, 0.16], [0.84, 0.88]], [[0.14, 0.5], [0.84, 0.5]]],
    'ㅌ': [[[0.14, 0.14], [0.86, 0.14]], [[0.14, 0.48], [0.84, 0.48]], [[0.14, 0.14], [0.14, 0.86], [0.88, 0.86]]],
    'ㅍ': [[[0.1, 0.16], [0.9, 0.16]], [[0.34, 0.16], [0.3, 0.84]], [[0.66, 0.16], [0.7, 0.84]], [[0.1, 0.84], [0.9, 0.84]]],
    'ㅎ': [[[0.5, 0.02], [0.5, 0.15]], [[0.16, 0.27], [0.84, 0.27]], circle(0.5, 0.63, 0.27, 0.27)],
    'ㅏ': [[[0.35, 0.04], [0.35, 0.96]], [[0.35, 0.5], [0.78, 0.5]]],
    'ㅑ': [[[0.35, 0.04], [0.35, 0.96]], [[0.35, 0.36], [0.78, 0.36]], [[0.35, 0.64], [0.78, 0.64]]],
    'ㅓ': [[[0.22, 0.5], [0.65, 0.5]], [[0.65, 0.04], [0.65, 0.96]]],
    'ㅕ': [[[0.22, 0.36], [0.65, 0.36]], [[0.22, 0.64], [0.65, 0.64]], [[0.65, 0.04], [0.65, 0.96]]],
    'ㅗ': [[[0.5, 0.3], [0.5, 0.62]], [[0.06, 0.62], [0.94, 0.62]]],
    'ㅛ': [[[0.36, 0.3], [0.36, 0.62]], [[0.64, 0.3], [0.64, 0.62]], [[0.06, 0.62], [0.94, 0.62]]],
    'ㅜ': [[[0.06, 0.38], [0.94, 0.38]], [[0.5, 0.38], [0.5, 0.82]]],
    'ㅠ': [[[0.06, 0.38], [0.94, 0.38]], [[0.36, 0.38], [0.36, 0.82]], [[0.64, 0.38], [0.64, 0.82]]],
    'ㅡ': [[[0.06, 0.5], [0.94, 0.5]]],
    'ㅣ': [[[0.5, 0.04], [0.5, 0.96]]]
  };
  var CHO_ALL = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  var JUNG_ALL = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  var FLAT = 'ㅗㅛㅜㅠㅡ'; // 자음 아래에 놓이는 모음
  // 칸 안 자리(x, y, 너비, 높이)
  var BOX_ONE = [0.1, 0.08, 0.8, 0.84];
  var BOX = {
    side: { cons: [0.06, 0.2, 0.5, 0.6], vow: [0.5, 0.06, 0.46, 0.88] },
    flat: { cons: [0.2, 0.06, 0.6, 0.5], vow: [0.06, 0.4, 0.88, 0.56] }
  };
  function place(strokes, r) {
    return strokes.map(function (s) { return s.map(function (p) { return [r[0] + p[0] * r[2], r[1] + p[1] * r[3]]; }); });
  }
  // 글자 → { lines: 획들(칸 0~1 좌표), width: 획 굵기(칸 대비) }
  function letterStrokes(ch) {
    if (JAMO[ch]) return { lines: place(JAMO[ch], BOX_ONE), width: 0.085 };
    var c = ch.charCodeAt(0) - 0xAC00;
    if (c < 0 || c >= 11172) return null;
    var cho = CHO_ALL[Math.floor(c / 588)], jung = JUNG_ALL[Math.floor((c % 588) / 28)];
    if (!JAMO[cho] || !JAMO[jung]) return null;
    var lay = FLAT.indexOf(jung) >= 0 ? BOX.flat : BOX.side;
    return { lines: place(JAMO[cho], lay.cons).concat(place(JAMO[jung], lay.vow)), width: 0.07 };
  }

  // ---------- 학습 단계 ----------
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
  // 획 순서별 색: ①빨강 ②주황 ③초록 ④파랑 (⑤ 이상은 보라)
  var ORDER = ['#ff4d5a', '#f5891f', '#2fae5f', '#2f8fd8', '#8a5cd6', '#c8509e'];
  var INK = ORDER;

  // ---------- 판정 설정 ----------
  var STEP = 0.01;         // 획 가운데 선을 이 간격으로 나눠 판정
  var DONE = 0.88;         // 획 길이의 88% 이상 따라가야 완료
  var OFF_MAX = 0.25;      // 손가락 점의 25% 넘게 선에서 벗어나면 다시
  var DEMO_SPEED = 0.5;    // 피카츄 시범 속도: 1초에 칸 너비의 절반
  var DEMO_LOOPS = 2;

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

  // ---------- 선 도구 ----------
  function resample(pts, step) { // 점 사이를 step 간격으로 촘촘히
    var out = [pts[0].slice()];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step));
      for (var k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return out;
  }
  function lineLen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function d2(a, b) { var x = a[0] - b[0], y = a[1] - b[1]; return x * x + y * y; }

  // 손가락 길(path)이 획(line, 촘촘한 점들)을 시작점부터 끝까지 순서대로 따라갔는지
  function follow(line, path, tol) {
    var M = line.length - 1, c = -1, off = 0, tol2 = tol * tol, short = M * STEP < 0.15; // 점처럼 짧은 획은 60%만 따라가도 인정
    // 시작은 획 앞쪽(긴 획은 앞 20%, 짧은 점 획은 앞 40%)에서 해야 함 → 거꾸로 쓰면 통과 안 됨
    var startWin = short ? Math.max(2, Math.floor(M * 0.4)) : Math.max(3, Math.floor(M * 0.2));
    for (var n = 0; n < path.length; n++) {
      var f = path[n], best = Infinity, bj = 0, j, dd;
      // 선 전체에서 가장 가까운 거리(벗어남 판정)
      var g = Infinity; for (j = 0; j <= M; j += 2) { dd = d2(f, line[j]); if (dd < g) g = dd; }
      if (g > tol2 * 2.25) off++;
      var lo = c < 0 ? 0 : Math.max(0, c - 6), hi = c < 0 ? startWin : Math.min(M, c + 30);
      for (j = lo; j <= hi; j++) { dd = d2(f, line[j]); if (dd < best) { best = dd; bj = j; } }
      if (c < 0) { if (best <= tol2 * 2.6) c = bj; else if (n === 0) return { ok: false, why: 'start', prog: 0, off: 1 }; continue; }
      if (best <= tol2 && bj > c) c = bj;
    }
    var prog = c < 0 ? 0 : c / Math.max(1, M), offR = path.length ? off / path.length : 1;
    // 방향 검사(시작과 끝이 다른 획만): 처음 닿은 곳이 획 끝보다 시작에 가깝고, 손가락이 획과 같은 방향으로 움직였는지
    var A = line[0], Z = line[M], P0 = path[0], P1 = path[path.length - 1];
    if (Math.hypot(Z[0] - A[0], Z[1] - A[1]) > 0.04) {
      var dirOk = d2(P0, A) < d2(P0, Z) && ((P1[0] - P0[0]) * (Z[0] - A[0]) + (P1[1] - P0[1]) * (Z[1] - A[1])) > 0;
      if (!dirOk) return { ok: false, prog: prog, off: offR, why: 'dir' };
    }
    return { ok: prog >= (short ? 0.6 : DONE) && offR <= OFF_MAX, prog: prog, off: offR, why: offR > OFF_MAX ? 'off' : 'short' };
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function starPath(c, x, y, ro, ri) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath();
  }

  // 시범 길잡이(피카츄) 그림: 한 번만 불러 둠. 못 불러오면 노란 동그라미로 대신
  var mascots = {};
  function mascotImg(src) {
    if (!src) return null;
    if (!mascots[src]) {
      var im = new Image(); im.decoding = 'async';
      im.onload = function () { im._ok = true; };
      im.onerror = function () { im._bad = true; };
      im.src = src; mascots[src] = im;
    }
    return mascots[src];
  }

  // =====================================================================
  // 따라 쓰는 칸
  // host: 칸이 들어갈 상자(크기가 정해진 요소). 칸은 host 안에서 가장 큰 정사각형으로 맞춤.
  // opts.mascot: 시범 길잡이 그림 주소(피카츄)
  // opts.onProgress(0~1), opts.onSuccess(), opts.onHint(문구, 종류), opts.onWrong(), opts.onStroke(완료한 획 수, 전체),
  // opts.onDemo(true/false)
  // =====================================================================
  function createPad(host, opts) {
    opts = opts || {};
    var pad = document.createElement('div');
    pad.className = 'tpad';
    pad.innerHTML = '<canvas class="tg"></canvas><canvas class="ti"></canvas><canvas class="tf"></canvas>';
    host.appendChild(pad);
    var cvG = pad.children[0], cvI = pad.children[1], cvF = pad.children[2];
    var g = cvG.getContext('2d'), ic = cvI.getContext('2d'), fc = cvF.getContext('2d');
    var mascot = mascotImg(opts.mascot);

    var S = 200, dpr = 1, ch = null, solved = false, token = 0, alive = true;
    var lines = [], dense = [], width = 0.08, k = 0;      // 획들, 촘촘한 획들, 굵기, 지금 차례 획 번호
    var cur = null, activePointer = null, demo = null, nudge = null;

    function hint(text, kind) { if (opts.onHint) opts.onHint(text, kind || ''); }
    function clearCanvas(c, x) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); }
    function pathOn(x, pts) { x.beginPath(); x.moveTo(pts[0][0] * S, pts[0][1] * S); for (var i = 1; i < pts.length; i++) x.lineTo(pts[i][0] * S, pts[i][1] * S); }

    // 쓰기 공책 칸 + 획 안내
    function drawGuide() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, S, S);
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
      if (!lines.length) return;
      g.lineCap = 'round'; g.lineJoin = 'round';
      var i;
      // 1) 획 몸통: 다 쓴 획은 진하게, 아직인 획은 옅게(지금 차례 획은 조금 더 진하게)
      for (i = 0; i < lines.length; i++) {
        g.globalAlpha = solved || i < k ? 1 : (i === k ? 0.42 : 0.2);
        g.strokeStyle = ORDER[i % ORDER.length]; g.lineWidth = width * S;
        pathOn(g, lines[i]); g.stroke();
      }
      g.globalAlpha = 1;
      if (solved) return;
      // 2) 아직 안 쓴 획 가운데 흰 실선
      g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, S * 0.012);
      for (i = k; i < lines.length; i++) { pathOn(g, lines[i]); g.stroke(); }
      // 3) 시작점 번호 (뒤 번호부터 그려서 앞 번호가 위에 오게)
      for (i = lines.length - 1; i >= k; i--) badge(g, i, i === k);
      // 4) 지금 차례 획: 방향 화살표
      arrow(g, lines[k], ORDER[k % ORDER.length]);
    }
    function badge(x, i, big) {
      var p = lines[i][0], r = S * (big ? 0.045 : 0.034);
      x.beginPath(); x.arc(p[0] * S, p[1] * S, r, 0, Math.PI * 2);
      x.fillStyle = ORDER[i % ORDER.length]; x.fill();
      x.lineWidth = Math.max(2, S * 0.008); x.strokeStyle = '#fff'; x.stroke();
      x.fillStyle = '#fff'; x.font = '700 ' + Math.round(r * 1.25) + 'px sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(i + 1), p[0] * S, p[1] * S + r * 0.05);
    }
    function arrow(x, pts, color) { // 시작점에서 조금 떨어진 곳에 진행 방향 화살표
      var L = lineLen(pts), want = Math.min(0.16, L * 0.45), acc = 0, at = null, dir = null;
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], s = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (acc + s >= want) { var t = (want - acc) / s; at = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; dir = [(b[0] - a[0]) / s, (b[1] - a[1]) / s]; break; }
        acc += s;
      }
      if (!at) return;
      var cx = at[0] * S, cy = at[1] * S, h = S * 0.035, nx = -dir[1], ny = dir[0];
      x.beginPath();
      x.moveTo(cx + dir[0] * h, cy + dir[1] * h);
      x.lineTo(cx - dir[0] * h * 0.6 + nx * h * 0.8, cy - dir[1] * h * 0.6 + ny * h * 0.8);
      x.lineTo(cx - dir[0] * h * 0.6 - nx * h * 0.8, cy - dir[1] * h * 0.6 - ny * h * 0.8);
      x.closePath();
      x.fillStyle = color; x.fill(); x.lineWidth = Math.max(1.5, S * 0.006); x.strokeStyle = '#fff'; x.stroke();
    }
    function inkStyle() {
      ic.setTransform(dpr, 0, 0, dpr, 0, 0);
      ic.lineCap = 'round'; ic.lineJoin = 'round';
      ic.lineWidth = width * S * 0.8;
      ic.globalAlpha = 0.85;
      ic.strokeStyle = ic.fillStyle = ORDER[k % ORDER.length];
    }
    function redrawInk() {
      clearCanvas(cvI, ic);
      if (!cur || cur.length < 1) return;
      inkStyle();
      if (cur.length === 1) { ic.beginPath(); ic.arc(cur[0][0] * S, cur[0][1] * S, ic.lineWidth / 2, 0, Math.PI * 2); ic.fill(); return; }
      pathOn(ic, cur); ic.stroke();
    }
    function resize() {
      if (!alive) return;
      var size = Math.floor(Math.min(host.clientWidth, host.clientHeight));
      if (size < 60) return;
      S = size; dpr = Math.min(window.devicePixelRatio || 1, 3);
      pad.style.width = pad.style.height = size + 'px';
      [cvG, cvI, cvF].forEach(function (c) { c.width = Math.round(size * dpr); c.height = Math.round(size * dpr); });
      drawGuide();
      redrawInk();
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', resize);

    function report() {
      if (opts.onProgress) opts.onProgress(lines.length ? k / lines.length : 0);
      if (opts.onStroke) opts.onStroke(k, lines.length);
    }

    // ---------- 피카츄 시범 ----------
    function stopDemo(quiet) {
      if (!demo) return;
      demo = null; clearCanvas(cvF, fc);
      if (opts.onDemo) opts.onDemo(false);
      if (!quiet && !solved) hint(k === 0 ? '이제 ①번 흰 선부터 따라 써 봐!' : circled(k) + '번 획을 써 봐!', 'go');
    }
    function drawMascot(x, y, t) {
      var sz = S * 0.2, bob = Math.sin(t / 90) * S * 0.008;
      // 펜 끝 표시
      fc.beginPath(); fc.arc(x, y, S * 0.018, 0, Math.PI * 2); fc.fillStyle = '#fff'; fc.fill();
      fc.lineWidth = Math.max(2, S * 0.007); fc.strokeStyle = '#2b2b3a'; fc.stroke();
      var cx = x + sz * 0.18, cy = y - sz * 0.45 + bob;
      if (mascot && mascot._ok) fc.drawImage(mascot, cx - sz / 2, cy - sz / 2, sz, sz);
      else {
        fc.beginPath(); fc.arc(cx, cy, sz * 0.32, 0, Math.PI * 2); fc.fillStyle = '#ffd23f'; fc.fill();
        fc.lineWidth = Math.max(2, S * 0.008); fc.strokeStyle = '#2b2b3a'; fc.stroke();
        fc.fillStyle = '#2b2b3a';
        fc.beginPath(); fc.arc(cx - sz * 0.1, cy - sz * 0.04, sz * 0.035, 0, Math.PI * 2); fc.arc(cx + sz * 0.1, cy - sz * 0.04, sz * 0.035, 0, Math.PI * 2); fc.fill();
        fc.fillStyle = '#ff4d5a';
        fc.beginPath(); fc.arc(cx - sz * 0.19, cy + sz * 0.08, sz * 0.05, 0, Math.PI * 2); fc.arc(cx + sz * 0.19, cy + sz * 0.08, sz * 0.05, 0, Math.PI * 2); fc.fill();
      }
    }
    // 시범 일정: 획마다 시작 시각과 길이(ms). 획 사이 0.35초, 2번 사이 0.9초 쉼
    function demoPlan() {
      var plan = [], t = 400;
      for (var loop = 0; loop < DEMO_LOOPS; loop++) {
        for (var i = 0; i < lines.length; i++) {
          var dur = Math.max(450, lineLen(lines[i]) / DEMO_SPEED * 1000);
          plan.push({ loop: loop, i: i, t0: t, dur: dur }); t += dur + 350;
        }
        t += 550;
      }
      return { plan: plan, end: t };
    }
    function pointAt(pts, frac) {
      var L = lineLen(pts) * frac, acc = 0;
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], s = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (acc + s >= L) { var t = s ? (L - acc) / s : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
        acc += s;
      }
      return pts[pts.length - 1];
    }
    function partial(pts, frac) { // 획의 앞부분 frac 만큼
      var L = lineLen(pts) * frac, acc = 0, out = [pts[0]];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], s = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (acc + s >= L) { var t = s ? (L - acc) / s : 0; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); return out; }
        out.push(b); acc += s;
      }
      return out;
    }
    function playDemo() {
      stopDemo(true);
      if (!lines.length || solved) return;
      if (reduceMotion) { hint('①번 흰 선부터 따라 써 봐!', 'go'); return; }
      var my = token, pl = demoPlan(), t0 = performance.now();
      demo = { my: my };
      if (opts.onDemo) opts.onDemo(true);
      hint('피카츄가 쓰는 순서를 보여 줄게! 잘 봐!', 'demo');
      (function frame(now) {
        if (!demo || demo.my !== my || token !== my || !alive) return;
        var t = now - t0;
        if (t >= pl.end) { stopDemo(); return; }
        clearCanvas(cvF, fc);
        fc.setTransform(dpr, 0, 0, dpr, 0, 0);
        fc.lineCap = 'round'; fc.lineJoin = 'round'; fc.lineWidth = width * S;
        var head = null, loopNow = 0, i;
        for (i = 0; i < pl.plan.length; i++) if (pl.plan[i].t0 <= t) loopNow = pl.plan[i].loop;
        for (i = 0; i < pl.plan.length; i++) {
          var s = pl.plan[i]; if (s.loop !== loopNow || s.t0 > t) continue;
          var f = Math.min(1, (t - s.t0) / s.dur);
          fc.strokeStyle = ORDER[s.i % ORDER.length];
          var part = partial(lines[s.i], f);
          if (part.length > 1) { pathOn(fc, part); fc.stroke(); }
          head = { p: pointAt(lines[s.i], f), i: s.i, moving: f < 1 };
        }
        if (head) {
          if (head.moving) badge(fc, head.i, true);
          drawMascot(head.p[0] * S, head.p[1] * S, t);
        }
        requestAnimationFrame(frame);
      })(t0);
    }

    // ---------- 틀렸을 때: 차례 획 시작점 깜빡임 ----------
    function pulseStart() {
      var my = token, t0 = performance.now();
      nudge = my;
      (function frame(now) {
        if (nudge !== my || token !== my || demo || solved || !alive) return;
        var t = (now - t0) / 1000;
        clearCanvas(cvF, fc);
        if (t > 1.6) return;
        fc.setTransform(dpr, 0, 0, dpr, 0, 0);
        var p = lines[k][0], r = S * (0.05 + 0.04 * ((t * 2) % 1));
        fc.globalAlpha = 1 - ((t * 2) % 1);
        fc.beginPath(); fc.arc(p[0] * S, p[1] * S, r, 0, Math.PI * 2);
        fc.lineWidth = S * 0.012; fc.strokeStyle = ORDER[k % ORDER.length]; fc.stroke();
        fc.globalAlpha = 1;
        requestAnimationFrame(frame);
      })(t0);
    }

    // ---------- 판정 ----------
    function judge(path) {
      var tol = Math.max(0.055, width * 0.85);
      var r = follow(dense[k], path, tol);
      if (r.ok) return { ok: true };
      // 다른 획을 먼저 썼는지
      for (var j = k + 1; j < lines.length; j++) if (follow(dense[j], path, tol).ok) return { ok: false, why: 'order', j: j };
      // 방향을 거꾸로 썼는지
      if (follow(dense[k].slice().reverse(), path, tol).ok) return { ok: false, why: 'reverse' };
      return { ok: false, why: r.why, prog: r.prog };
    }
    function finishStroke(path) {
      cur = null; redrawInk();
      if (path.length < 3 && lineLen(path) < 0.02) return; // 살짝 닿은 것은 무시
      var r = judge(path);
      if (r.ok) {
        k++;
        if (k >= lines.length) { success(); return; }
        drawGuide(); report();
        if (opts.onStrokeDone) opts.onStrokeDone(k, lines.length);
        hint('좋아! 이번엔 ' + circled(k) + '번 ' + colorName(k) + ' 선!', 'next');
        return;
      }
      var msg = r.why === 'order' ? '앗, 순서가 달라! ' + circled(k) + '번 ' + colorName(k) + ' 선부터 써 봐.'
        : r.why === 'reverse' ? '화살표 방향으로 써 봐! 숫자가 있는 곳에서 시작해.'
        : r.why === 'start' || r.why === 'dir' ? circled(k) + '번 숫자에서 시작해서 화살표 방향으로 써 봐!'
        : r.why === 'off' ? '흰 선을 따라 천천히 써 봐!'
        : '끝까지 쭉 이어서 써 봐!';
      pad.classList.remove('shake'); void pad.offsetWidth; pad.classList.add('shake');
      if (opts.onWrong) opts.onWrong(r.why);
      hint(msg, 'wrong');
      pulseStart();
    }
    function circled(i) { return '①②③④⑤⑥⑦⑧'[i] || String(i + 1); }
    function colorName(i) { return ['빨간', '주황', '초록', '파란', '보라', '분홍'][i % 6]; }
    function success() {
      solved = true; stopDemo(true);
      drawGuide();
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
          s: S * (0.012 + Math.random() * 0.016), c: ORDER[i % 4], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, star: i % 3 === 0 });
      }
      var t0 = performance.now(), my = token;
      (function frame(t) {
        var q = (t - t0) / 1300;
        clearCanvas(cvF, fc);
        if (q >= 1 || my !== token || !alive) return;
        fc.setTransform(dpr, 0, 0, dpr, 0, 0);
        fc.globalAlpha = 1 - q * q;
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
      if (activePointer !== null || solved || !lines.length) return;
      e.preventDefault();
      if (demo) stopDemo(); // 시범 중에 누르면 바로 쓰기 시작
      nudge = null; clearCanvas(cvF, fc);
      activePointer = e.pointerId;
      try { cvI.setPointerCapture(e.pointerId); } catch (x) {}
      cur = [pos(e)];
      redrawInk();
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
        cur.push(p);
      });
    });
    function end(e) {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      var path = cur;
      if (!solved && path) finishStroke(path); else { cur = null; redrawInk(); }
    }
    cvI.addEventListener('pointerup', end);
    cvI.addEventListener('pointercancel', end);
    cvI.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

    function clear() { // 처음 획부터 다시
      token++; stopDemo(true); nudge = null;
      k = 0; cur = null; activePointer = null;
      clearCanvas(cvI, ic); clearCanvas(cvF, fc);
      drawGuide(); report();
    }

    return {
      el: pad,
      // 새 글자 놓기 → 칸을 그리고 피카츄 시범 시작(o.noDemo 면 시범 없이)
      setLetter: function (letter, _color, o) {
        var data = letterStrokes(letter);
        ch = letter; solved = false;
        lines = data ? data.lines : []; width = data ? data.width : 0.08;
        dense = lines.map(function (l) { return resample(l, STEP); });
        clear(); resize();
        if (!(o && o.noDemo)) playDemo();
        else hint('①번 흰 선부터 따라 써 봐!', 'go');
        return Promise.resolve();
      },
      // 순서 다시 보기 (처음 획부터)
      demo: function () { if (!solved && lines.length) { clear(); playDemo(); } },
      clear: clear,
      resize: resize,
      isSolved: function () { return solved; },
      isDemo: function () { return !!demo; },
      // 시험용: 획 데이터와 진행 상태
      stats: function () { return { k: k, total: lines.length, lines: lines, width: width, solved: solved, demo: !!demo }; },
      destroy: function () {
        alive = false; token++; demo = null;
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
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
    var st = STAGES[Math.min(i, STAGES.length - 1)], n = Math.floor(Math.random() * st.items.length);
    return { ch: st.items[n], say: st.say[n], stage: st.id };
  }

  window.TRACE = { STAGES: STAGES, INK: INK, ORDER: ORDER, createPad: createPad, speak: speak, randomLetter: randomLetter,
    letterStrokes: letterStrokes, follow: follow };
})();
