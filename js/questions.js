// 학습 문제 데이터. 영역: math(덧셈·뺄셈), korean(한글), english(영어)  (창의력은 5살에게 어려워 뺐음)
// (✍️ 따라쓰기 문제는 js/trace.js 에서 글자를 뽑아 게임에서 만듭니다)
// 문제 하나 = { cat, t(세부 종류), q(질문), e(크게 보여 줄 그림/식, 없어도 됨), a(정답), w(오답 3개), chk(검사용 정보) }
// 보기 = [a, ...w] 를 게임에서 섞어 씁니다. 검사: tools/check-questions.html
(function () {
  'use strict';

  // ---------- 공통 도구 ----------
  function rng(seed) { // 정해진 순서의 난수 (문제 은행이 매번 같게 만들어지도록)
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickN(arr, n, r, filter) {
    var pool = arr.filter(filter || function () { return true; });
    var out = [];
    while (out.length < n && pool.length) {
      var i = Math.floor(r() * pool.length);
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }
  var CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  function choOf(ch) { var c = ch.charCodeAt(0) - 0xAC00; return (c >= 0 && c < 11172) ? CHO[Math.floor(c / 588)] : null; }
  function hasBat(ch) { var c = ch.charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 && c % 28 !== 0; }
  var HANGUL = { choOf: choOf, hasBat: hasBat };

  // ---------- 낱말 그림 사전 (영어·한글 문제에 함께 씀) ----------
  // [그림, 영어, 한글]  — 그림·영어·한글은 서로 겹치지 않아야 합니다.
  var VOCAB = [
    ['🍎','apple','사과'],['🍌','banana','바나나'],['🍇','grape','포도'],['🍓','strawberry','딸기'],
    ['🍊','orange','오렌지'],['🍉','watermelon','수박'],['🍋','lemon','레몬'],['🍑','peach','복숭아'],
    ['🍒','cherry','체리'],['🥕','carrot','당근'],['🌽','corn','옥수수'],['🍅','tomato','토마토'],
    ['🥔','potato','감자'],['🍞','bread','빵'],['🍰','cake','케이크'],['🍪','cookie','쿠키'],
    ['🍦','ice cream','아이스크림'],['🥛','milk','우유'],['🥚','egg','달걀'],['🍕','pizza','피자'],
    ['🍔','hamburger','햄버거'],['🍬','candy','사탕'],
    ['🐶','dog','강아지'],['🐱','cat','고양이'],['🐰','rabbit','토끼'],['🐻','bear','곰'],
    ['🐷','pig','돼지'],['🐮','cow','소'],['🐴','horse','말'],['🐑','sheep','양'],
    ['🐔','chicken','닭'],['🦆','duck','오리'],['🐸','frog','개구리'],['🐵','monkey','원숭이'],
    ['🦁','lion','사자'],['🐯','tiger','호랑이'],['🐘','elephant','코끼리'],['🦒','giraffe','기린'],
    ['🐼','panda','판다'],['🐧','penguin','펭귄'],['🐟','fish','물고기'],['🐢','turtle','거북'],
    ['🐍','snake','뱀'],['🐭','mouse','쥐'],['🦋','butterfly','나비'],['🐝','bee','벌'],
    ['🐜','ant','개미'],['🦀','crab','게'],['🐙','octopus','문어'],['🐳','whale','고래'],
    ['🦈','shark','상어'],['🐦','bird','새'],['🐞','ladybug','무당벌레'],['🦉','owl','부엉이'],
    ['🦊','fox','여우'],['🐺','wolf','늑대'],['🐿️','squirrel','다람쥐'],
    ['🚗','car','자동차'],['🚌','bus','버스'],['🚲','bike','자전거'],['✈️','airplane','비행기'],
    ['🚢','ship','배'],['🚂','train','기차'],['🚀','rocket','로켓'],['🚁','helicopter','헬리콥터'],
    ['☀️','sun','해'],['🌙','moon','달'],['⭐','star','별'],['☁️','cloud','구름'],
    ['🌈','rainbow','무지개'],['❄️','snow','눈'],['🌳','tree','나무'],['🌸','flower','꽃'],
    ['🏠','house','집'],['🏫','school','학교'],['📚','book','책'],['✏️','pencil','연필'],
    ['🎒','bag','가방'],['⚽','ball','공'],['🎈','balloon','풍선'],['🎁','gift','선물'],
    ['⏰','clock','시계'],['🔑','key','열쇠'],['🪑','chair','의자'],['🛏️','bed','침대'],
    ['🚪','door','문'],['👕','shirt','셔츠'],['👖','pants','바지'],['👟','shoes','신발'],
    ['🎩','hat','모자'],['🧦','socks','양말'],['☂️','umbrella','우산'],['👓','glasses','안경'],
    ['🥄','spoon','숟가락'],['🖐️','hand','손'],['🦶','foot','발'],['👂','ear','귀'],
    ['👃','nose','코'],['👄','mouth','입'],['🥁','drum','북'],['🎹','piano','피아노'],
    ['🎸','guitar','기타'],['🔔','bell','종'],['💧','water','물'],['🔥','fire','불'],
    ['⛄','snowman','눈사람'],['🌊','wave','파도']
  ];

  var Q = { math: [], korean: [], english: [] };
  function add(cat, t, q, e, a, w, chk) {
    var o = { cat: cat, t: t, q: q, a: a, w: w };
    if (e) o.e = e;
    if (chk) o.chk = chk;
    Q[cat].push(o);
  }

  // =====================================================================
  // 영어
  // =====================================================================
  (function () {
    var r = rng(101);
    VOCAB.forEach(function (v, i) {
      var others = VOCAB.filter(function (x, j) { return j !== i; });
      // 그림 → 단어
      add('english', 'e2w', '이 그림을 영어로 하면?', v[0], v[1], pickN(others, 3, r).map(function (x) { return x[1]; }), { k: 'vocab' });
      // 단어 → 그림
      add('english', 'w2e', '「' + v[1] + '」 그림을 찾아 봐!', null, v[0], pickN(others, 3, r).map(function (x) { return x[0]; }), { k: 'vocab' });
      // 첫 글자
      if (v[1].length >= 3 && v[1].indexOf(' ') < 0) {
        var first = v[1][0];
        var letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
        var w = pickN(letters, 3, r, function (l) {
          if (l === first) return false;
          var made = l + v[1].slice(1);
          return !VOCAB.some(function (x) { return x[1] === made; });
        });
        add('english', 'first', '빈칸에 들어갈 첫 글자는?', v[0] + '  _' + v[1].slice(1), first, w, { k: 'first', word: v[1] });
      }
    });
    // 색깔
    var COLORS = [['🔴','red'],['🟠','orange'],['🟡','yellow'],['🟢','green'],['🔵','blue'],['🟣','purple'],['⚫','black'],['⚪','white'],['🟤','brown']];
    COLORS.forEach(function (c, i) {
      var others = COLORS.filter(function (x, j) { return j !== i; });
      add('english', 'color', '이 색깔을 영어로 하면?', c[0], c[1], pickN(others, 3, r).map(function (x) { return x[1]; }), { k: 'distinct' });
    });
    // 숫자
    var NUMS = ['one','two','three','four','five','six','seven','eight','nine','ten'];
    var ICONS = ['⭐','🍎','🎈','🐟','🌸'];
    NUMS.forEach(function (n, i) {
      var others = NUMS.filter(function (x, j) { return j !== i; });
      var icon = ICONS[i % ICONS.length];
      add('english', 'num', '몇 개일까? 영어로 골라 봐!', new Array(i + 2).join(icon), n, pickN(others, 3, r), { k: 'num', n: i + 1 });
    });
  })();

  // =====================================================================
  // 한글
  // =====================================================================
  (function () {
    var r = rng(202);
    var ko = VOCAB.map(function (v) { return v[2]; }).filter(function (w) { return w.indexOf(' ') < 0; });
    // 그림 → 낱말
    VOCAB.forEach(function (v, i) {
      var others = VOCAB.filter(function (x, j) { return j !== i; });
      add('korean', 'pic', '그림에 맞는 낱말은?', v[0], v[2], pickN(others, 3, r).map(function (x) { return x[2]; }), { k: 'vocab' });
    });
    // 빈칸 글자
    var syl = [];
    ko.forEach(function (w) { w.split('').forEach(function (c) { if (syl.indexOf(c) < 0) syl.push(c); }); });
    VOCAB.forEach(function (v) {
      var word = v[2];
      if (word.length < 2) return;
      var pos = Math.floor(r() * word.length);
      var ans = word[pos];
      var w = pickN(syl, 3, r, function (c) {
        if (c === ans) return false;
        var made = word.slice(0, pos) + c + word.slice(pos + 1);
        return ko.indexOf(made) < 0;
      });
      var shown = word.split('').map(function (c, i) { return i === pos ? '▢' : c; }).join(' ');
      add('korean', 'blank', '빈칸에 들어갈 글자는?', v[0] + '  ' + shown, ans, w, { k: 'blank', word: word, pos: pos });
    });
    // 첫소리
    for (var i = 0; i < 45; i++) {
      var word = ko[Math.floor(r() * ko.length)];
      var c = choOf(word[0]);
      var w = pickN(ko, 3, r, function (x) { return choOf(x[0]) !== c; });
      add('korean', 'cho', '첫소리가 「' + c + '」인 낱말은?', null, word, w, { k: 'cho', x: c });
    }
    // 받침
    var withB = syl.filter(hasBat), noB = syl.filter(function (c) { return !hasBat(c); });
    for (var j = 0; j < 22; j++) {
      add('korean', 'bat', '받침이 있는 글자는?', null, withB[Math.floor(r() * withB.length)], pickN(noB, 3, r), { k: 'bat' });
      add('korean', 'nobat', '받침이 없는 글자는?', null, noB[Math.floor(r() * noB.length)], pickN(withB, 3, r), { k: 'nobat' });
    }
    // 글자 수
    var NUMK = ['', '한', '두', '세', '네'];
    for (var k = 0; k < 24; k++) {
      var n = 1 + (k % 4);
      var right = ko.filter(function (x) { return x.length === n; });
      var ans = right[Math.floor(r() * right.length)];
      add('korean', 'len', NUMK[n] + ' 글자 낱말은?', null, ans, pickN(ko, 3, r, function (x) { return x.length !== n; }), { k: 'len', n: n });
    }
    // 손으로 쓴 문제들
    var OPP = [
      ['크다','작다',['길다','높다','많다']],['길다','짧다',['크다','넓다','무겁다']],['많다','적다',['높다','길다','빠르다']],
      ['높다','낮다',['크다','많다','넓다']],['빠르다','느리다',['높다','길다','많다']],['뜨겁다','차갑다',['무겁다','밝다','높다']],
      ['밝다','어둡다',['크다','빠르다','뜨겁다']],['무겁다','가볍다',['길다','크다','차갑다']],['넓다','좁다',['높다','빠르다','밝다']],
      ['웃다','울다',['먹다','자다','뛰다']],['열다','닫다',['먹다','웃다','앉다']],['앉다','서다',['열다','먹다','웃다']],
      ['깨끗하다','더럽다',['크다','무겁다','빠르다']],['위','아래',['앞','옆','안']],['앞','뒤',['위','옆','아래']],
      ['안','밖',['위','앞','옆']],['낮','밤',['아침','점심','해']],['여름','겨울',['봄','가을','아침']],['시작','끝',['중간','위','낮']]
    ];
    OPP.forEach(function (o) { add('korean', 'opp', '「' + o[0] + '」의 반대말은?', null, o[1], o[2]); });
    var SOUND = [
      ['멍멍','🐶',['🐱','🐷','🐮']],['야옹','🐱',['🐶','🐔','🐸']],['꿀꿀','🐷',['🐶','🐱','🐮']],['음매','🐮',['🐷','🐔','🐶']],
      ['꼬끼오','🐔',['🐶','🐷','🐸']],['개굴개굴','🐸',['🐔','🐱','🐮']],['꽥꽥','🦆',['🐶','🐷','🐮']],['어흥','🐯',['🐔','🐸','🦆']],
      ['삐약삐약','🐥',['🐶','🐷','🐮']],['짹짹','🐦',['🐶','🐮','🐷']],['메에','🐑',['🐶','🐔','🐸']],['히힝','🐴',['🐔','🐸','🐱']]
    ];
    SOUND.forEach(function (s) { add('korean', 'sound', '「' + s[0] + '」 소리를 내는 동물은?', null, s[1], s[2]); });
    var MIMIC = [
      ['토끼가 뛰는 모양은?','깡충깡충',['엉금엉금','뒤뚱뒤뚱','주룩주룩']],
      ['거북이가 기어가는 모양은?','엉금엉금',['깡충깡충','쌩쌩','반짝반짝']],
      ['오리가 걷는 모양은?','뒤뚱뒤뚱',['깡충깡충','쌩쌩','주룩주룩']],
      ['나비가 나는 모양은?','팔랑팔랑',['엉금엉금','뒤뚱뒤뚱','꿀꿀']],
      ['별이 빛나는 모양은?','반짝반짝',['엉금엉금','꿀꿀','뒤뚱뒤뚱']],
      ['비가 많이 내리는 소리는?','주룩주룩',['반짝반짝','깡충깡충','멍멍']],
      ['자동차가 빨리 달리는 모양은?','쌩쌩',['엉금엉금','뒤뚱뒤뚱','꿀꿀']]
    ];
    MIMIC.forEach(function (m) { add('korean', 'mimic', m[0], null, m[1], m[2]); });
    var MANNERS = [
      ['아침에 일어나서 어른께 하는 인사는?','안녕히 주무셨어요?',['안녕히 주무세요.','잘 먹겠습니다.','다녀오겠습니다.']],
      ['밥 먹기 전에 하는 말은?','잘 먹겠습니다.',['잘 먹었습니다.','안녕히 주무세요.','다녀왔습니다.']],
      ['밥을 다 먹고 하는 말은?','잘 먹었습니다.',['잘 먹겠습니다.','다녀오겠습니다.','안녕히 주무세요.']],
      ['집에 돌아와서 하는 말은?','다녀왔습니다.',['다녀오겠습니다.','잘 먹겠습니다.','안녕히 주무세요.']],
      ['선물을 받았을 때 하는 말은?','고맙습니다.',['미안합니다.','잘 먹었습니다.','다녀왔습니다.']],
      ['친구에게 실수했을 때 하는 말은?','미안해.',['고마워.','잘 자.','맛있다.']],
      ['자기 전에 어른께 하는 인사는?','안녕히 주무세요.',['잘 먹겠습니다.','다녀오겠습니다.','고맙습니다.']]
    ];
    MANNERS.forEach(function (m) { add('korean', 'manners', m[0], null, m[1], m[2]); });
    var SPELL = [
      ['친구',['칭구','친고','친그']],['학교',['핵교','학꾜','하교']],['할머니',['할모니','할머미','할머이']],
      ['선생님',['선상님','선생임','성생님']],['김치',['짐치','김티','긴치']],['자동차',['자동처','자둥차','차동차']],
      ['무지개',['무지게','무지가','모지개']],['떡볶이',['떡복이','떡뽁이','떡볶기']],['병아리',['벙아리','병알이','병아니']],
      ['원숭이',['원숭히','원숭니','원승이']],['눈사람',['눈사럼','눈싸람','눔사람']],['그네',['그내','거네','그니']]
    ];
    SPELL.forEach(function (s) { add('korean', 'spell', '바르게 쓴 낱말은?', null, s[0], s[1]); });
  })();

  // =====================================================================
  // 덧셈·뺄셈 (코드로 만들기)
  // =====================================================================
  var MATH_MAX = 10; // 덧셈·뺄셈에 나오는 가장 큰 수
  function makeMath(r) {
    r = r || Math.random;
    function ri(a, b) { return a + Math.floor(r() * (b - a + 1)); }
    // 5살 수준: 나오는 수(문제 속 수, 정답, 보기)는 모두 1~10 (MATH_MAX)
    var kinds = ['pic','pic','pic','picSub','picSub','add10','add10','sub10','sub10','missing'];
    var kind = kinds[Math.floor(r() * kinds.length)];
    var a, b, ans, e, q = '얼마일까?', op = '+', expr;
    var ICON = ['🍎','⭐','🎈','🐟','🍓','🌸','🍪'][ri(0, 6)];
    var icons = function (n) { return new Array(n + 1).join(ICON); };
    switch (kind) {
      case 'pic': a = ri(1, 5); b = ri(1, 5); ans = a + b;
        e = icons(a) + ' ➕ ' + icons(b); q = '모두 몇 개일까?'; break;
      case 'picSub': a = ri(2, 8); b = ri(1, a - 1); ans = a - b; op = '-';
        e = icons(a); q = a + '개에서 ' + b + '개를 빼면 몇 개 남을까?'; break;
      case 'add10': a = ri(1, 9); b = ri(1, MATH_MAX - a); ans = a + b; break;
      case 'sub10': a = ri(2, MATH_MAX); b = ri(1, a - 1); ans = a - b; op = '-'; break;
      case 'missing': a = ri(1, 8); ans = ri(1, MATH_MAX - a); b = a + ans;
        e = a + ' + ❓ = ' + b; q = '❓에 들어갈 수는?'; expr = b + '-' + a; break;
    }
    if (!e) e = a + (op === '+' ? ' + ' : ' - ') + b + ' = ❓';
    if (!expr) expr = a + op + b;
    var cand = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 3, ans - 3];
    var w = pickN(cand, 3, r, function (x) { return x >= 1 && x <= MATH_MAX && x !== ans; });
    return { cat: 'math', t: kind, q: q, e: e, a: String(ans), w: w.map(String), chk: { k: 'math', expr: expr } };
  }
  // 은행에도 미리 만들어 둠 (검사·개수 확인용). 게임 중에는 makeMath 로 매번 새로 만듭니다.
  (function () { var r = rng(404); for (var i = 0; i < 120; i++) Q.math.push(makeMath(r)); })();

  window.QUIZ = { bank: Q, vocab: VOCAB, makeMath: makeMath, hangul: HANGUL, mathMax: MATH_MAX,
    labels: { math: '🔢 덧셈·뺄셈', korean: '가 한글', write: '✍️ 따라쓰기', english: '🔤 영어' } };
})();
