(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function say(el, text, kind) { if (!el) return; el.textContent = text; el.className = 'msg' + (kind ? ' ' + kind : ''); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function numv(v) { v = Number(v); return isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0; }
  function fmt(v) { return (Math.round(v * 10) / 10).toLocaleString('ko-KR'); }
  function day(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? Number(m[2]) + '월 ' + Number(m[3]) + '일' : '날짜 미정'; }
  function ymd(t) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()); }

  // ---------------------------------------------------------------- 페이지 안 이동 (주소의 #은 바꾸지 않는다)
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href^="#"]') : null; if (!a) return;
    var el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
    ev.preventDefault();
    try { el.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block: 'start'}); } catch (e) { el.scrollIntoView(); }
  });

  // ---------------------------------------------------------------- 절감 계산
  var won = function (v) { return (Math.round(v * 10) / 10).toLocaleString('ko-KR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '만 원'; };
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) && v > 0 ? v : 0; }
  function calc() {
    var clog = num('i-hp') * num('i-chp') + num('i-cl') * num('i-ccl');
    var labor = num('i-min') / 60 * 10320 * Math.min(31, num('i-days')) * 12 / 10000;
    var rc = Math.min(100, num('i-rc')) / 100, rt = Math.min(100, num('i-rt')) / 100;
    var now = clog + labor, sub = 46.8, after = sub + clog * (1 - rc) + labor * (1 - rt), save = now - after;
    $('o-now').textContent = '연 ' + won(now); $('o-after').textContent = '연 ' + won(after);
    var mx = Math.max(now, after, 1); $('b-now').style.width = (now / mx * 100) + '%'; $('b-after').style.width = (after / mx * 100) + '%';
    $('o-save').textContent = (save >= 0 ? '' : '− ') + won(Math.abs(save)); $('o-save').className = 'big' + (save >= 0 ? '' : ' neg');
    $('o-msg').textContent = save >= 0 ? '이 조건이면 구독료를 내고도 1년에 이만큼 덜 듭니다. 한 달로 치면 ' + won(save / 12) + '입니다.' : '이 조건이면 구독료가 줄어드는 비용보다 큽니다. 막힘이 잦은 점포일수록 유리합니다.';
    $('o-detail').textContent = '지금: 막힘 비용 ' + won(clog) + ' + 치우는 시간 ' + won(labor) + '. 사용 후: 구독료 ' + won(sub) + ' + 남는 막힘 비용 ' + won(clog * (1 - rc)) + ' + 남는 시간 ' + won(labor * (1 - rt)) + '.';
  }
  ['i-hp', 'i-chp', 'i-cl', 'i-ccl', 'i-min', 'i-days', 'i-rc', 'i-rt'].forEach(function (id) { $(id).addEventListener('input', calc); });
  calc();

  // ---------------------------------------------------------------- 3D 확대·축소
  $('zin').addEventListener('click', function () { if (window.FS_ZOOM) window.FS_ZOOM(0.85); });
  $('zout').addEventListener('click', function () { if (window.FS_ZOOM) window.FS_ZOOM(1.18); });

  // ---------------------------------------------------------------- 수거 연결
  // 저장 위치는 둘 중 하나다. 공유 기록(db): 같은 계정의 PC와 휴대폰, 함께 쓰는 사람에게 같은 목록이 보인다.
  // 이 기기(localStorage): 공유 기록을 쓸 수 없을 때의 시연. 어느 쪽이든 실제 업체로 전송하지는 않는다.
  var ST = ['업체 찾는 중', '방문 예정', '수거 완료'];
  var LS = 'flowskim-requests-v2', LSK = 'flowskim-collector', LST = 'flowskim-tab';
  var EX = [
    {id: 'ex2', shop: '(예시) 청량리 분식점', area: '청량리 시장권', liters: 1.5, date: '2026-11-27', st: 0, at: '2026-11-22T03:00:00.000Z'},
    {id: 'ex1', shop: '(예시) 제기동 한식당', area: '제기동·경동 시장권', liters: 2, date: '2026-11-25', st: 2, col: '(예시) OO자원', visit: '2026-11-25', done: 2, at: '2026-11-20T03:00:00.000Z'}
  ];
  var mode = 'local', db = null, col = null, items = [], readOnly = false, owner = false, contact = null;

  function norm(v, id) {
    v = v || {};
    return {id: String(id), shop: str(v.shop, 40), area: str(v.area, 30), liters: numv(v.liters), date: str(v.date, 10), contact: str(v.contact, 60),
      st: v.st === 1 || v.st === 2 ? v.st : 0, col: str(v.col, 40), ccontact: str(v.ccontact, 60), visit: str(v.visit, 20), done: numv(v.done), at: str(v.at, 30)};
  }
  function loadLocal() {
    var a = null; try { a = JSON.parse(lsGet(LS) || 'null'); } catch (e) {}
    if (!Array.isArray(a)) a = EX;
    items = a.map(function (v, i) { return norm(v, v && v.id ? v.id : 'l' + i); });
  }
  function saveLocal() { lsSet(LS, JSON.stringify(items.slice(0, 30))); }
  function setNote() {
    var n = $('store-note');
    if (mode === 'shared') {
      n.className = 'store on';
      n.textContent = readOnly ? '공유 기록을 보고 있습니다. 이 계정은 보기 전용이라 새 요청은 올릴 수 없습니다.'
        : '요청은 공유 기록에 저장되어 PC와 휴대폰에서 같은 목록이 보입니다. 실제 수거업체로 자동 전송되지는 않습니다.';
    } else { n.className = 'store'; n.textContent = '지금은 이 기기에만 저장되는 시연입니다. 실제 수거업체로 전송되지 않습니다.'; }
  }
  function fail(e, el) {
    var code = e && e.code;
    if (code === 'invalid_argument' || code === 'not_granted' || code === 'revoked') say(el, '공유 기록에 저장하지 못했습니다. 이 계정에 쓰기 권한이 없을 수 있습니다.', 'err');
    else if (code === 'quota_exceeded') say(el, '기록이 가득 찼습니다. 오래된 요청을 지운 뒤 다시 올려 주세요.', 'err');
    else say(el, '저장하지 못했습니다. 잠시 뒤 다시 눌러 주세요.', 'err');
  }
  function addReq(r, el) {
    if (mode === 'shared') return col.add(r).then(function () { return true; }, function (e) { fail(e, el); return false; });
    var id = 'l' + Date.now(); items.unshift(norm(r, id)); saveLocal(); render(); return Promise.resolve(true);
  }
  function patchReq(r, p, el) {
    if (mode === 'shared') return db.doc('requests/' + r.id).update(p).then(function () { return true; }, function (e) { fail(e, el); return false; });
    Object.keys(p).forEach(function (k) { r[k] = p[k]; }); saveLocal(); render(); return Promise.resolve(true);
  }
  function accept(r, btn) {
    var name = $('k-name').value.trim(), c = $('k-contact').value.trim(), m = $('k-msg');
    if (!name) { say(m, '업체 이름을 먼저 적어 주세요.', 'err'); try { $('k-name').focus(); } catch (e) {} return; }
    lsSet(LSK, JSON.stringify({n: name, c: c})); btn.disabled = true;
    patchReq(r, {st: 1, col: name.slice(0, 30), ccontact: c.slice(0, 40), visit: r.date, up: new Date().toISOString()}, m).then(function (ok) {
      btn.disabled = false; if (ok) say(m, '방문 예정으로 바꿨습니다. 점포 화면에 업체 이름이 보입니다.', 'ok');
    });
  }
  function finish(r, inp, btn) {
    var v = numv(inp && inp.value), m = $('k-msg');
    if (!v) { say(m, '실제로 수거한 양을 적어 주세요.', 'err'); return; }
    btn.disabled = true;
    patchReq(r, {st: 2, done: v, up: new Date().toISOString()}, m).then(function (ok) { btn.disabled = false; if (ok) say(m, '수거 완료로 기록했습니다.', 'ok'); });
  }
  function card(r, role) {
    var el = h('article', 'rq s' + r.st), top = h('div', 'rq-top'), inp = null;
    top.appendChild(h('b', 'rq-shop', r.shop || '(이름 없음)')); top.appendChild(h('span', 'chip c' + r.st, ST[r.st])); el.appendChild(top);
    el.appendChild(h('p', '', [r.area, '기름 ' + fmt(r.liters) + ' L', '희망일 ' + day(r.date)].filter(Boolean).join(' · ')));
    if (r.contact) el.appendChild(h('p', '', '점포 연락: ' + r.contact));
    if (r.st >= 1) el.appendChild(h('p', 'strong', '수거업체: ' + (r.col || '이름 없음') + (r.visit ? ' · ' + day(r.visit) + ' 방문' : '') + (r.ccontact ? ' · ' + r.ccontact : '')));
    if (r.st === 2) el.appendChild(h('p', '', '수거한 양: ' + fmt(r.done || r.liters) + ' L'));
    if (role === 'col' && r.st < 2 && !readOnly) {
      var acts = h('div', 'acts'), b = h('button', 'btn small' + (r.st === 0 ? ' primary' : ''), r.st === 0 ? '이 요청 수거하겠습니다' : '수거 완료로 표시'); b.type = 'button';
      if (r.st === 1) {
        inp = document.createElement('input'); inp.type = 'number'; inp.min = '0.1'; inp.max = '500'; inp.step = '0.5'; inp.value = String(r.liters || 1);
        inp.setAttribute('inputmode', 'decimal'); inp.setAttribute('aria-label', '실제로 수거한 양 (L)'); acts.appendChild(inp); acts.appendChild(h('span', '', 'L'));
      }
      b.addEventListener('click', function () { if (r.st === 0) accept(r, b); else finish(r, inp, b); });
      acts.appendChild(b); el.appendChild(acts);
    }
    return el;
  }
  function fill(box, arr, role, emptyText) {
    box.textContent = '';
    if (!arr.length) { box.appendChild(h('p', 'empty', emptyText)); return; }
    arr.slice(0, 40).forEach(function (r) { box.appendChild(card(r, role)); });
  }
  function render() {
    var n = [0, 0, 0], done = 0;
    items.forEach(function (r) { n[r.st]++; if (r.st === 2) done += r.done || r.liters || 0; });
    var sum = items.length ? '업체 찾는 중 ' + n[0] + '건 · 방문 예정 ' + n[1] + '건 · 수거 완료 ' + n[2] + '건 (' + fmt(done) + ' L)' : '';
    $('sum-shop').textContent = sum; $('sum-col').textContent = sum;
    fill($('list-shop'), items, 'shop', '아직 올라온 요청이 없습니다. 첫 요청을 올려 보세요.');
    fill($('list-col'), items.filter(function (r) { return r.st < 2; }).concat(items.filter(function (r) { return r.st === 2; })), 'col', '지금 들어온 요청이 없습니다.');
  }
  function tab(which) {
    var shop = which !== 'col';
    $('tab-shop').setAttribute('aria-selected', shop ? 'true' : 'false'); $('tab-col').setAttribute('aria-selected', shop ? 'false' : 'true');
    $('pane-shop').hidden = !shop; $('pane-col').hidden = shop; lsSet(LST, shop ? 'shop' : 'col');
  }
  $('tab-shop').addEventListener('click', function () { tab('shop'); });
  $('tab-col').addEventListener('click', function () { tab('col'); });

  var dt = $('r-date');
  try { var t0 = new Date(), t2 = new Date(); t2.setDate(t2.getDate() + 2); dt.min = ymd(t0); dt.value = ymd(t2); } catch (e) {}
  $('req-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var shop = $('r-shop').value.trim(), liters = numv($('r-l').value), date = dt.value, m = $('r-msg'), btn = $('r-send');
    if (readOnly) { say(m, '이 계정은 보기 전용이라 요청을 올릴 수 없습니다.', 'err'); return; }
    if (!shop) { say(m, '점포 이름을 적어 주세요.', 'err'); try { $('r-shop').focus(); } catch (e) {} return; }
    if (!liters) { say(m, '모인 기름 양을 적어 주세요.', 'err'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { say(m, '원하는 날짜를 골라 주세요.', 'err'); return; }
    var r = {shop: shop.slice(0, 30), area: $('r-area').value, liters: liters, date: date, contact: $('r-contact').value.trim().slice(0, 40), st: 0, at: new Date().toISOString()};
    btn.disabled = true;
    addReq(r, m).then(function (ok) {
      btn.disabled = false; if (!ok) return;
      say(m, mode === 'shared' ? '요청을 올렸습니다. 수거업체 화면에 바로 보입니다.' : '요청을 올렸습니다. 지금은 이 기기에만 저장됩니다.', 'ok');
      $('copy-text').textContent = '[플로스킴 수거 요청]\n점포: ' + r.shop + '\n지역: ' + r.area + '\n모인 기름: ' + fmt(r.liters) + ' L\n원하는 날짜: ' + day(r.date) + (r.contact ? '\n연락: ' + r.contact : '');
      say($('copy-msg'), '', ''); $('copy-box').hidden = false; $('r-shop').value = ''; $('r-contact').value = '';
    });
  });
  $('copy-btn').addEventListener('click', function () {
    var m = $('copy-msg'), node = $('copy-text');
    function pick() {
      try { var rg = document.createRange(); rg.selectNodeContents(node); var s = window.getSelection(); s.removeAllRanges(); s.addRange(rg); } catch (e) {}
      say(m, '문구를 선택했습니다. 복사해서 붙여 넣어 주세요.', '');
    }
    try { navigator.clipboard.writeText(node.textContent).then(function () { say(m, '복사했습니다.', 'ok'); }, pick); } catch (e) { pick(); }
  });

  // ---------------------------------------------------------------- 문의 연락처 (페이지 주인이 직접 적는다)
  var MAIL = 'sjs0782@uos.ac.kr';   // 기본 연락처. 페이지 주인이 공유 기록에 다른 연락처를 적으면 그쪽을 보여 준다
  function contactRender() {
    var box = $('c-lines'), rows = [];
    if (contact) { ['email', 'phone', 'etc'].forEach(function (k) { var v = str(contact[k], 60).trim(); if (v) rows.push(v); }); }
    if (!rows.length) rows.push(MAIL);
    box.textContent = '';
    rows.forEach(function (v, i) {
      if (i) box.appendChild(document.createElement('br'));
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { var a = document.createElement('a'); a.href = 'mailto:' + v; a.textContent = v; box.appendChild(a); }
      else box.appendChild(document.createTextNode(v));
    });
  }
  function contactUI() { $('c-open-wrap').hidden = !(owner && db); }
  $('c-open').addEventListener('click', function () {
    var f = $('c-form'); f.hidden = !f.hidden;
    if (!f.hidden) { $('c-email').value = contact ? str(contact.email, 60) : MAIL; $('c-phone').value = contact ? str(contact.phone, 30) : ''; $('c-etc').value = contact ? str(contact.etc, 60) : ''; }
  });
  $('c-form').addEventListener('submit', function (ev) {
    ev.preventDefault(); var m = $('c-msg'); if (!db) { say(m, '지금은 저장할 수 없습니다.', 'err'); return; }
    var email = $('c-email').value.trim(), phone = $('c-phone').value.trim(), etc = $('c-etc').value.trim();
    if (email && email.indexOf('@') < 1) { say(m, '이메일 주소를 다시 확인해 주세요.', 'err'); return; }
    db.doc('site/contact').set({email: email.slice(0, 60), phone: phone.slice(0, 30), etc: etc.slice(0, 60), at: new Date().toISOString()})
      .then(function () { say(m, '저장했습니다.', 'ok'); }, function (e) { fail(e, m); });
  });

  // ---------------------------------------------------------------- 시작
  var k0 = null; try { k0 = JSON.parse(lsGet(LSK) || 'null'); } catch (e) {}
  if (k0 && typeof k0 === 'object') { $('k-name').value = str(k0.n, 30); $('k-contact').value = str(k0.c, 40); }
  if (lsGet(LST) === 'col') tab('col');
  loadLocal(); render(); contactRender();

  function connect() {
    var c = window.claude;
    if (!c || typeof c.use !== 'function') { setNote(); return; }
    var pd; try { pd = c.use('db'); } catch (e) { setNote(); return; }
    Promise.resolve(pd).then(function (d) {
      if (!d) { setNote(); return; }
      var timer = setTimeout(function () {
        if (mode !== 'shared') $('store-note').textContent = '공유 기록에 아직 연결되지 않았습니다. 연결되면 자동으로 바뀌고, 그동안은 이 기기에만 저장됩니다.';
      }, 10000);
      try {
        db = d; col = d.collection('requests');
        col.orderBy('at', 'desc').limit(60).onSnapshot(function (snap) {
          if (!snap || !snap.docs) return;
          if (!snap.metadata || !snap.metadata.fromCache) clearTimeout(timer);
          mode = 'shared'; items = snap.docs.map(function (x) { return norm(x.data(), x.id); }); setNote(); render();
        }, function () { clearTimeout(timer); if (mode === 'shared') { mode = 'local'; loadLocal(); } setNote(); render(); });
        d.doc('site/contact').onSnapshot(function (s) { contact = s && s.exists ? (s.data() || null) : null; contactRender(); }, function () {});
        contactUI();
      } catch (e) { clearTimeout(timer); db = null; col = null; setNote(); }
    }, function () { setNote(); });
    try {
      Promise.resolve(c.use('user')).then(function (u) {
        if (!u) return;
        Promise.resolve(u.isOwner()).then(function (o) { owner = !!o; contactUI(); }, function () {});
        Promise.resolve(u.can('data.write')).then(function (w) { if (w === false) { readOnly = true; setNote(); render(); } }, function () {});
      }, function () {});
    } catch (e) {}
  }
  connect();
})();
