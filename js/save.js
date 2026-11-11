// 기록 저장 (브라우저 localStorage). 잡은 포켓몬, 출석 도장, 설정.
(function () {
  'use strict';
  var KEY = 'pokemonQuiz.save.v1';
  var AREAS = ['math', 'korean', 'english', 'creative'];
  function blank() {
    return { caught: {}, stamps: [], settings: { sound: true, areas: { math: true, korean: true, english: true, creative: true } }, stats: { battles: 0, sinceGold: 0 } };
  }
  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    var b = blank();
    if (!d || typeof d !== 'object') return b;
    b.caught = d.caught && typeof d.caught === 'object' ? d.caught : {};
    b.stamps = Array.isArray(d.stamps) ? d.stamps : [];
    if (d.settings) {
      if (typeof d.settings.sound === 'boolean') b.settings.sound = d.settings.sound;
      if (d.settings.areas) AREAS.forEach(function (a) { if (typeof d.settings.areas[a] === 'boolean') b.settings.areas[a] = d.settings.areas[a]; });
    }
    if (d.stats) { b.stats.battles = d.stats.battles | 0; b.stats.sinceGold = d.stats.sinceGold | 0; }
    if (!AREAS.some(function (a) { return b.settings.areas[a]; })) b.settings.areas.math = true;
    return b;
  }
  var data = load();
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  window.SAVE = {
    data: data,
    KEY: KEY,
    today: today,
    persist: function () { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } },
    // 오늘 처음 열었으면 도장을 찍고 true
    stampToday: function () {
      var t = today();
      if (data.stamps.indexOf(t) >= 0) return false;
      data.stamps.push(t); this.persist(); return true;
    },
    catchMon: function (id) {
      var c = data.caught[id];
      var isNew = !c;
      if (!c) c = data.caught[id] = { n: 0, first: today() };
      c.n++;
      this.persist();
      return isNew;
    },
    isCaught: function (id) { return !!data.caught[id]; },
    caughtCount: function () { return Object.keys(data.caught).length; },
    reset: function () {
      var keepStamps = data.stamps.slice();
      var fresh = blank();
      Object.keys(data).forEach(function (k) { delete data[k]; });
      Object.keys(fresh).forEach(function (k) { data[k] = fresh[k]; });
      data.stamps = keepStamps;
      this.persist();
    }
  };
})();
