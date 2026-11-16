// 포켓몬 퀴즈 탐험대 — 화면, 필드, 배틀, 도감, 출석 도장
(function () {
  'use strict';
  var POKEMON = window.POKEMON, QUIZ = window.QUIZ, SAVE = window.SAVE, SFX = window.SFX, TRACE = window.TRACE;
  var AREA_KEYS = ['math', 'korean', 'write', 'english'];
  var $ = function (id) { return document.getElementById(id); };
  var ART = function (id) { return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + id + '.png'; };
  var BY_ID = {}; POKEMON.forEach(function (p) { BY_ID[p.id] = p; });

  // ---------- 설정 값 ----------
  var CFG = {
    hearts: 3,
    normalQuestions: 3,     // 포켓몬을 잡으려면 맞혀야 하는 문제 수
    goldQuestions: 4,
    ballsOnField: 3,
    goldChance: 0.15,       // 볼이 새로 나올 때 금색일 확률
    goldPity: 6,            // 금색 없이 배틀을 이만큼 하면 다음 볼은 꼭 금색
    uncaughtWeight: 4       // 아직 못 잡은 포켓몬이 더 잘 나오게
  };
  var TYPES = {
    normal: ['노말', '#a8a77a'], fire: ['불꽃', '#ee8130'], water: ['물', '#6390f0'], electric: ['전기', '#e8b800'],
    grass: ['풀', '#5fb83a'], ice: ['얼음', '#5ec8c4'], fighting: ['격투', '#c22e28'], poison: ['독', '#a33ea1'],
    ground: ['땅', '#c9a23c'], flying: ['비행', '#8f78e8'], psychic: ['에스퍼', '#f95587'], bug: ['벌레', '#92a815'],
    rock: ['바위', '#b6a136'], ghost: ['고스트', '#735797'], dragon: ['드래곤', '#6f35fc'], dark: ['악', '#705746'],
    steel: ['강철', '#8f8fb0'], fairy: ['페어리', '#d685ad']
  };
  var REGIONS = {
    forest: { name: '숲', em: '🌳', types: ['grass', 'bug', 'poison', 'fairy'], deco: ['🌳', '🌲', '🌼', '🍄', '🌿', '🌳', '🌷', '🪵'] },
    city: { name: '도시', em: '🏙️', types: ['normal', 'electric', 'psychic', 'ghost', 'fighting', 'steel'], deco: ['🏢', '🏠', '🏪', '🚦', '🌳', '🏬', '🏡', '🚏'] },
    desert: { name: '사막', em: '🏜️', types: ['ground', 'rock', 'fire', 'dragon', 'dark'], deco: ['🌵', '🪨', '🌵', '🦎', '🌾', '🌵', '🪨', '🦂'] },
    sea: { name: '바다', em: '🌊', types: ['water', 'ice', 'flying'], deco: ['🌴', '🐚', '⛱️', '🪸', '🐚', '🌴', '⭐', '🦀'] }
  };
  var REGION_KEYS = ['forest', 'city', 'desert', 'sea'];

  // ---------- 작은 도구 ----------
  function rand(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rand(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[rand(a.length)]; }
  function weighted(list, wf) {
    var total = 0, ws = list.map(function (x) { var w = wf(x); total += w; return w; });
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) { r -= ws[i]; if (r < 0) return list[i]; }
    return list[list.length - 1];
  }
  function josa(word, withBat, noBat) { // 이/가, 을/를, 은/는, 와/과
    var s = String(word).replace(/[^가-힣]/g, '');
    var ch = s.charCodeAt(s.length - 1) - 0xAC00;
    var bat = ch >= 0 && ch < 11172 && ch % 28 !== 0;
    return word + (bat ? withBat : noBat);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function typeBadges(types) { return types.map(function (t) { var T = TYPES[t] || [t, '#999']; return '<span class="type" style="background:' + T[1] + '">' + T[0] + '</span>'; }).join(''); }
  function ballHTML(gold) { return '<div class="pball' + (gold ? ' gold' : '') + '"><span class="shine"></span></div>'; }
  function isEmojiOnly(s) { return /^[\p{Extended_Pictographic}‍️\s]+$/u.test(s); }
  function inRegion(p, rk) { return p.types.some(function (t) { return REGIONS[rk].types.indexOf(t) >= 0; }); }
  function imgFallback(img) {
    img.onerror = function () { img.onerror = null; img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#ddd" stroke="#555" stroke-width="5"/><text x="50" y="66" font-size="46" text-anchor="middle" fill="#555">?</text></svg>'); };
  }

  // ---------- 화면 전환 ----------
  var current = 'title', dexReturn = 'title';
  function show(name) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === 'scr-' + name); });
    current = name;
    if (name === 'field') Field.start(); else Field.stop();
    if (name === 'title') renderTitle();
    if (name === 'region') renderRegions();
    if (name !== 'trace') Practice.leave();
    if (name !== 'home') Home.stop();
  }
  document.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { SFX.play('tap'); show(b.getAttribute('data-go')); }); });

  // ---------- 소리 버튼 ----------
  function renderSound() { $('soundBtn').textContent = SAVE.data.settings.sound ? '🔊' : '🔇'; SFX.setEnabled(SAVE.data.settings.sound); }
  $('soundBtn').addEventListener('click', function () { SAVE.data.settings.sound = !SAVE.data.settings.sound; SAVE.persist(); renderSound(); SFX.play('tap'); });

  // ---------- 창(모달) ----------
  var modalOnClose = null;
  function openModal(html, onClose) { $('modalBody').innerHTML = html; $('modal').classList.add('on'); modalOnClose = onClose || null; }
  function closeModal() { $('modal').classList.remove('on'); var f = modalOnClose; modalOnClose = null; if (f) f(); }
  $('modalX').addEventListener('click', closeModal);
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeModal(); });

  // ---------- 타이틀 ----------
  function renderTitle() {
    $('dexCount').textContent = SAVE.caughtCount() + '/' + POKEMON.length;
    $('stampCount').textContent = SAVE.data.stamps.length + '개';
    $('traceCount').textContent = Practice.doneCount() + '/' + Practice.total();
  }
  (function titleFloat() {
    var spots = [[25, '5%', '8%'], [1, '83%', '64%'], [4, '2%', '68%'], [7, '85%', '10%']];
    $('titleFloat').innerHTML = spots.map(function (s, i) {
      return '<img src="' + ART(s[0]) + '" style="left:' + s[1] + ';top:' + s[2] + ';animation-delay:' + (i * 0.4) + 's" alt="" onerror="this.remove()">';
    }).join('');
    document.querySelector('.logo-ball').innerHTML = ballHTML(false);
    document.querySelector('.logo-ball .pball').style.cssText = 'width:100%;height:100%;font-size:0.9rem';
  })();
  $('btnStart').addEventListener('click', function () { SFX.play('tap'); show('region'); });
  $('btnDex').addEventListener('click', function () { SFX.play('tap'); openDex('title'); });
  $('btnTrace').addEventListener('click', function () { SFX.play('tap'); Practice.open(); });
  $('btnStamps').addEventListener('click', function () { SFX.play('tap'); showStamps(false); });
  $('btnParent').addEventListener('click', function () { SFX.play('tap'); showSettings(); });
  // 전체 화면 (안드로이드·PC 브라우저. 아이폰은 「홈 화면에 추가」로 전체 화면)
  (function () {
    var de = document.documentElement, b = $('btnFull');
    var req = de.requestFullscreen || de.webkitRequestFullscreen;
    if (!req || !(document.fullscreenEnabled || document.webkitFullscreenEnabled)) return;
    var isFull = function () { return !!(document.fullscreenElement || document.webkitFullscreenElement); };
    var label = function () { b.textContent = isFull() ? '⛶ 전체 화면 끄기' : '⛶ 전체 화면'; };
    b.hidden = false; label();
    document.addEventListener('fullscreenchange', label);
    document.addEventListener('webkitfullscreenchange', label);
    b.addEventListener('click', function () {
      SFX.play('tap');
      if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      try {
        var p = req.call(de);
        if (p && p.then) p.then(function () { try { screen.orientation.lock('landscape').catch(function () {}); } catch (e) {} }).catch(function () {});
      } catch (e) {}
    });
  })();

  var STAMP_EM = ['⭐', '🌸', '🍀', '🍓', '🌈', '🎈', '🐣', '🍩', '⚡', '🔥', '💧', '🌙'];
  function showStamps(isNew) {
    var st = SAVE.data.stamps;
    var cells = st.map(function (d, i) {
      var p = d.split('-');
      return '<div class="stamp' + (isNew && i === st.length - 1 ? ' new' : '') + '"><b>' + STAMP_EM[i % STAMP_EM.length] + '</b>' + (+p[1]) + '/' + (+p[2]) + '</div>';
    }).join('');
    openModal('<h3>' + (isNew ? '오늘의 출석 도장 쾅! 🎉' : '💮 출석 도장') + '</h3>' +
      '<div>모은 도장: <b>' + st.length + '개</b></div>' +
      '<div class="stamps">' + (cells || '<div>아직 도장이 없어요</div>') + '</div>' +
      '<button class="btn primary" id="stampOk">좋아!</button>');
    $('stampOk').addEventListener('click', closeModal);
  }

  function showSettings() {
    var a = SAVE.data.settings.areas;
    var row = function (k) { return '<label><input type="checkbox" data-area="' + k + '"' + (a[k] ? ' checked' : '') + '> ' + QUIZ.labels[k] + '</label>'; };
    openModal('<h3>⚙️ 어른용 설정</h3><div class="settings">' +
      '<div>나올 문제 영역</div>' + AREA_KEYS.map(row).join('') +
      '<div class="note">하나 이상은 켜 두어야 해요.</div><hr>' +
      '<button class="btn small" id="resetBtn">기록 지우기 (도장은 남김)</button>' +
      '<div class="note" id="resetNote"></div></div>');
    document.querySelectorAll('[data-area]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var k = cb.getAttribute('data-area');
        a[k] = cb.checked;
        if (!Object.keys(a).some(function (x) { return a[x]; })) { a[k] = true; cb.checked = true; }
        SAVE.persist();
      });
    });
    var armed = false;
    $('resetBtn').addEventListener('click', function () {
      if (!armed) { armed = true; $('resetBtn').textContent = '정말 지울까요? 한 번 더 누르세요'; return; }
      SAVE.reset(); $('resetNote').textContent = '잡은 포켓몬 기록을 지웠어요.'; $('resetBtn').disabled = true; renderTitle();
    });
  }

  // ---------- 지역 고르기 ----------
  var region = 'forest';
  function regionCount(rk) {
    var list = POKEMON.filter(function (p) { return inRegion(p, rk); });
    return [list.filter(function (p) { return SAVE.isCaught(p.id); }).length, list.length];
  }
  function renderRegions() {
    $('regionList').innerHTML = REGION_KEYS.map(function (rk) {
      var R = REGIONS[rk], c = regionCount(rk);
      return '<button class="region-card r-' + rk + '" data-region="' + rk + '"><div class="em">' + R.em + '</div><div class="nm">' + R.name + '</div>' +
        '<div class="ty">' + typeBadges(R.types) + '</div><div class="ct">잡은 포켓몬 ' + c[0] + '/' + c[1] + '</div></button>';
    }).join('');
    document.querySelectorAll('[data-region]').forEach(function (b) {
      b.addEventListener('click', function () { SFX.play('tap'); Field.setRegion(b.getAttribute('data-region')); show('field'); });
    });
  }

  // =====================================================================
  // 필드
  // =====================================================================
  var PLAYER_SVG = '<svg class="body" viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">' +
    '<ellipse cx="50" cy="126" rx="26" ry="5" fill="rgba(0,0,0,.2)"/>' +
    '<rect x="34" y="96" width="12" height="26" rx="5" fill="#3b4a8c"/><rect x="54" y="96" width="12" height="26" rx="5" fill="#3b4a8c"/>' +
    '<rect x="30" y="118" width="18" height="8" rx="4" fill="#ff4d5a"/><rect x="52" y="118" width="18" height="8" rx="4" fill="#ff4d5a"/>' +
    '<rect x="26" y="62" width="48" height="40" rx="14" fill="#3fa7ff" stroke="#2b2b3a" stroke-width="3"/>' +
    '<rect x="16" y="66" width="12" height="28" rx="6" fill="#ffd9b3" stroke="#2b2b3a" stroke-width="2.5"/><rect x="72" y="66" width="12" height="28" rx="6" fill="#ffd9b3" stroke="#2b2b3a" stroke-width="2.5"/>' +
    '<circle cx="50" cy="40" r="25" fill="#ffd9b3" stroke="#2b2b3a" stroke-width="3"/>' +
    '<path d="M24 36 Q26 12 50 12 Q74 12 76 36 Z" fill="#ff4d5a" stroke="#2b2b3a" stroke-width="3"/>' +
    '<path d="M60 34 Q80 32 88 38 Q78 42 60 40 Z" fill="#ff4d5a" stroke="#2b2b3a" stroke-width="2.5"/>' +
    '<circle cx="50" cy="24" r="5" fill="#fff" stroke="#2b2b3a" stroke-width="2"/>' +
    '<circle cx="44" cy="44" r="3.5" fill="#2b2b3a"/><circle cx="60" cy="44" r="3.5" fill="#2b2b3a"/>' +
    '<circle cx="38" cy="52" r="3.5" fill="#ff9aa2"/><circle cx="66" cy="52" r="3.5" fill="#ff9aa2"/>' +
    '<path d="M46 53 Q52 58 57 53" stroke="#2b2b3a" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>';

  // 지역 장식(나무·건물·선인장·조개 등). 필드와 포켓몬 홈이 함께 씀
  function decoHTML(rk) {
    var R = REGIONS[rk], seed = REGION_KEYS.indexOf(rk) * 97 + 13;
    var r = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var html = '';
    for (var i = 0; i < 16; i++) {
      var x = 4 + r() * 92, y = 22 + r() * 76, size = 2.2 + r() * 2.2;
      if (rk === 'sea' && y < 42 && R.deco[i % R.deco.length] !== '⛱️') y = 44 + r() * 50;
      html += '<span style="left:' + x + '%;top:' + y + '%;font-size:' + size + 'rem;opacity:.92">' + R.deco[i % R.deco.length] + '</span>';
    }
    if (rk === 'sea') html += '<span style="left:20%;top:30%;font-size:3rem">⛵</span><span style="left:70%;top:22%;font-size:2.4rem">🐳</span>';
    if (rk === 'desert') html += '<span style="left:85%;top:20%;font-size:3.2rem">☀️</span>';
    return html;
  }

  var Field = (function () {
    var el = $('field'), playerEl = $('player'), ballsEl = $('balls');
    var F = { running: false, raf: 0, last: 0, w: 0, h: 0, px: 0, py: 0, tx: null, ty: null, face: 1, balls: [], keys: {}, dragging: false, lock: 0, built: null, ph: 80, br: 24, top: 60 };
    playerEl.innerHTML = PLAYER_SVG;

    function measure() {
      var r = el.getBoundingClientRect(), ow = F.w, oh = F.h;
      F.w = r.width; F.h = r.height;
      var S = Math.min(F.w, F.h);
      F.ph = Math.max(64, Math.min(130, S * 0.22));
      F.br = Math.max(20, Math.min(40, S * 0.055));
      F.top = Math.max(50, document.querySelector('.hud').getBoundingClientRect().height + 6);
      if (ow && oh && (ow !== F.w || oh !== F.h)) {
        var sx = F.w / ow, sy = F.h / oh;
        F.px *= sx; F.py *= sy;
        F.balls.forEach(function (b) { b.x *= sx; b.y *= sy; });
      }
      playerEl.style.width = (F.ph * 100 / 130) + 'px'; playerEl.style.height = F.ph + 'px';
      F.balls.forEach(sizeBall);
    }
    function sizeBall(b) { b.el.style.width = b.el.style.height = (F.br * 2) + 'px'; b.el.style.fontSize = (F.br / 9) + 'px'; }
    function clampP() {
      var hw = F.ph * 0.35;
      F.px = Math.max(hw, Math.min(F.w - hw, F.px));
      F.py = Math.max(F.top + F.ph * 0.8, Math.min(F.h - 4, F.py));
    }
    function buildDeco() {
      var R = REGIONS[region];
      $('deco').innerHTML = decoHTML(region);
      el.className = region;
      $('fieldTitle').textContent = R.em + ' ' + R.name;
    }
    function spawnBall(forceGold) {
      var hasGold = F.balls.some(function (b) { return b.gold; });
      var gold = forceGold || (!hasGold && (Math.random() < CFG.goldChance || SAVE.data.stats.sinceGold >= CFG.goldPity));
      var b = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, gold: !!gold, turn: 0, el: document.createElement('div') };
      b.el.className = 'ball' + (gold ? ' gold' : '');
      b.el.innerHTML = '<div class="ball-shadow"></div>' + ballHTML(gold);
      sizeBall(b);
      var tries = 0;
      do {
        b.x = F.br + Math.random() * (F.w - F.br * 2);
        b.y = F.top + F.br + Math.random() * (F.h - F.top - F.br * 2);
        tries++;
      } while (tries < 30 && Math.hypot(b.x - F.px, b.y - (F.py - F.ph * 0.4)) < Math.min(F.w, F.h) * 0.35);
      newDir(b);
      ballsEl.appendChild(b.el);
      F.balls.push(b);
      return b;
    }
    function newDir(b) {
      var S = Math.min(F.w, F.h), sp = S * (b.gold ? 0.16 : 0.1) * (0.7 + Math.random() * 0.6), ang = Math.random() * Math.PI * 2;
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp; b.turn = 1.5 + Math.random() * 2.5;
    }
    function render() {
      playerEl.style.transform = 'translate(' + (F.px - F.ph * 50 / 130) + 'px,' + (F.py - F.ph) + 'px)';
      playerEl.classList.toggle('left', F.face < 0);
      F.balls.forEach(function (b) {
        b.el.style.transform = 'translate(' + (b.x - F.br) + 'px,' + (b.y - F.br) + 'px)';
        b.el.querySelector('.pball').style.transform = 'rotate(' + b.rot + 'deg)';
      });
    }
    function step(t) {
      if (!F.running) return;
      var dt = Math.min(0.05, (t - (F.last || t)) / 1000); F.last = t;
      var S = Math.min(F.w, F.h), sp = S * 0.6, moving = false;
      var kx = (F.keys.right ? 1 : 0) - (F.keys.left ? 1 : 0), ky = (F.keys.down ? 1 : 0) - (F.keys.up ? 1 : 0);
      if (kx || ky) {
        var l = Math.hypot(kx, ky); F.px += kx / l * sp * dt; F.py += ky / l * sp * dt; F.tx = null; moving = true;
        if (kx) F.face = kx;
      } else if (F.tx !== null) {
        var dx = F.tx - F.px, dy = F.ty - F.py, d = Math.hypot(dx, dy);
        if (d < 3) { F.tx = null; } else {
          var m = Math.min(d, sp * dt); F.px += dx / d * m; F.py += dy / d * m; moving = true;
          if (Math.abs(dx) > 2) F.face = dx > 0 ? 1 : -1;
        }
      }
      clampP();
      playerEl.classList.toggle('walk', moving);
      if (moving) $('fieldHint').classList.add('hide');
      // 볼 굴리기
      F.balls.forEach(function (b) {
        b.turn -= dt; if (b.turn <= 0) newDir(b);
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < F.br) { b.x = F.br; b.vx = Math.abs(b.vx); }
        if (b.x > F.w - F.br) { b.x = F.w - F.br; b.vx = -Math.abs(b.vx); }
        if (b.y < F.top + F.br) { b.y = F.top + F.br; b.vy = Math.abs(b.vy); }
        if (b.y > F.h - F.br) { b.y = F.h - F.br; b.vy = -Math.abs(b.vy); }
        b.rot += (b.vx >= 0 ? 1 : -1) * Math.hypot(b.vx, b.vy) * dt / F.br * 57.3;
      });
      render();
      // 닿았는지
      if (F.lock > 0) F.lock -= dt;
      else {
        var cx = F.px, cy = F.py - F.ph * 0.4;
        for (var i = 0; i < F.balls.length; i++) {
          var b = F.balls[i];
          if (Math.hypot(b.x - cx, b.y - cy) < F.br + F.ph * 0.32) { hit(b); return; }
        }
      }
      F.raf = requestAnimationFrame(step);
    }
    function hit(b) {
      F.running = false; F.tx = null; F.keys = {};
      playerEl.classList.remove('walk');
      b.el.classList.add('pop');
      F.balls.splice(F.balls.indexOf(b), 1);
      setTimeout(function () { b.el.remove(); }, 300);
      Battle.start(b.gold);
    }
    function setTarget(e) {
      var r = el.getBoundingClientRect();
      F.tx = e.clientX - r.left; F.ty = e.clientY - r.top + F.ph * 0.15;
      var tm = $('tapMark'); tm.style.left = (e.clientX - r.left) + 'px'; tm.style.top = (e.clientY - r.top) + 'px';
      tm.classList.remove('on'); void tm.offsetWidth; tm.classList.add('on');
    }
    el.addEventListener('pointerdown', function (e) { if (!F.running) return; F.dragging = true; setTarget(e); try { el.setPointerCapture(e.pointerId); } catch (x) {} });
    el.addEventListener('pointermove', function (e) { if (F.dragging && F.running) setTarget(e); });
    ['pointerup', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, function () { F.dragging = false; }); });
    window.addEventListener('resize', function () { if (current === 'field') { measure(); clampP(); render(); } });

    var KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    var KEYCODE = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' };
    window.addEventListener('keydown', function (e) {
      if (current !== 'field' || $('modal').classList.contains('on')) return;
      var k = KEYMAP[e.key] || KEYCODE[e.code];
      if (k) { F.keys[k] = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', function (e) { var k = KEYMAP[e.key] || KEYCODE[e.code]; if (k) F.keys[k] = false; });
    window.addEventListener('blur', function () { F.keys = {}; });

    return {
      F: F,
      setRegion: function (rk) { region = rk; F.built = null; },
      start: function () {
        measure();
        if (F.built !== region) {
          buildDeco();
          F.balls.forEach(function (b) { b.el.remove(); }); F.balls = [];
          F.px = F.w / 2; F.py = F.h * 0.62; F.tx = null;
          $('fieldHint').classList.remove('hide');
          clearTimeout(F.hintTimer);
          F.hintTimer = setTimeout(function () { $('fieldHint').classList.add('hide'); }, 7000);
          F.built = region;
        }
        clampP();
        while (F.balls.length < CFG.ballsOnField) spawnBall();
        F.lock = 0.8; F.running = true; F.last = 0; F.keys = {};
        render();
        cancelAnimationFrame(F.raf); F.raf = requestAnimationFrame(step);
      },
      stop: function () { F.running = false; cancelAnimationFrame(F.raf); playerEl.classList.remove('walk'); },
      spawnBall: spawnBall
    };
  })();
  $('btnFieldBack').addEventListener('click', function (e) { e.stopPropagation(); SFX.play('tap'); show('region'); });
  $('btnFieldDex').addEventListener('click', function (e) { e.stopPropagation(); SFX.play('tap'); openDex('field'); });
  ['btnFieldBack', 'btnFieldDex'].forEach(function (id) { $(id).addEventListener('pointerdown', function (e) { e.stopPropagation(); }); });

  // =====================================================================
  // 문제 고르기
  // =====================================================================
  var recentQ = [];
  function pickQuestion(cat) {
    if (cat === 'math') return QUIZ.makeMath();
    if (cat === 'write') {
      var L, n = 0;
      do { L = TRACE.randomLetter(); n++; } while (n < 10 && recentQ.indexOf(L.ch) >= 0);
      recentQ.push(L.ch); if (recentQ.length > 60) recentQ.shift();
      return { cat: 'write', t: 'trace', trace: true, ch: L.ch, say: L.say, q: '「' + L.ch + '」 따라 써 봐!' };
    }
    var bank = QUIZ.bank[cat], types = {};
    bank.forEach(function (q) { types[q.t] = 1; });
    var tlist = Object.keys(types), q, tries = 0;
    do {
      var t = pick(tlist);
      q = pick(bank.filter(function (x) { return x.t === t; }));
      tries++;
    } while (tries < 20 && recentQ.indexOf(q) >= 0);
    recentQ.push(q); if (recentQ.length > 60) recentQ.shift();
    return q;
  }
  function pickQuestions(n) {
    var a = SAVE.data.settings.areas;
    var cats = AREA_KEYS.filter(function (k) { return a[k]; });
    var order = [];
    while (order.length < n) order = order.concat(shuffle(cats));
    return order.slice(0, n).map(pickQuestion);
  }

  // =====================================================================
  // 배틀
  // =====================================================================
  var Battle = (function () {
    var B = null, timers = [];
    var img = $('monImg');
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function chooseMon(gold) {
      var pool;
      if (gold) {
        pool = POKEMON.filter(function (p) { return p.rare && inRegion(p, region); });
        if (pool.length < 3) pool = POKEMON.filter(function (p) { return p.rare; });
      } else {
        pool = POKEMON.filter(function (p) { return !p.rare && inRegion(p, region); });
      }
      var last = SAVE.data.stats.lastMon;
      if (pool.length > 1) pool = pool.filter(function (p) { return p.id !== last; });
      return weighted(pool, function (p) { return SAVE.isCaught(p.id) ? 1 : CFG.uncaughtWeight; });
    }

    function start(gold) {
      clearTimers();
      var mon = chooseMon(gold);
      SAVE.data.stats.lastMon = mon.id;
      SAVE.data.stats.battles++;
      SAVE.data.stats.sinceGold = gold ? 0 : SAVE.data.stats.sinceGold + 1;
      SAVE.persist();
      var others = shuffle(POKEMON.filter(function (p) { return p.id !== mon.id && p.name !== mon.name; })).slice(0, 3);
      B = { mon: mon, gold: gold, hearts: CFG.hearts, phase: 'intro', qs: pickQuestions(gold ? CFG.goldQuestions : CFG.normalQuestions), qi: 0,
        nameChoices: shuffle([mon.name].concat(others.map(function (p) { return p.name; }))), choices: [], answer: null, wrong: {}, busy: true };
      SFX.play('battle'); if (gold) later(function () { SFX.play('gold'); }, 400);
      var fl = $('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
      later(function () {
        var scr = $('scr-battle');
        scr.className = 'screen ' + (gold ? 'goldb' : region);
        show('battle');
        img.className = 'mon sil loading';
        imgFallback(img);
        img.onload = function () { img.classList.remove('loading'); img.classList.add('appear'); };
        img.src = ART(mon.id);
        $('throwBall').className = 'throw-ball'; $('throwBall').innerHTML = ballHTML(gold);
        $('burst').innerHTML = '';
        $('monInfo').innerHTML = '';
        renderHearts();
        setBubble(gold ? '✨ 금색 볼! 전설의 포켓몬일지도?' : '앗! 야생 포켓몬이 나타났다!', '', '');
        $('choices').innerHTML = ''; $('actions').innerHTML = '';
        $('progress').textContent = '';
        later(askWho, 1100);
      }, 650);
    }

    function renderHearts(lostAnim) {
      var h = '';
      for (var i = 0; i < CFG.hearts; i++) h += '<span class="' + (i < B.hearts ? '' : 'lost') + '">' + (i < B.hearts ? '❤️' : '🤍') + '</span>';
      $('hearts').innerHTML = h;
      if (!lostAnim) $('hearts').querySelectorAll('.lost').forEach(function (s) { s.style.animation = 'none'; });
    }
    function setBubble(text, cat, e) {
      $('qText').textContent = text; $('qCat').textContent = cat || '';
      var qe = $('qE'); qe.textContent = e || '';
      qe.classList.toggle('small', !!e && Array.from(e).length > 12);
    }
    function setChoices(list, answer) {
      B.choices = list; B.answer = answer; B.wrong = {}; B.busy = false;
      $('actions').innerHTML = '';
      $('choices').innerHTML = list.map(function (c, i) {
        var s = String(c), cls = 'choice';
        if (isEmojiOnly(s)) cls += ' emoji';
        else if (s.length > 11) cls += ' xlong';
        else if (s.length > 6) cls += ' long';
        return '<button class="' + cls + '" data-i="' + i + '"><span class="num">' + (i + 1) + '</span>' + esc(s) + '</button>';
      }).join('');
      $('choices').querySelectorAll('.choice').forEach(function (b) {
        b.addEventListener('click', function () { choose(+b.getAttribute('data-i')); });
      });
    }
    function setActions(btns) {
      $('choices').innerHTML = '';
      $('actions').innerHTML = btns.map(function (b, i) { return '<button class="btn ' + (b.cls || (i === 0 ? 'primary' : '')) + '" data-a="' + i + '">' + b.label + '</button>'; }).join('');
      $('actions').querySelectorAll('[data-a]').forEach(function (el) {
        el.addEventListener('click', function () { var b = btns[+el.getAttribute('data-a')]; SFX.play('tap'); b.fn(); });
      });
    }

    function askWho() {
      B.phase = 'who';
      setBubble('누구일까?', '잘 보고 골라 봐!', '');
      setChoices(B.nameChoices, B.mon.name);
    }
    function reveal() {
      B.phase = 'reveal';
      img.classList.remove('sil', 'appear');
      img.classList.add('faded'); // 잡을 때까지 70%
      var mon = B.mon;
      $('monInfo').innerHTML = '<div class="nm">' + esc(mon.name) + (SAVE.isCaught(mon.id) ? '' : ' <span class="new">NEW</span>') + '</div><div class="types">' + typeBadges(mon.types) + '</div>';
      setBubble('정답! 나는 ' + mon.name + '!', '', '');
      later(function () {
        setBubble('내 문제 ' + B.qs.length + '개를 다 맞히면 잡을 수 있어!', '', '');
        setActions([{ label: '문제 풀기 ▶', fn: askQ }]);
      }, 1200);
    }
    function askQ() {
      B.phase = 'quiz';
      var q = B.qs[B.qi];
      $('progress').textContent = '문제 ' + (B.qi + 1) + ' / ' + B.qs.length;
      setBubble(q.q, QUIZ.labels[q.cat], q.e || '');
      if (q.trace) askTrace(q);
      else setChoices(shuffle([q.a].concat(q.w)), q.a);
    }
    // ✍️ 따라쓰기 문제: 보기 대신 쓰기 칸. 다 쓰면 정답, 선 밖으로 나가도 하트는 안 깎음.
    var bPad = null;
    function dropPad() { if (bPad) { bPad.destroy(); bPad = null; } $('scr-battle').classList.remove('tracing'); }
    function askTrace(q) {
      dropPad();
      B.busy = true; B.choices = []; B.answer = null;
      $('actions').innerHTML = '';
      $('choices').innerHTML = '<div class="bt-trace"><div class="bt-pad" id="btPad"></div>' +
        '<div class="bt-tools"><div class="tr-meter"><i id="btMeter"></i></div>' +
        '<button class="btn small" id="btDemo">👀 순서</button><button class="btn small" id="btSound">🔊</button><button class="btn small" id="btClear">↺ 다시</button></div></div>';
      $('scr-battle').classList.add('tracing');
      var my = B;
      bPad = TRACE.createPad($('btPad'), {
        mascot: ART(133), mascotName: '이브이', // 이브이가 쓰는 순서 시범
        onProgress: function (r) { var m = $('btMeter'); if (m) { m.style.width = (r * 100) + '%'; m.classList.toggle('full', r >= 1); } },
        onWrong: function () { SFX.play('wrong'); },
        onStrokeDone: function () { SFX.play('tap'); },
        onHint: function (text) { $('qCat').textContent = text; },
        onSuccess: function () {
          if (B !== my) return;
          SFX.play('correct');
          $('qCat').textContent = q.say + '! 잘 썼어!';
          later(function () { TRACE.speak(q.say); }, 300);
          B.qi++;
          later(function () { dropPad(); if (B.qi < B.qs.length) askQ(); else readyToThrow(); }, 1500);
        }
      });
      $('btSound').addEventListener('click', function () { TRACE.speak(q.say); });
      $('btClear').addEventListener('click', function () { SFX.play('tap'); if (bPad && !bPad.isSolved()) { bPad.clear(); $('qCat').textContent = '①번 흰 선부터 다시 써 봐!'; } });
      $('btDemo').addEventListener('click', function () { SFX.play('tap'); if (bPad) bPad.demo(); });
      bPad.setLetter(q.ch, TRACE.INK[rand(TRACE.INK.length)]);
      later(function () { TRACE.speak(q.say); }, 250);
    }
    function choose(i) {
      if (!B || B.busy || B.wrong[i]) return;
      var btn = $('choices').querySelector('[data-i="' + i + '"]');
      var val = B.choices[i];
      if (String(val) === String(B.answer)) {
        B.busy = true;
        btn.classList.add('right');
        SFX.play('correct');
        if (B.phase === 'who') later(reveal, 600);
        else {
          B.qi++;
          later(function () { if (B.qi < B.qs.length) askQ(); else readyToThrow(); }, 800);
        }
      } else {
        B.wrong[i] = true;
        btn.classList.add('wrong', 'wiggle'); btn.disabled = true;
        SFX.play('wrong');
        B.hearts--;
        renderHearts(true);
        img.classList.remove('hit'); void img.offsetWidth; img.classList.add('hit');
        if (B.hearts <= 0) { B.busy = true; later(flee, 700); }
        else $('qCat').textContent = '괜찮아! 다시 골라 봐!';
      }
    }
    function readyToThrow() {
      B.phase = 'throw';
      $('progress').textContent = '';
      setBubble('다 맞혔어! 지금이야!', '', '');
      setActions([{ label: '⚪ 몬스터볼 던지기!', cls: 'primary', fn: throwBall }]);
    }
    function throwBall() {
      B.phase = 'catching';
      $('actions').innerHTML = '';
      setBubble('가라, 몬스터볼!', '', '');
      var tb = $('throwBall');
      SFX.play('throwBall');
      tb.className = 'throw-ball fly';
      later(function () { img.classList.add('absorb'); }, 650);
      later(function () { tb.className = 'throw-ball sit'; }, 750);
      later(function () { tb.className = 'throw-ball wob'; SFX.play('wobble'); }, 1100);
      later(function () { SFX.play('wobble'); }, 1700);
      later(function () { SFX.play('wobble'); }, 2300);
      later(caught, 2950);
    }
    function caught() {
      var mon = B.mon;
      var isNew = SAVE.catchMon(mon.id, region);
      B.phase = 'done';
      $('throwBall').className = 'throw-ball done';
      SFX.play('caught');
      var stars = ['⭐', '✨', '🌟', '⭐', '✨', '🌟', '⭐', '✨'];
      $('burst').innerHTML = stars.map(function (s, i) {
        var a = i / stars.length * Math.PI * 2;
        return '<span style="--dx:' + Math.round(Math.cos(a) * 140) + '%;--dy:' + Math.round(Math.sin(a) * 140) + '%">' + s + '</span>';
      }).join('');
      setBubble(josa(mon.name, '을', '를') + ' 잡았다! 🎉', isNew ? '도감에 새로 등록했어!' : '또 만났네! (' + SAVE.data.caught[mon.id].n + '번째)', '');
      later(function () {
        img.className = 'mon';
        $('throwBall').className = 'throw-ball';
        $('burst').innerHTML = '';
      }, 1500);
      setActions([{ label: '🗺️ 필드로', fn: toField }, { label: '📖 도감 보기', cls: 'yellow', fn: function () { openDex('field'); } }]);
    }
    function flee() {
      B.phase = 'fled';
      SFX.play('flee');
      img.classList.add('flee');
      $('progress').textContent = '';
      setBubble(B.phase === 'fled' && img.classList.contains('sil') ? '포켓몬이 도망갔어… 다음엔 꼭 잡자!' : josa(B.mon.name, '이', '가') + ' 도망갔어… 다음엔 꼭 잡자!', '', '');
      setActions([{ label: '🗺️ 필드로', fn: toField }]);
    }
    function toField() { clearTimers(); dropPad(); B = null; show('field'); }
    function run() { clearTimers(); dropPad(); B = null; show('field'); }

    // 키보드: 1~4 로 보기 고르기, Enter/Space 로 큰 버튼
    window.addEventListener('keydown', function (e) {
      if (current !== 'battle' || !B || $('modal').classList.contains('on')) return;
      var n = { '1': 0, '2': 1, '3': 2, '4': 3 }[e.key];
      if (n === undefined && /^Numpad[1-4]$/.test(e.code)) n = +e.code.slice(-1) - 1;
      if (n !== undefined && $('choices').children.length) { e.preventDefault(); choose(n); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        var p = $('actions').querySelector('.btn');
        if (p) { e.preventDefault(); p.click(); }
      }
    });
    $('btnRun').addEventListener('click', function () { SFX.play('tap'); run(); });

    return { start: start, get: function () { return B; }, choose: choose };
  })();

  // =====================================================================
  // ✍️ 한글 따라쓰기 연습
  // =====================================================================
  var Practice = (function () {
    var ST = TRACE.STAGES, stage = ST[0], idx = 0, pad = null, solved = false;
    function done(st) { return SAVE.traceDone(st.id); }
    function renderStages() {
      $('trStages').innerHTML = ST.map(function (s, i) {
        var n = done(s).length, full = n >= s.items.length;
        return '<button class="tab' + (s === stage ? ' on' : '') + '" data-st="' + i + '">' + s.name + (full ? ' ⭐' : '') + '</button>';
      }).join('');
      $('trStages').querySelectorAll('[data-st]').forEach(function (b) {
        b.addEventListener('click', function () { SFX.play('tap'); pickStage(ST[+b.getAttribute('data-st')]); });
      });
      var on = $('trStages').querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    function renderStrip() {
      var d = done(stage);
      $('trStrip').innerHTML = stage.items.map(function (ch, i) {
        return '<button class="' + (d.indexOf(i) >= 0 ? 'done' : '') + (i === idx ? ' cur' : '') + '" data-i="' + i + '">' + ch + '</button>';
      }).join('');
      $('trStrip').querySelectorAll('[data-i]').forEach(function (b) {
        b.addEventListener('click', function () { SFX.play('tap'); go(+b.getAttribute('data-i')); });
      });
      var c = $('trStrip').querySelector('.cur'); if (c) c.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    function setMeter(r) { var m = $('trMeter'); m.style.width = (r * 100) + '%'; m.classList.toggle('full', r >= 1); }
    function go(i) {
      idx = i; solved = false;
      $('trNext').disabled = true; $('trNext').classList.remove('ready');
      $('trName').textContent = stage.say[idx];
      $('trCount').textContent = (idx + 1) + ' / ' + stage.items.length;
      $('trHint').textContent = '회색 글자를 손가락으로 따라 써 봐!';
      setMeter(0);
      renderStrip();
      pad.setLetter(stage.items[idx], TRACE.INK[(ST.indexOf(stage) * 3 + idx) % TRACE.INK.length]);
      TRACE.speak(stage.say[idx]);
    }
    function pickStage(s, start) {
      stage = s;
      var d = done(s), i = start;
      if (i === undefined) { i = 0; while (i < s.items.length && d.indexOf(i) >= 0) i++; if (i >= s.items.length) i = 0; }
      renderStages(); go(i);
    }
    function ensurePad() {
      if (pad) return;
      pad = TRACE.createPad($('trPad'), {
        mascot: ART(133), mascotName: '이브이', // 이브이가 쓰는 순서 시범
        onProgress: setMeter,
        onWrong: function () { SFX.play('wrong'); },
        onStrokeDone: function () { SFX.play('tap'); },
        onHint: function (text) { $('trHint').textContent = text; },
        onSuccess: function () {
          solved = true;
          SAVE.markTrace(stage.id, idx);
          SFX.play('correct');
          $('trHint').textContent = stage.say[idx] + '! ' + ['잘했어!', '최고야!', '멋져!', '훌륭해!'][rand(4)];
          var sayNow = stage.say[idx], at = idx, st = stage;
          setTimeout(function () { if (st === stage && at === idx) TRACE.speak(sayNow); }, 400);
          $('trNext').disabled = false; $('trNext').classList.add('ready');
          renderStrip(); renderStages();
        }
      });
    }
    function next() {
      if (!solved) return;
      SFX.play('tap');
      if (idx + 1 < stage.items.length) { go(idx + 1); return; }
      var ni = ST.indexOf(stage) + 1, nextSt = ST[ni];
      SFX.play('caught');
      openModal('<h3>' + stage.name + ' ' + stage.sub + ' 다 썼어! 🎉</h3><div style="font-size:3rem">⭐⭐⭐</div>' +
        '<p>' + (nextSt ? '다음은 「' + nextSt.name + '」 차례야!' : '모든 단계를 끝냈어. 정말 대단해!') + '</p>' +
        '<div class="actions">' + (nextSt ? '<button class="btn primary" id="trGoNext">다음 단계 ▶</button>' : '') +
        '<button class="btn" id="trAgain">한 번 더</button></div>');
      TRACE.speak('참 잘했어요!');
      if (nextSt) $('trGoNext').addEventListener('click', function () { closeModal(); pickStage(nextSt, 0); });
      $('trAgain').addEventListener('click', function () { closeModal(); pickStage(stage, 0); });
    }
    $('trNext').addEventListener('click', next);
    $('trClear').addEventListener('click', function () { SFX.play('tap'); if (solved) go(idx); else { pad.clear(); $('trHint').textContent = '①번 흰 선부터 다시 써 봐!'; } });
    $('trDemo').addEventListener('click', function () { SFX.play('tap'); if (solved) go(idx); else pad.demo(); });
    $('trSound').addEventListener('click', function () { TRACE.speak(stage.say[idx]); });
    $('btnTraceBack').addEventListener('click', function () { SFX.play('tap'); show('title'); });
    return {
      open: function () {
        show('trace'); ensurePad();
        // 처음엔 아직 다 못 쓴 첫 단계부터
        var s = ST.filter(function (x) { return done(x).length < x.items.length; })[0] || stage;
        requestAnimationFrame(function () { pickStage(s); });
      },
      pad: function () { return pad; },
      leave: function () { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} },
      doneCount: function () { return ST.reduce(function (n, s) { return n + done(s).length; }, 0); },
      total: function () { return ST.reduce(function (n, s) { return n + s.items.length; }, 0); }
    };
  })();

  // =====================================================================
  // 🏠 포켓몬 홈: 지역마다 잡은 포켓몬이 돌아다님 (한 쪽에 20마리, 잡은 순서대로)
  // =====================================================================
  var Home = (function () {
    var PER_PAGE = 20;
    var H = { rk: 'forest', page: 0, mons: [], raf: 0, last: 0, w: 0, h: 0, top: 60, size: 40, running: false };
    var field = $('homeField'), monsEl = $('homeMons');

    // 포켓몬 크기: 한글 따라쓰기 칸의 이브이(칸의 1/5)의 2/3 → 칸 크기 × 0.2 × 2/3
    function monSize() {
      var pad = document.querySelector('#trPad .tpad'), padS = pad ? pad.getBoundingClientRect().width : 0;
      if (!(padS > 60)) { // 따라쓰기 칸을 아직 안 열었으면 이 화면에서 칸이 될 크기를 어림
        var w = window.innerWidth, h = window.innerHeight;
        padS = w > h ? Math.min(h - 110, (w - 60) / 2) : Math.min(w - 32, h * 0.55);
      }
      return Math.max(34, Math.round(padS * 0.2 * 2 / 3));
    }
    function measure() {
      var r = field.getBoundingClientRect();
      H.w = r.width; H.h = r.height;
      H.top = Math.max(50, document.querySelector('.home-hud').getBoundingClientRect().height + 8);
      H.size = monSize();
      H.mons.forEach(function (m) { m.el.style.width = m.el.style.height = H.size + 'px'; clamp(m); });
    }
    function clamp(m) {
      var s = H.size;
      m.x = Math.max(s / 2, Math.min(H.w - s / 2, m.x));
      m.y = Math.max(H.top + s, Math.min(H.h - 6, m.y));
    }
    function pickTarget(m) { // 근처 아무 곳으로 산책
      var s = H.size, reach = Math.max(H.w, H.h) * 0.35;
      m.tx = Math.max(s / 2, Math.min(H.w - s / 2, m.x + (Math.random() * 2 - 1) * reach));
      m.ty = Math.max(H.top + s, Math.min(H.h - 6, m.y + (Math.random() * 2 - 1) * reach * 0.7));
      m.speed = H.size * (0.9 + Math.random() * 1.1); // 1초에 자기 몸의 0.9~2배
    }
    function pages() { return Math.max(1, Math.ceil(homeList(H.rk).length / PER_PAGE)); }
    function build() {
      var list = homeList(H.rk), n = pages();
      H.page = Math.max(0, Math.min(n - 1, H.page));
      var show = list.slice(H.page * PER_PAGE, H.page * PER_PAGE + PER_PAGE);
      monsEl.innerHTML = '';
      H.mons = show.map(function (p, i) {
        var el = document.createElement('button');
        el.className = 'hmon'; el.type = 'button'; el.setAttribute('aria-label', p.name);
        el.innerHTML = '<span class="sh"></span><span class="bd"><img src="' + ART(p.id) + '" alt=""></span>';
        imgFallback(el.querySelector('img'));
        el.style.width = el.style.height = H.size + 'px';
        el.addEventListener('click', function () { SFX.play('tap'); showMonModal(p); });
        monsEl.appendChild(el);
        // 처음 자리: 화면에 고르게 흩어 놓기
        var cols = 5, gx = (i % cols + 0.5 + (Math.random() - 0.5) * 0.6) / cols, gy = (Math.floor(i / cols) + 0.5 + (Math.random() - 0.5) * 0.5) / Math.ceil(show.length / cols);
        var m = { p: p, el: el, body: el.querySelector('.bd'), x: gx * H.w, y: H.top + H.size + gy * (H.h - H.top - H.size - 10),
          face: Math.random() < 0.5 ? -1 : 1, wait: Math.random() * 1500, phase: Math.random() * 6, hop: Math.random() < 0.3 };
        clamp(m); pickTarget(m);
        return m;
      });
      $('homePage').textContent = (H.page + 1) + ' / ' + n;
      $('homePager').style.visibility = n > 1 ? 'visible' : 'hidden';
      $('homePrev').disabled = H.page === 0; $('homeNext').disabled = H.page >= n - 1;
      $('homeHint').textContent = list.length ? '' : '아직 ' + REGIONS[H.rk].name + '에서 잡은 포켓몬이 없어. 필드에서 잡아 봐!';
      render(0);
    }
    function render(t) {
      H.mons.forEach(function (m) {
        var bob = m.moving ? -Math.abs(Math.sin(t / 110 + m.phase)) * H.size * (m.hop ? 0.22 : 0.1) : 0;
        m.el.style.transform = 'translate(' + (m.x - H.size / 2) + 'px,' + (m.y - H.size) + 'px)';
        m.el.style.zIndex = Math.round(m.y);
        m.body.style.transform = 'translateY(' + bob + 'px) scaleX(' + m.face + ')';
      });
    }
    function step(t) {
      if (!H.running) return;
      var dt = Math.min(0.05, (t - (H.last || t)) / 1000); H.last = t;
      H.mons.forEach(function (m) {
        if (m.wait > 0) { m.wait -= dt * 1000; m.moving = false; if (m.wait <= 0) pickTarget(m); return; }
        var dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy), v = m.speed * dt;
        if (d <= v) { m.x = m.tx; m.y = m.ty; m.moving = false; m.wait = 600 + Math.random() * 2400; m.hop = Math.random() < 0.3; return; }
        m.moving = true; m.x += dx / d * v; m.y += dy / d * v;
        if (Math.abs(dx) > 1) m.face = dx > 0 ? -1 : 1; // 그림이 왼쪽을 보고 있어서 오른쪽으로 갈 때 뒤집음
      });
      render(t);
      H.raf = requestAnimationFrame(step);
    }
    function start() { if (H.running) return; H.running = true; H.last = 0; H.raf = requestAnimationFrame(step); }
    function stop() { H.running = false; cancelAnimationFrame(H.raf); }
    $('homePrev').addEventListener('click', function () { SFX.play('tap'); if (H.page > 0) { H.page--; build(); } });
    $('homeNext').addEventListener('click', function () { SFX.play('tap'); if (H.page < pages() - 1) { H.page++; build(); } });
    $('btnHomeBack').addEventListener('click', function () { SFX.play('tap'); dexFilter = 'home'; show('dex'); renderDex(); });
    window.addEventListener('resize', function () { if (current === 'home') measure(); });
    return {
      open: function (rk) {
        H.rk = rk; H.page = 0;
        var R = REGIONS[rk];
        field.className = rk;
        $('homeDeco').innerHTML = decoHTML(rk);
        $('homeTitle').textContent = R.em + ' ' + R.name + ' ' + homeList(rk).length + '마리';
        show('home');
        measure(); build(); start();
      },
      stop: stop,
      state: function () { return H; }
    };
  })();

  // =====================================================================
  // 도감
  // =====================================================================
  var dexFilter = 'all';
  function openDex(from) { dexReturn = from; show('dex'); renderDex(); }
  function renderDex() {
    var c = SAVE.caughtCount();
    $('dexCount2').textContent = c + ' / ' + POKEMON.length;
    document.querySelectorAll('#scr-dex .tab').forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-filter') === dexFilter); });
    if (dexFilter === 'home') { renderHomeCards(); return; }
    var list = dexFilter === 'caught' ? POKEMON.filter(function (p) { return SAVE.isCaught(p.id); }) : POKEMON;
    if (!list.length) { $('dexGrid').innerHTML = '<div class="dex-empty">아직 잡은 포켓몬이 없어요.<br>필드에서 몬스터볼을 찾아 봐!</div>'; return; }
    $('dexGrid').innerHTML = list.map(function (p) {
      var got = SAVE.isCaught(p.id);
      return '<div class="dex-cell' + (got ? '' : ' no') + (p.rare ? ' rare' : '') + '" data-id="' + p.id + '">' +
        '<span class="no-num">' + String(p.id).padStart(3, '0') + '</span>' + (p.rare ? '<span class="star">✨</span>' : '') +
        '<img loading="lazy" src="' + ART(p.id) + '" alt="">' +
        '<div class="dex-name">' + (got ? esc(p.name) : '???') + '</div></div>';
    }).join('');
    $('dexGrid').querySelectorAll('img').forEach(imgFallback);
  }
  $('dexGrid').addEventListener('click', function (e) {
    var cell = e.target.closest('.dex-cell'); if (!cell) return;
    SFX.play('tap');
    showMonModal(BY_ID[cell.getAttribute('data-id')]);
  });
  // 포켓몬 한 마리 도감 창 (도감 칸, 홈에서 누른 포켓몬 모두)
  function showMonModal(p) {
    if (!SAVE.isCaught(p.id)) {
      openModal('<h3>No.' + String(p.id).padStart(3, '0') + ' ???</h3><img class="big-mon" style="filter:brightness(0);opacity:.4" src="' + ART(p.id) + '" alt=""><p>' + (p.rare ? '금색 몬스터볼에서 만날 수 있어!' : '아직 못 만났어. 어느 지역에 있을까?') + '</p>');
      return;
    }
    var c = SAVE.data.caught[p.id];
    openModal('<h3>No.' + String(p.id).padStart(3, '0') + ' ' + esc(p.name) + (p.rare ? ' ✨' : '') + '</h3><img class="big-mon" src="' + ART(p.id) + '" alt="">' +
      '<div class="types" style="display:flex;gap:.4rem;justify-content:center;font-size:1.3rem">' + typeBadges(p.types) + '</div>' +
      '<p>잡은 횟수: ' + c.n + '번 · 처음 잡은 날: ' + c.first + (c.region && REGIONS[c.region] ? ' · 사는 곳: ' + REGIONS[c.region].em + ' ' + REGIONS[c.region].name : '') + '</p>');
  }
  // 홈 탭: 지역 4곳 고르기
  function homeList(rk) { // 그 지역 집에 사는 포켓몬, 잡은 순서대로
    var C = SAVE.data.caught;
    return Object.keys(C).filter(function (id) { return C[id].region === rk && BY_ID[id]; })
      .sort(function (a, b) { return (C[a].seq || 0) - (C[b].seq || 0); }).map(function (id) { return BY_ID[id]; });
  }
  function renderHomeCards() {
    $('dexGrid').innerHTML = '<div class="home-cards">' + REGION_KEYS.map(function (rk) {
      var R = REGIONS[rk], list = homeList(rk);
      var faces = list.slice(-3).map(function (p) { return '<img src="' + ART(p.id) + '" alt="">'; }).join('');
      return '<button class="home-card ' + rk + '" data-home="' + rk + '"><div class="em">' + R.em + '</div><div>' + R.name + ' 집</div>' +
        '<div class="faces">' + faces + '</div><div class="ct">' + list.length + '마리</div></button>';
    }).join('') + '</div>';
    $('dexGrid').querySelectorAll('img').forEach(imgFallback);
    $('dexGrid').querySelectorAll('[data-home]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); SFX.play('tap'); Home.open(b.getAttribute('data-home')); });
    });
  }
  document.querySelectorAll('#scr-dex .tab').forEach(function (t) {
    t.addEventListener('click', function () { SFX.play('tap'); dexFilter = t.getAttribute('data-filter'); renderDex(); $('dexGrid').scrollTop = 0; });
  });
  $('btnDexBack').addEventListener('click', function () { SFX.play('tap'); show(dexReturn); });

  // ---------- 예전 기록 정리: 지역·잡은 순서가 없는 포켓몬 ----------
  // 지역 기록이 생기기 전에 잡은 포켓몬은 타입에 맞는 지역 집으로, 순서는 처음 잡은 날짜 순으로 정함
  (function migrateHomes() {
    var C = SAVE.data.caught, st = SAVE.data.stats, changed = false, maxSeq = 0;
    Object.keys(C).forEach(function (id) { maxSeq = Math.max(maxSeq, C[id].seq || 0); });
    if (st.seq < maxSeq) { st.seq = maxSeq; changed = true; }
    Object.keys(C).filter(function (id) { return !C[id].seq; })
      .sort(function (a, b) { return String(C[a].first).localeCompare(String(C[b].first)) || (a - b); })
      .forEach(function (id) { C[id].seq = ++st.seq; changed = true; });
    Object.keys(C).forEach(function (id) {
      if (C[id].region && REGIONS[C[id].region]) return;
      var p = BY_ID[id];
      C[id].region = (p && REGION_KEYS.filter(function (rk) { return inRegion(p, rk); })[0]) || 'forest';
      changed = true;
    });
    if (changed) SAVE.persist();
  })();

  // ---------- 시작 ----------
  renderSound();
  show('title');
  if (SAVE.stampToday()) { renderTitle(); setTimeout(function () { SFX.play('stamp'); showStamps(true); }, 400); }

  // 시험용 손잡이 (.test 의 자동 시험에서 씀)
  window.PQ = { show: show, battle: Battle, practice: Practice, home: Home, field: Field, save: SAVE, cfg: CFG, regions: REGIONS, current: function () { return current; } };
})();
