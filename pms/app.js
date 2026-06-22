(function () {
  'use strict';

  var STORAGE_KEY = 'bltech-pms-v1';

  // 관리할 5개 영역 (순서 = 화면 표시 순서)
  var CATEGORIES = [
    { key: 'company',  label: '회사 업무',           icon: '🏢', accent: '#2563eb' },
    { key: 'today',    label: '오늘 꼭 해야 하는 일', icon: '🔥', accent: '#de350b' },
    { key: 'personal', label: '개인 업무',           icon: '🏠', accent: '#00875a' },
    { key: 'growth',   label: '자기 계발',           icon: '📚', accent: '#6554c0' },
    { key: 'schedule', label: '개인 일정',           icon: '📅', accent: '#ff8b00' },
  ];

  var PRIORITIES = {
    high:   { label: '높음', cls: 'p-high' },
    normal: { label: '보통', cls: '' },
    low:    { label: '낮음', cls: 'p-low' },
  };

  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  // ---------- 상태 ----------
  var data = null;             // init()에서 load()로 채워짐
  var serverAvailable = false; // 로컬 서버(파일 저장) 사용 가능 여부
  var editingId = null;
  var draggedId = null;
  var pendingFocusCat = null;

  // ---------- DOM ----------
  var $ = function (s) { return document.querySelector(s); };
  var boardEl = $('#board');
  var summaryEl = $('#summary');
  var modalEl = $('#modal');

  // ---------- 저장/불러오기 ----------
  // 데이터가 저장되는 위치:
  //  - start-pms.bat(로컬 서버)로 실행하면 -> pms 폴더의 pms-data.json 파일 (권장: 실제 파일로 보관)
  //  - 그냥 index.html을 더블클릭하면 -> 브라우저(localStorage) (서버 없을 때 폴백)
  function load() {
    return fetch('/api/data', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('no server');
        serverAvailable = true;
        return res.json();
      })
      .then(function (parsed) {
        if (parsed && Array.isArray(parsed.items)) return parsed; // 파일에 저장된 데이터
        return loadLocalOrSeed(); // 서버는 있으나 파일 없음 -> localStorage 마이그레이션 또는 예시
      })
      .catch(function () {
        return loadLocalOrSeed(); // 서버 없음 -> localStorage 모드
      });
  }

  function loadLocalOrSeed() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.items)) return p;
      }
    } catch (e) { /* 무시 */ }
    return seed();
  }

  function save() {
    var json = JSON.stringify(data);
    // 항상 localStorage에도 백업해 둠
    try { localStorage.setItem(STORAGE_KEY, json); } catch (e) { /* 용량 초과 등 무시 */ }
    // 서버가 있으면 파일(pms-data.json)에도 저장
    if (serverAvailable) {
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      }).catch(function () { /* 실패해도 localStorage에 백업되어 있음 */ });
    }
  }

  function seed() {
    var now = Date.now();
    return {
      hideDone: false,
      items: [
        mk('company',  '주간 업무 보고서 작성', '금요일 오전까지', 'high', '', false, now),
        mk('today',    '거래처에 회신 메일 보내기', '', 'high', todayStr(), false, now),
        mk('today',    '회의 자료 최종 검토', '', 'normal', todayStr(), false, now),
        mk('personal', '관리비 납부', '', 'normal', '', false, now),
        mk('growth',   '영어 단어 30개 외우기', '매일 꾸준히', 'low', '', false, now),
        mk('schedule', '치과 예약', '오후 6시', 'normal', '', false, now),
      ],
    };
  }

  function mk(cat, title, note, priority, due, done, ts) {
    return { id: uid(), cat: cat, title: title, note: note, priority: priority, due: due, done: done, createdAt: ts };
  }

  // ---------- 헬퍼 ----------
  function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fmtDue(s) {
    var p = s.split('-');
    if (p.length !== 3) return s;
    return Number(p[1]) + '/' + Number(p[2]);
  }

  function catLabel(key) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].key === key) return CATEGORIES[i].label;
    return '';
  }

  // ---------- 렌더링 ----------
  function render() {
    renderHeader();
    renderSummary();
    renderBoard();
    if (pendingFocusCat) {
      var input = boardEl.querySelector('.add-form[data-cat="' + pendingFocusCat + '"] .add-input');
      if (input) input.focus();
      pendingFocusCat = null;
    }
  }

  function renderHeader() {
    var d = new Date();
    $('#today-date').textContent =
      d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' +
      String(d.getDate()).padStart(2, '0') + ' (' + WEEKDAYS[d.getDay()] + ')';
    $('#chk-hide-done').checked = !!data.hideDone;
  }

  function renderSummary() {
    var total = data.items.length;
    var done = data.items.filter(function (i) { return i.done; }).length;
    var todayLeft = data.items.filter(function (i) { return i.cat === 'today' && !i.done; }).length;
    var dueTodayLeft = data.items.filter(function (i) { return !i.done && i.due === todayStr(); }).length;

    summaryEl.innerHTML =
      stat('accent-today', todayLeft + '건', '오늘 꼭 해야 하는 일') +
      stat('', dueTodayLeft + '건', '오늘 마감인 일') +
      stat('accent-done', done + ' / ' + total, '전체 완료');
  }

  function stat(cls, num, label) {
    return '<div class="stat ' + cls + '"><div class="stat-num">' + num + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    CATEGORIES.forEach(function (cat) {
      var all = data.items.filter(function (i) { return i.cat === cat.key; });
      var doneCount = all.filter(function (i) { return i.done; }).length;

      // 미완료 먼저, 완료는 아래로 (각 그룹 내 입력 순서 유지)
      var ordered = all.filter(function (i) { return !i.done; }).concat(all.filter(function (i) { return i.done; }));
      var visible = data.hideDone ? ordered.filter(function (i) { return !i.done; }) : ordered;

      var column = document.createElement('section');
      column.className = 'column';
      column.style.setProperty('--accent', cat.accent);
      column.dataset.cat = cat.key;
      column.innerHTML =
        '<div class="column-head">' +
          '<span class="col-icon">' + cat.icon + '</span>' +
          '<span>' + cat.label + '</span>' +
          '<span class="col-count">' + (all.length - doneCount) + ' / ' + all.length + '</span>' +
        '</div>' +
        '<div class="items" data-cat="' + cat.key + '"></div>' +
        '<form class="add-form" data-cat="' + cat.key + '">' +
          '<input type="text" class="add-input" placeholder="+ 추가 (Enter)" autocomplete="off" />' +
        '</form>';

      var itemsEl = column.querySelector('.items');
      visible.forEach(function (it) { itemsEl.appendChild(renderItem(it)); });
      boardEl.appendChild(column);
    });
  }

  function renderItem(it) {
    var el = document.createElement('article');
    el.className = 'item' + (it.done ? ' done' : '');
    el.draggable = true;
    el.dataset.id = it.id;

    var pr = PRIORITIES[it.priority] || PRIORITIES.normal;
    var prBadge = (it.priority === 'high' || it.priority === 'low')
      ? '<span class="badge ' + pr.cls + '">' + pr.label + '</span>' : '';

    var dueHtml = '';
    if (it.due) {
      var cls = 'badge due';
      if (!it.done && it.due < todayStr()) cls += ' overdue';
      else if (it.due === todayStr()) cls += ' today';
      dueHtml = '<span class="' + cls + '">📅 ' + esc(fmtDue(it.due)) + '</span>';
    }

    var badges = (prBadge || dueHtml) ? '<div class="item-badges">' + prBadge + dueHtml + '</div>' : '';

    el.innerHTML =
      '<input type="checkbox" class="item-check"' + (it.done ? ' checked' : '') + ' />' +
      '<div class="item-body">' +
        '<div class="item-title">' + esc(it.title) + '</div>' +
        (it.note ? '<div class="item-note">' + esc(it.note) + '</div>' : '') +
        badges +
      '</div>';
    return el;
  }

  // ---------- 보드 이벤트 ----------
  boardEl.addEventListener('change', function (e) {
    if (!e.target.classList.contains('item-check')) return;
    var item = e.target.closest('.item');
    var it = data.items.find(function (x) { return x.id === item.dataset.id; });
    if (it) { it.done = e.target.checked; save(); render(); }
  });

  boardEl.addEventListener('click', function (e) {
    if (e.target.classList.contains('item-check')) return; // 체크박스는 change에서 처리
    var item = e.target.closest('.item');
    if (item) openModal(item.dataset.id);
  });

  boardEl.addEventListener('submit', function (e) {
    var form = e.target.closest('.add-form');
    if (!form) return;
    e.preventDefault();
    var input = form.querySelector('.add-input');
    var title = input.value.trim();
    if (!title) return;
    data.items.push(mk(form.dataset.cat, title, '', 'normal', '', false, Date.now()));
    pendingFocusCat = form.dataset.cat;
    save();
    render();
  });

  // ---------- 드래그 앤 드롭 (분류 이동) ----------
  boardEl.addEventListener('dragstart', function (e) {
    var item = e.target.closest('.item');
    if (!item) return;
    draggedId = item.dataset.id;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  boardEl.addEventListener('dragend', function (e) {
    var item = e.target.closest('.item');
    if (item) item.classList.remove('dragging');
    var zones = boardEl.querySelectorAll('.items.drop-target');
    for (var i = 0; i < zones.length; i++) zones[i].classList.remove('drop-target');
    draggedId = null;
  });
  boardEl.addEventListener('dragover', function (e) {
    var zone = e.target.closest('.items');
    if (!zone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('drop-target');
  });
  boardEl.addEventListener('dragleave', function (e) {
    var zone = e.target.closest('.items');
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drop-target');
  });
  boardEl.addEventListener('drop', function (e) {
    var zone = e.target.closest('.items');
    if (!zone || !draggedId) return;
    e.preventDefault();
    var it = data.items.find(function (x) { return x.id === draggedId; });
    if (it && it.cat !== zone.dataset.cat) { it.cat = zone.dataset.cat; save(); }
    render();
  });

  // ---------- 편집 모달 ----------
  function fillCatOptions() {
    var sel = $('#f-cat');
    sel.innerHTML = CATEGORIES.map(function (c) {
      return '<option value="' + c.key + '">' + c.icon + ' ' + c.label + '</option>';
    }).join('');
  }

  function openModal(id) {
    var it = data.items.find(function (x) { return x.id === id; });
    if (!it) return;
    editingId = id;
    $('#f-title').value = it.title;
    $('#f-note').value = it.note || '';
    $('#f-cat').value = it.cat;
    $('#f-priority').value = it.priority || 'normal';
    $('#f-due').value = it.due || '';
    $('#f-done').checked = !!it.done;
    modalEl.hidden = false;
    $('#f-title').focus();
  }

  function closeModal() { modalEl.hidden = true; editingId = null; }

  function saveModal() {
    var it = data.items.find(function (x) { return x.id === editingId; });
    if (!it) { closeModal(); return; }
    var title = $('#f-title').value.trim();
    if (!title) { $('#f-title').focus(); return; }
    it.title = title;
    it.note = $('#f-note').value.trim();
    it.cat = $('#f-cat').value;
    it.priority = $('#f-priority').value;
    it.due = $('#f-due').value;
    it.done = $('#f-done').checked;
    save(); closeModal(); render();
  }

  function deleteFromModal() {
    if (!editingId) return;
    if (!confirm('이 항목을 삭제할까요?')) return;
    data.items = data.items.filter(function (x) { return x.id !== editingId; });
    save(); closeModal(); render();
  }

  $('#f-save').addEventListener('click', saveModal);
  $('#f-cancel').addEventListener('click', closeModal);
  $('#f-delete').addEventListener('click', deleteFromModal);
  modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modalEl.hidden) closeModal(); });

  // ---------- 완료 숨기기 ----------
  $('#chk-hide-done').addEventListener('change', function (e) {
    data.hideDone = e.target.checked; save(); render();
  });

  // ---------- 백업 ----------
  function exportData() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'pms-backup-' + todayStr() + '.json'; a.click();
    URL.revokeObjectURL(url);
  }
  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.items)) throw new Error('형식 오류');
        data = parsed; save(); render(); alert('복원 완료!');
      } catch (e) { alert('복원 실패: 올바른 백업 파일이 아닙니다.'); }
    };
    reader.readAsText(file);
  }
  $('#btn-export').addEventListener('click', exportData);
  $('#btn-import').addEventListener('click', function () { $('#file-import').click(); });
  $('#file-import').addEventListener('change', function (e) {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  // ---------- 시작 ----------
  function init() {
    fillCatOptions();
    load().then(function (loaded) {
      data = loaded;
      render();
      if (serverAvailable) save(); // 저장 파일이 없으면 지금 만들어 둠
    });
  }
  init();
})();
