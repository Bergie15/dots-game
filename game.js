(() => {
  'use strict';

  const COLS = 12;
  const ROWS = 14;
  const COLORS = 5;
  const BEST_KEY = 'bubbleBreaker.best';
  const MODE_KEY = 'bubbleBreaker.tapMode';

  const boardEl = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const infoEl = document.getElementById('info');
  const undoBtn = document.getElementById('undoBtn');
  const modeBtn = document.getElementById('modeBtn');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overText = document.getElementById('overText');

  // cols[c] is a column stored bottom-up: cols[c][0] is the bottom bubble.
  let cols = [];
  let score = 0;
  let best = 0;
  let history = [];
  let selection = null; // { key, cells: [{c,i}], points }
  let busy = false;
  let nextId = 1;
  let twoTap = true;
  const elements = new Map(); // bubble id -> element
  let previewEl = null;

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  }

  const points = n => n * (n - 1);

  function newGame() {
    cols = [];
    for (let c = 0; c < COLS; c++) {
      const col = [];
      for (let i = 0; i < ROWS; i++) col.push({ id: nextId++, color: Math.floor(Math.random() * COLORS) });
      cols.push(col);
    }
    score = 0;
    history = [];
    clearSelection();
    overlay.classList.add('hidden');
    for (const el of elements.values()) el.remove();
    elements.clear();
    render();
    setInfo('Tap a group of 2+ matching bubbles');
  }

  function snapshot() {
    return { cols: cols.map(col => col.map(b => ({ ...b }))), score };
  }

  function findGroup(c, i) {
    const color = cols[c][i].color;
    const seen = new Set();
    const stack = [[c, i]];
    const cells = [];
    while (stack.length) {
      const [x, y] = stack.pop();
      const k = x + ',' + y;
      if (seen.has(k)) continue;
      const b = cols[x] && cols[x][y];
      if (!b || b.color !== color) continue;
      seen.add(k);
      cells.push({ c: x, i: y });
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return cells;
  }

  function hasMoves() {
    for (let c = 0; c < COLS; c++) {
      for (let i = 0; i < cols[c].length; i++) {
        const color = cols[c][i].color;
        if (cols[c][i + 1] && cols[c][i + 1].color === color) return true;
        if (cols[c + 1] && cols[c + 1][i] && cols[c + 1][i].color === color) return true;
      }
    }
    return false;
  }

  function remaining() {
    return cols.reduce((n, col) => n + col.length, 0);
  }

  function cellToPos(c, i) {
    return { x: c * 100, y: (ROWS - 1 - i) * 100 };
  }

  // Sync DOM elements to the current state; transitions animate falls and shifts.
  function render() {
    const live = new Set();
    cols.forEach((col, c) => {
      col.forEach((b, i) => {
        live.add(b.id);
        let el = elements.get(b.id);
        const { x, y } = cellToPos(c, i);
        if (!el) {
          el = document.createElement('div');
          el.className = 'bubble c' + b.color;
          el.style.transition = 'none';
          elements.set(b.id, el);
          boardEl.appendChild(el);
          el.style.transform = `translate(${x}%, ${y}%)`;
          el.offsetWidth; // commit position before re-enabling transitions
          el.style.transition = '';
        }
        el.dataset.c = c;
        el.dataset.i = i;
        el.style.transform = `translate(${x}%, ${y}%)`;
      });
    });
    for (const [id, el] of elements) {
      if (!live.has(id)) { el.remove(); elements.delete(id); }
    }
    scoreEl.textContent = score;
    if (score > best) { best = score; save(BEST_KEY, best); }
    bestEl.textContent = best;
    undoBtn.disabled = history.length === 0;
  }

  function setInfo(text) { infoEl.textContent = text; }

  function clearSelection() {
    if (selection) {
      for (const { c, i } of selection.cells) {
        const el = elements.get(cols[c][i].id);
        if (el) el.classList.remove('selected');
      }
    }
    selection = null;
    if (previewEl) { previewEl.remove(); previewEl = null; }
  }

  function showFloat(cells, text, preview) {
    // centre of the group's bounding box, in board percentages
    let sx = 0, sy = 0;
    for (const { c, i } of cells) { sx += c + 0.5; sy += ROWS - 1 - i + 0.5; }
    const el = document.createElement('div');
    el.className = 'float' + (preview ? ' preview' : '');
    el.textContent = text;
    el.style.left = (sx / cells.length / COLS * 100) + '%';
    el.style.top = (sy / cells.length / ROWS * 100) + '%';
    boardEl.appendChild(el);
    if (!preview) setTimeout(() => el.remove(), 900);
    return el;
  }

  function select(cells) {
    clearSelection();
    selection = { ids: new Set(cells.map(({ c, i }) => cols[c][i].id)), cells, points: points(cells.length) };
    for (const { c, i } of cells) elements.get(cols[c][i].id).classList.add('selected');
    previewEl = showFloat(cells, '+' + selection.points, true);
    setInfo(`${cells.length} bubbles = ${selection.points} points. Tap again to pop.`);
  }

  function pop(cells) {
    busy = true;
    history.push(snapshot());
    if (history.length > 50) history.shift();
    clearSelection();

    const gained = points(cells.length);
    const doomed = new Set(cells.map(({ c, i }) => cols[c][i].id));
    for (const id of doomed) elements.get(id).classList.add('popping');
    showFloat(cells, '+' + gained, false);
    score += gained;
    scoreEl.textContent = score;
    setInfo(`Popped ${cells.length} for ${gained} points`);

    setTimeout(() => {
      // gravity: drop popped bubbles from each column
      cols = cols.map(col => col.filter(b => !doomed.has(b.id)));
      // shift columns: empty columns vanish and the rest slide right
      const filled = cols.filter(col => col.length);
      cols = Array.from({ length: COLS - filled.length }, () => []).concat(filled);
      render();
      setTimeout(() => { busy = false; checkEnd(); }, 260);
    }, 200);
  }

  function checkEnd() {
    if (hasMoves()) return;
    const left = remaining();
    let bonus = 0;
    if (left === 0) bonus = 1000;
    else if (left < 5) bonus = (5 - left) * 100;
    if (bonus) { score += bonus; render(); }
    overTitle.textContent = left === 0 ? 'Board Cleared!' : 'Game Over';
    overText.textContent =
      `Score: ${score}\n` +
      `Bubbles left: ${left}` +
      (bonus ? `\nBonus: +${bonus}` : '') +
      (score >= best && score > 0 ? '\nNew best score!' : '');
    setInfo('No more moves');
    overlay.classList.remove('hidden');
  }

  function onTap(e) {
    if (busy) return;
    const el = e.target.closest('.bubble');
    if (!el) { clearSelection(); return; }
    const c = +el.dataset.c, i = +el.dataset.i;
    const b = cols[c] && cols[c][i];
    if (!b) return;

    if (selection && selection.ids.has(b.id)) { pop(selection.cells); return; }

    const cells = findGroup(c, i);
    if (cells.length < 2) {
      clearSelection();
      el.classList.remove('shake');
      el.offsetWidth;
      el.classList.add('shake');
      setInfo('Need 2 or more connected bubbles');
      return;
    }
    if (twoTap) select(cells);
    else pop(cells);
  }

  function undo() {
    if (busy || !history.length) return;
    clearSelection();
    const prev = history.pop();
    cols = prev.cols;
    score = prev.score;
    overlay.classList.add('hidden');
    render();
    setInfo('Undid last move');
  }

  function updateModeBtn() {
    modeBtn.textContent = twoTap ? '2-tap' : '1-tap';
    modeBtn.title = twoTap ? 'Tap to select, tap again to pop' : 'Tap once to pop';
  }

  boardEl.addEventListener('click', onTap);
  undoBtn.addEventListener('click', undo);
  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('againBtn').addEventListener('click', newGame);
  modeBtn.addEventListener('click', () => {
    twoTap = !twoTap;
    save(MODE_KEY, twoTap ? '2' : '1');
    clearSelection();
    updateModeBtn();
  });

  best = parseInt(load(BEST_KEY, '0'), 10) || 0;
  twoTap = load(MODE_KEY, '2') !== '1';
  updateModeBtn();
  newGame();
})();
