(() => {
  'use strict';

  const SIZES = {
    small: { cols: 14, rows: 16 },
    medium: { cols: 12, rows: 14 },
    large: { cols: 10, rows: 10 },
    xl: { cols: 8, rows: 9 },
  };
  let COLS = 12;
  let ROWS = 14;
  let size = 'medium';
  const COLORS = 5;
  const BEST_KEY = 'bubbleBreaker.best';
  const BEST_LEVELS_KEY = 'bubbleBreaker.bestLevels';
  const PROGRESS_KEY = 'bubbleBreaker.levelProgress';
  const TAP_KEY = 'bubbleBreaker.tapMode';
  const GAME_MODE_KEY = 'bubbleBreaker.gameMode';
  const SIZE_KEY = 'bubbleBreaker.size';

  const $ = id => document.getElementById(id);
  const boardEl = $('board');
  const scoreEl = $('score');
  const scoreLabel = $('scoreLabel');
  const goalEl = $('goal');
  const barEl = $('bar');
  const totalEl = $('total');
  const bestEl = $('best');
  const infoEl = $('info');
  const undoBtn = $('undoBtn');
  const settingsEl = $('settings');
  const boardWrap = document.querySelector('.board-wrap');
  const classicBtn = $('classicBtn');
  const levelsBtn = $('levelsBtn');
  const overlay = $('overlay');
  const overTitle = $('overTitle');
  const overText = $('overText');
  const againBtn = $('againBtn');
  const altBtn = $('altBtn');

  // cols[c] is a column stored bottom-up: cols[c][0] is the bottom bubble.
  let cols = [];
  let score = 0;          // classic: game score; levels: this level's score
  let history = [];
  let selection = null;   // { ids, cells: [{c,i}], points }
  let busy = false;
  let nextId = 1;
  let twoTap = true;
  let gameMode = 'classic';
  let level = 1;
  let totalBefore = 0;    // levels: total score banked before this level
  let goalAnnounced = false;
  let primaryAction = null;
  let altAction = null;
  const best = { classic: 0, levels: 0 };
  const elements = new Map(); // bubble id -> element
  let previewEl = null;

  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  }

  // the k-th bubble in a group is worth 10k - 5 (5, 15, 25, ...), which sums to 5n²
  const points = n => 5 * n * n;
  // goals scale with how many bubbles fit on the board (medium = 168)
  // Levels: the running total must reach 1,000, 3,000, 5,000, 7,000, ...
  // (as in the original), scaled to the board size (10x10 = 100 bubbles).
  const goalFor = lvl => Math.round((2000 * lvl - 1000) * (COLS * ROWS) / 100 / 100) * 100;
  // End-of-board bonus: 2,000 for a clear, shrinking fast as more bubbles are left.
  const bonusFor = left => left < 10 ? 2000 - 20 * left * left : 0;
  const DEFAULT_SIZE = { classic: 'medium', levels: 'large' };
  const isLevels = () => gameMode === 'levels';
  const total = () => totalBefore + score;

  function fillBoard() {
    cols = [];
    for (let c = 0; c < COLS; c++) {
      const col = [];
      for (let i = 0; i < ROWS; i++) col.push({ id: nextId++, color: Math.floor(Math.random() * COLORS) });
      cols.push(col);
    }
    score = 0;
    history = [];
    goalAnnounced = false;
    clearSelection();
    hideOverlay();
    for (const el of elements.values()) el.remove();
    elements.clear();
    render();
  }

  function startClassic() {
    fillBoard();
    setInfo('Tap a group of 2+ matching bubbles');
  }

  function startLevel(lvl, banked) {
    level = lvl;
    totalBefore = banked;
    save(PROGRESS_KEY, JSON.stringify({ level, totalBefore }));
    fillBoard();
    setInfo(`Level ${level}: reach a target of ${goalFor(level).toLocaleString()} points`);
  }

  function newGame() {
    if (isLevels()) startLevel(1, 0);
    else startClassic();
  }

  function setGameMode(mode) {
    gameMode = mode;
    save(GAME_MODE_KEY, mode);
    document.body.classList.toggle('levels', isLevels());
    classicBtn.classList.toggle('active', !isLevels());
    levelsBtn.classList.toggle('active', isLevels());
    classicBtn.setAttribute('aria-selected', !isLevels());
    levelsBtn.setAttribute('aria-selected', isLevels());
    applySize(load(SIZE_KEY + '.' + mode, DEFAULT_SIZE[mode]));
    if (isLevels()) {
      let saved = null;
      try { saved = JSON.parse(load(PROGRESS_KEY, 'null')); } catch { /* ignore */ }
      if (saved && saved.level > 0) startLevel(saved.level, saved.totalBefore || 0);
      else startLevel(1, 0);
    } else {
      startClassic();
    }
  }

  function snapshot() {
    return { cols: cols.map(col => col.map(b => ({ ...b }))), score };
  }

  function findGroup(c, i) {
    const color = cols[c][i].color;
    const seen = new Set();
    const queue = [[c, i]];
    const cells = [];
    // breadth-first so cells are ordered by distance from the tapped bubble
    for (let q = 0; q < queue.length; q++) {
      const [x, y] = queue[q];
      const k = x + ',' + y;
      if (seen.has(k)) continue;
      const b = cols[x] && cols[x][y];
      if (!b || b.color !== color) continue;
      seen.add(k);
      cells.push({ c: x, i: y });
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
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

  // Sync DOM elements to the current state; transitions animate falls and shifts.
  function render() {
    const live = new Set();
    cols.forEach((col, c) => {
      col.forEach((b, i) => {
        live.add(b.id);
        let el = elements.get(b.id);
        const pos = `translate(${c * 100}%, ${(ROWS - 1 - i) * 100}%)`;
        if (!el) {
          el = document.createElement('div');
          el.className = 'bubble c' + b.color;
          el.style.transition = 'none';
          elements.set(b.id, el);
          boardEl.appendChild(el);
          el.style.transform = pos;
          el.offsetWidth; // commit position before re-enabling transitions
          el.style.transition = '';
        }
        el.dataset.c = c;
        el.dataset.i = i;
        el.style.transform = pos;
      });
    });
    for (const [id, el] of elements) {
      if (!live.has(id)) { el.remove(); elements.delete(id); }
    }
    renderStats();
    undoBtn.disabled = history.length === 0;
  }

  function renderStats() {
    scoreEl.textContent = isLevels() ? total() : score;
    const shown = isLevels() ? total() : score;
    if (shown > best[gameMode]) {
      best[gameMode] = shown;
      save(isLevels() ? BEST_LEVELS_KEY : BEST_KEY, shown);
    }
    bestEl.textContent = best[gameMode];
    if (isLevels()) {
      const goal = goalFor(level);
      scoreLabel.textContent = `Level ${level}`;
      goalEl.textContent = `Target ${goal.toLocaleString()}`;
      totalEl.textContent = score;
      const need = Math.max(1, goal - totalBefore);
      barEl.style.width = Math.min(100, Math.max(0, (total() - totalBefore) / need * 100)) + '%';
      barEl.classList.toggle('done', total() >= goal);
    } else {
      scoreLabel.textContent = 'Score';
    }
  }

  function setInfo(text) { infoEl.textContent = text; }

  function clearSelection() {
    if (selection) {
      for (const id of selection.ids) {
        const el = elements.get(id);
        if (el) el.classList.remove('selected');
      }
    }
    selection = null;
    if (previewEl) { previewEl.remove(); previewEl = null; }
  }

  function showFloat(cells, text, preview, small) {
    let sx = 0, sy = 0;
    for (const { c, i } of cells) { sx += c + 0.5; sy += ROWS - 1 - i + 0.5; }
    const el = document.createElement('div');
    el.className = 'float' + (preview ? ' preview' : '') + (small ? ' small' : '');
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
    for (const id of selection.ids) elements.get(id).classList.add('selected');
    previewEl = showFloat(cells, '+' + selection.points, true);
    setInfo(`${cells.length} bubbles = ${selection.points} points. Tap again to pop.`);
  }

  const PRAISE = [[14, 'Perfect!'], [10, 'Great!'], [5, 'Good!']];

  function showPraise(n) {
    const hit = PRAISE.find(([min]) => n >= min);
    if (!hit) return;
    const el = document.createElement('div');
    el.className = 'praise';
    el.textContent = hit[1];
    boardEl.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  // Bubbles burst one after another, spreading out from the tapped bubble.
  // The k-th bubble is worth 10k - 5 (5, 15, 25, ...).
  function pop(cells) {
    busy = true;
    history.push(snapshot());
    if (history.length > 50) history.shift();
    clearSelection();

    const doomed = cells.map(({ c, i }) => cols[c][i].id);
    const step = Math.min(70, 1000 / cells.length);
    cells.forEach((cell, k) => {
      setTimeout(() => {
        elements.get(doomed[k]).classList.add('popping');
        const worth = 10 * k + 5;
        showFloat([cell], '+' + worth, false, true);
        score += worth;
        renderStats();
      }, k * step);
    });

    const chainTime = (cells.length - 1) * step;
    setTimeout(() => {
      showPraise(cells.length);
      const gained = points(cells.length);
      if (isLevels() && !goalAnnounced && total() >= goalFor(level)) {
        goalAnnounced = true;
        setInfo('Target reached! Keep going to bank more points.');
      } else {
        setInfo(`Popped ${cells.length} for ${gained} points`);
      }
    }, chainTime);

    setTimeout(() => {
      const gone = new Set(doomed);
      // gravity: drop popped bubbles from each column
      cols = cols.map(col => col.filter(b => !gone.has(b.id)));
      // shift columns: empty columns vanish and the rest slide right
      const filled = cols.filter(col => col.length);
      cols = Array.from({ length: COLS - filled.length }, () => []).concat(filled);
      render();
      setTimeout(() => { busy = false; checkEnd(); }, 260);
    }, chainTime + 220);
  }

  function showOverlay(title, text, primary, alt) {
    overTitle.textContent = title;
    overText.textContent = text;
    againBtn.textContent = primary.label;
    primaryAction = primary.run;
    altBtn.classList.toggle('hidden', !alt);
    if (alt) { altBtn.textContent = alt.label; altAction = alt.run; }
    overlay.classList.remove('hidden');
  }

  function hideOverlay() { overlay.classList.add('hidden'); }

  function checkEnd() {
    if (hasMoves()) return;
    const left = remaining();
    const bonus = bonusFor(left);
    if (bonus) { score += bonus; render(); }
    setInfo('No more moves');
    const lines = [`Bubbles left: ${left}`];
    if (bonus) lines.push(`Bonus: +${bonus}`);

    if (!isLevels()) {
      lines.unshift(`Score: ${score}`);
      if (score >= best.classic && score > 0) lines.push('New best score!');
      showOverlay(left === 0 ? 'Board Cleared!' : 'Game Over', lines.join('\n'),
        { label: 'Play again', run: newGame }, { label: 'Undo', run: undo });
      return;
    }

    const goal = goalFor(level);
    lines.unshift(`This board: ${score}`);
    lines.push(`Total: ${total()} / ${goal}`);
    if (total() >= goal) {
      showOverlay(`Level ${level} Complete!`, lines.join('\n'),
        { label: `Level ${level + 1}`, run: () => startLevel(level + 1, total()) },
        { label: 'Undo', run: undo });
    } else {
      lines.push(`Short by ${goal - total()} points`);
      lines.push(`You reached level ${level}`);
      // losing sends you back to level 1 (undo can still rescue the board)
      save(PROGRESS_KEY, JSON.stringify({ level: 1, totalBefore: 0 }));
      showOverlay('Game Over', lines.join('\n'),
        { label: 'Start over', run: () => startLevel(1, 0) },
        { label: 'Undo', run: undo });
    }
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
    if (isLevels()) {
      goalAnnounced = total() >= goalFor(level);
      save(PROGRESS_KEY, JSON.stringify({ level, totalBefore }));
    }
    hideOverlay();
    render();
    setInfo('Undid last move');
  }

  function applySize(name) {
    size = SIZES[name] ? name : 'medium';
    COLS = SIZES[size].cols;
    ROWS = SIZES[size].rows;
    boardWrap.style.setProperty('--cols', COLS);
    boardWrap.style.setProperty('--rows', ROWS);
    updateSettingsUI();
  }

  function changeSize(name) {
    if (name === size || busy) return;
    if (history.length && overlay.classList.contains('hidden') &&
        !confirm('Changing bubble size starts a new board. Continue?')) return;
    applySize(name);
    save(SIZE_KEY + '.' + gameMode, size);
    // classic starts over; levels replays the current level on the new board
    if (isLevels()) startLevel(level, totalBefore);
    else startClassic();
  }

  function updateSettingsUI() {
    for (const b of document.querySelectorAll('#sizeOptions .option')) b.classList.toggle('active', b.dataset.size === size);
    for (const b of document.querySelectorAll('#tapOptions .seg')) b.classList.toggle('active', (b.dataset.tap === '2') === twoTap);
  }

  function openSettings() { updateSettingsUI(); settingsEl.classList.remove('hidden'); }
  function closeSettings() { settingsEl.classList.add('hidden'); }

  boardEl.addEventListener('click', onTap);
  undoBtn.addEventListener('click', undo);
  $('newBtn').addEventListener('click', () => {
    if (isLevels() && level > 1 && !confirm(`Start over from level 1? You're on level ${level}.`)) return;
    newGame();
  });
  againBtn.addEventListener('click', () => primaryAction && primaryAction());
  altBtn.addEventListener('click', () => altAction && altAction());
  classicBtn.addEventListener('click', () => { if (isLevels()) setGameMode('classic'); });
  levelsBtn.addEventListener('click', () => { if (!isLevels()) setGameMode('levels'); });
  $('settingsBtn').addEventListener('click', openSettings);
  $('closeSettings').addEventListener('click', closeSettings);
  settingsEl.addEventListener('click', e => { if (e.target === settingsEl) closeSettings(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });
  for (const b of document.querySelectorAll('#sizeOptions .option')) {
    b.addEventListener('click', () => changeSize(b.dataset.size));
  }
  for (const b of document.querySelectorAll('#tapOptions .seg')) {
    b.addEventListener('click', () => {
      twoTap = b.dataset.tap === '2';
      save(TAP_KEY, twoTap ? '2' : '1');
      clearSelection();
      updateSettingsUI();
    });
  }

  best.classic = parseInt(load(BEST_KEY, '0'), 10) || 0;
  best.levels = parseInt(load(BEST_LEVELS_KEY, '0'), 10) || 0;
  twoTap = load(TAP_KEY, '1') === '2';
  setGameMode(load(GAME_MODE_KEY, 'classic') === 'levels' ? 'levels' : 'classic');
})();
