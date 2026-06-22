(function () {
  'use strict';

  // 브라우저(localStorage)에 데이터를 저장할 때 쓰는 키
  var STORAGE_KEY = 'bltech-pm-v1';

  // 칸반 보드의 3개 칸 (왼쪽 -> 오른쪽 순서)
  var COLUMNS = [
    { key: 'todo',  label: '할 일' },
    { key: 'doing', label: '진행 중' },
    { key: 'done',  label: '완료' },
  ];

  // 우선순위 정의 (라벨 + 색상 클래스)
  var PRIORITIES = {
    high:   { label: '높음', cls: 'p-high' },
    normal: { label: '보통', cls: 'p-normal' },
    low:    { label: '낮음', cls: 'p-low' },
  };

  // ---------- 상태 ----------
  var data = load();
  var editingTaskId = null;     // 편집 모달에서 편집 중인 태스크 id
  var draggedTaskId = null;     // 드래그 중인 태스크 id
  var pendingFocusStatus = null; // 새 태스크 추가 후 다시 포커스할 칸

  // ---------- DOM 참조 ----------
  var $ = function (sel) { return document.querySelector(sel); };
  var projectListEl   = $('#project-list');
  var boardEl         = $('#board');
  var projectHeaderEl = $('#project-header');
  var emptyStateEl    = $('#empty-state');
  var modalEl         = $('#modal');

  // ---------- 저장/불러오기 ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 손상된 데이터는 무시하고 새로 시작 */ }
    return seed();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      alert('저장에 실패했습니다. 브라우저 저장공간이 가득 찼을 수 있어요.');
    }
  }

  // 첫 실행 시 보여줄 예시 프로젝트
  function seed() {
    var pid = uid('p');
    return {
      activeProjectId: pid,
      projects: [{
        id: pid,
        name: '시작하기',
        createdAt: Date.now(),
        tasks: [
          { id: uid('t'), title: '카드를 드래그해서 다른 칸으로 옮겨보세요', note: '', priority: 'normal', due: '', status: 'todo', createdAt: Date.now() },
          { id: uid('t'), title: '카드를 클릭하면 상세 편집창이 열려요', note: '메모 · 우선순위 · 마감일 · 상태를 바꿀 수 있어요.', priority: 'high', due: '', status: 'doing', createdAt: Date.now() },
          { id: uid('t'), title: '끝낸 일은 완료 칸으로!', note: '', priority: 'low', due: '', status: 'done', createdAt: Date.now() },
        ],
      }],
    };
  }

  // ---------- 헬퍼 ----------
  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function activeProject() {
    for (var i = 0; i < data.projects.length; i++) {
      if (data.projects[i].id === data.activeProjectId) return data.projects[i];
    }
    return null;
  }

  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  // ---------- 렌더링 ----------
  function render() {
    renderSidebar();
    renderBoard();
    if (pendingFocusStatus) {
      var input = boardEl.querySelector('.add-form[data-status="' + pendingFocusStatus + '"] .add-input');
      if (input) input.focus();
      pendingFocusStatus = null;
    }
  }

  function renderSidebar() {
    projectListEl.innerHTML = '';
    data.projects.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'project-item' + (p.id === data.activeProjectId ? ' active' : '');
      var doneCount = p.tasks.filter(function (t) { return t.status === 'done'; }).length;
      li.innerHTML =
        '<span class="project-name">' + esc(p.name) + '</span>' +
        '<span class="project-count">' + doneCount + '/' + p.tasks.length + '</span>';
      li.addEventListener('click', function () {
        data.activeProjectId = p.id;
        save();
        render();
      });
      projectListEl.appendChild(li);
    });
  }

  function renderBoard() {
    var p = activeProject();
    if (!p) {
      projectHeaderEl.innerHTML = '';
      boardEl.innerHTML = '';
      boardEl.hidden = true;
      emptyStateEl.hidden = false;
      return;
    }
    emptyStateEl.hidden = true;
    boardEl.hidden = false;

    // 프로젝트 헤더 + 진행률
    var total = p.tasks.length;
    var done = p.tasks.filter(function (t) { return t.status === 'done'; }).length;
    var pct = total ? Math.round(done / total * 100) : 0;
    projectHeaderEl.innerHTML =
      '<div class="ph-top">' +
        '<h1 class="ph-title">' + esc(p.name) + '</h1>' +
        '<div class="ph-actions">' +
          '<button class="btn ghost small" data-action="rename-project">이름 변경</button>' +
          '<button class="btn ghost small danger" data-action="delete-project">삭제</button>' +
        '</div>' +
      '</div>' +
      '<div class="progress">' +
        '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="progress-text">' + done + ' / ' + total + ' 완료 (' + pct + '%)</span>' +
      '</div>';

    // 3개 칸 렌더링
    boardEl.innerHTML = '';
    COLUMNS.forEach(function (col) {
      var tasks = p.tasks.filter(function (t) { return t.status === col.key; });
      var column = document.createElement('section');
      column.className = 'column';
      column.dataset.status = col.key;
      column.innerHTML =
        '<div class="column-head"><span>' + col.label + '</span><span class="col-count">' + tasks.length + '</span></div>' +
        '<div class="cards" data-status="' + col.key + '"></div>' +
        '<form class="add-form" data-status="' + col.key + '">' +
          '<input type="text" class="add-input" placeholder="+ 새 태스크 (Enter)" autocomplete="off" />' +
        '</form>';
      var cardsEl = column.querySelector('.cards');
      tasks.forEach(function (t) { cardsEl.appendChild(renderCard(t)); });
      boardEl.appendChild(column);
    });
  }

  function renderCard(t) {
    var el = document.createElement('article');
    el.className = 'card';
    el.draggable = true;
    el.dataset.id = t.id;

    var pr = PRIORITIES[t.priority] || PRIORITIES.normal;
    var dueHtml = '';
    if (t.due) {
      var overdue = t.status !== 'done' && t.due < todayStr();
      dueHtml = '<span class="badge due' + (overdue ? ' overdue' : '') + '">📅 ' + esc(t.due) + '</span>';
    }
    el.innerHTML =
      '<div class="card-title">' + esc(t.title) + '</div>' +
      (t.note ? '<div class="card-note">' + esc(t.note) + '</div>' : '') +
      '<div class="card-badges">' +
        '<span class="badge ' + pr.cls + '">' + pr.label + '</span>' +
        dueHtml +
      '</div>';
    return el;
  }

  // ---------- 보드 이벤트 (클릭 / 추가) ----------
  boardEl.addEventListener('click', function (e) {
    var actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      if (actionBtn.dataset.action === 'rename-project') renameProject();
      if (actionBtn.dataset.action === 'delete-project') deleteProject();
      return;
    }
    var card = e.target.closest('.card');
    if (card) openModal(card.dataset.id);
  });

  boardEl.addEventListener('submit', function (e) {
    var form = e.target.closest('.add-form');
    if (!form) return;
    e.preventDefault();
    var input = form.querySelector('.add-input');
    var title = input.value.trim();
    if (!title) return;
    var p = activeProject();
    p.tasks.push({
      id: uid('t'), title: title, note: '', priority: 'normal',
      due: '', status: form.dataset.status, createdAt: Date.now(),
    });
    pendingFocusStatus = form.dataset.status; // 추가 후 같은 칸에 계속 입력 가능
    save();
    render();
  });

  // ---------- 드래그 앤 드롭 ----------
  boardEl.addEventListener('dragstart', function (e) {
    var card = e.target.closest('.card');
    if (!card) return;
    draggedTaskId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  boardEl.addEventListener('dragend', function (e) {
    var card = e.target.closest('.card');
    if (card) card.classList.remove('dragging');
    var zones = boardEl.querySelectorAll('.cards.drop-target');
    for (var i = 0; i < zones.length; i++) zones[i].classList.remove('drop-target');
    draggedTaskId = null;
  });

  boardEl.addEventListener('dragover', function (e) {
    var zone = e.target.closest('.cards');
    if (!zone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('drop-target');
  });

  boardEl.addEventListener('dragleave', function (e) {
    var zone = e.target.closest('.cards');
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drop-target');
  });

  boardEl.addEventListener('drop', function (e) {
    var zone = e.target.closest('.cards');
    if (!zone || !draggedTaskId) return;
    e.preventDefault();
    var newStatus = zone.dataset.status;
    var p = activeProject();
    var task = p.tasks.find(function (t) { return t.id === draggedTaskId; });
    if (task && task.status !== newStatus) {
      task.status = newStatus;
      save();
    }
    render();
  });

  // ---------- 편집 모달 ----------
  function openModal(taskId) {
    var p = activeProject();
    var t = p.tasks.find(function (x) { return x.id === taskId; });
    if (!t) return;
    editingTaskId = taskId;
    $('#f-title').value = t.title;
    $('#f-note').value = t.note || '';
    $('#f-priority').value = t.priority || 'normal';
    $('#f-due').value = t.due || '';
    $('#f-status').value = t.status;
    modalEl.hidden = false;
    $('#f-title').focus();
  }

  function closeModal() {
    modalEl.hidden = true;
    editingTaskId = null;
  }

  function saveModal() {
    var p = activeProject();
    var t = p.tasks.find(function (x) { return x.id === editingTaskId; });
    if (!t) { closeModal(); return; }
    var title = $('#f-title').value.trim();
    if (!title) { $('#f-title').focus(); return; }
    t.title = title;
    t.note = $('#f-note').value.trim();
    t.priority = $('#f-priority').value;
    t.due = $('#f-due').value;
    t.status = $('#f-status').value;
    save();
    closeModal();
    render();
  }

  function deleteTaskFromModal() {
    if (!editingTaskId) return;
    if (!confirm('이 태스크를 삭제할까요?')) return;
    var p = activeProject();
    p.tasks = p.tasks.filter(function (x) { return x.id !== editingTaskId; });
    save();
    closeModal();
    render();
  }

  $('#f-save').addEventListener('click', saveModal);
  $('#f-cancel').addEventListener('click', closeModal);
  $('#f-delete').addEventListener('click', deleteTaskFromModal);
  modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalEl.hidden) closeModal();
  });

  // ---------- 프로젝트 관리 ----------
  function addProject() {
    var name = (prompt('새 프로젝트 이름을 입력하세요', '') || '').trim();
    if (!name) return;
    var pid = uid('p');
    data.projects.push({ id: pid, name: name, createdAt: Date.now(), tasks: [] });
    data.activeProjectId = pid;
    save();
    render();
  }

  function renameProject() {
    var p = activeProject();
    if (!p) return;
    var name = (prompt('프로젝트 이름 변경', p.name) || '').trim();
    if (!name) return;
    p.name = name;
    save();
    render();
  }

  function deleteProject() {
    var p = activeProject();
    if (!p) return;
    if (!confirm("'" + p.name + "' 프로젝트를 삭제할까요?\n안에 있는 태스크도 모두 사라집니다.")) return;
    data.projects = data.projects.filter(function (x) { return x.id !== p.id; });
    data.activeProjectId = data.projects[0] ? data.projects[0].id : null;
    save();
    render();
  }

  // ---------- 백업 (내보내기 / 가져오기) ----------
  function exportData() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'project-board-backup-' + todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.projects)) throw new Error('형식 오류');
        data = parsed;
        if (!activeProject() && data.projects[0]) data.activeProjectId = data.projects[0].id;
        save();
        render();
        alert('가져오기 완료!');
      } catch (e) {
        alert('가져오기 실패: 올바른 백업 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
  }

  $('#btn-add-project').addEventListener('click', addProject);
  $('#btn-export').addEventListener('click', exportData);
  $('#btn-import').addEventListener('click', function () { $('#file-import').click(); });
  $('#file-import').addEventListener('change', function (e) {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  // ---------- 시작 ----------
  render();
})();
