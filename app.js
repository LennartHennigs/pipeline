import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, get, update, onValue, off, remove }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const FIREBASE_CONFIG = {
  apiKey:            "%%FIREBASE_API_KEY%%",
  authDomain:        "%%FIREBASE_AUTH_DOMAIN%%",
  databaseURL:       "%%FIREBASE_DATABASE_URL%%",
  projectId:         "%%FIREBASE_PROJECT_ID%%",
  storageBucket:     "%%FIREBASE_STORAGE_BUCKET%%",
  messagingSenderId: "%%FIREBASE_MESSAGING_SENDER_ID%%",
  appId:             "%%FIREBASE_APP_ID%%"
};

let db, firebaseReady = false;
try {
  db = getDatabase(initializeApp(FIREBASE_CONFIG));
  firebaseReady = true;
} catch(e) { console.warn('Firebase unavailable — solo only', e); }

// ── Constants ──

const DIE1 = ['dead-end','corner','straight','cross','t-junction','t-junction'];
const DIE2 = ['corner','straight','cross','cross','t-junction','t-junction'];

const BASE_OPENINGS = {
  'dead-end':   ['N'],
  'corner':     ['N','E'],
  'straight':   ['N','S'],
  't-junction': ['N','E','W'],
  'cross':      ['N','E','S','W'],
};

const DIRS      = ['N','E','S','W'];
const DIR_INDEX = { N:0, E:1, S:2, W:3 };  // O(1) replaces indexOf
const OPP       = { N:'S', S:'N', E:'W', W:'E' };
const DIR_RC    = { N:[-1,0], S:[1,0], E:[0,1], W:[0,-1] };

const PLAYER_COLORS = ['#e94560','#53d8fb','#ffd700','#a855f7','#f97316','#22c55e'];

const SHEETS = {
  front: {
    rows:5, cols:5, maxRounds:12,
    topEdge:[1,3,1,1,1], bottomEdge:[1,1,3,1,1],
    leftEdge:[1,3,1,1,5], rightEdge:[5,1,1,1,1],
    prePlaced:[
      {r:1,c:1,type:'corner',rot:0},
      {r:4,c:3,type:'corner',rot:2},
    ]
  },
  back: {
    rows:6, cols:5, maxRounds:14,
    topEdge:[5,1,1,1,1], bottomEdge:[1,1,5,1,1],
    leftEdge:[1,1,1,5,1,1], rightEdge:[5,1,1,1,5,1],
    prePlaced:[
      {r:2,c:2,type:'t-junction',rot:1},
    ]
  }
};

const SOLO_RATINGS = [
  {min:40,max:40,label:'Pipeline-Profi 🏆'},
  {min:37,max:39,label:'Würfel-Champion 🎲'},
  {min:34,max:36,label:'Verbindungsperson 🔧'},
  {min:30,max:33,label:'Leitungslehrling 📐'},
  {min:20,max:29,label:'Kanalreiniger 🪣'},
  {min:0, max:19,label:'Rohrkrepierer 💥'},
];

const SAVE_KEY = 'pipeline_solo_save';
const NAME_KEY = 'pipeline_player_name';

// ── Cached DOM refs ──

const DIE_EL = [0,1].map(i => ({
  card: document.getElementById(`die${i}`),
  svg:  document.getElementById(`die${i}-svg`),
  mark: document.getElementById(`die${i}-mark`),
}));

const EL = {
  stuckBanner:  document.getElementById('stuck-banner'),
  dicePanel:    document.getElementById('dice-panel'),
  confirmBtn:   document.getElementById('confirm-btn'),
  scoreDisplay: document.getElementById('score-display'),
  gridSvg:      document.getElementById('grid-svg'),
  toast:        document.getElementById('toast'),
  resumeBanner: document.getElementById('resume-banner'),
  playersMini:  document.getElementById('players-mini'),
  nameInput:    document.getElementById('player-name'),
  joinCodeInput:document.getElementById('join-code'),
  hintsToggle:  document.getElementById('hints-toggle'),
  resultsFooter:document.getElementById('results-footer'),
};

// ── State ──

let myId    = 'p_' + Math.random().toString(36).slice(2,8);
let myName  = '';
let roomCode= '';
let isHost  = false;
let isSolo  = false;
let roomRef = null;
let roomListener = null;
let selectedSheet = 'front';

let sheetCfg       = null;
let grid           = [];
let diceTypes      = [null, null];
let diceRots       = [0, 0];
let dicePlaced     = [false, false];
let placedThisRound= [];
let activeDie      = 0;
let myScore        = 0;
let myStuck        = false;
let round          = 0;
let showHints      = true;
let lastGameId     = -1;
let lastRoomData   = null;
let lastPlayers    = null;

// ── Pipe logic ──

const _openingsCache = Object.create(null);
function getOpenings(type, rot) {
  const key = `${type}:${rot}`;
  if (_openingsCache[key]) return _openingsCache[key];
  const base = BASE_OPENINGS[type] || [];
  const result = new Set(base.map(d => DIRS[(DIR_INDEX[d] + rot) % 4]));
  _openingsCache[key] = result;
  return result;
}

function isValidPlacementOnGrid(g, r, c, type, rot) {
  const rows = g.length, cols = g[0].length;
  for (const dir of getOpenings(type, rot)) {
    const [dr, dc] = DIR_RC[dir];
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
    const nb = g[nr][nc];
    if (nb && getOpenings(nb.type, nb.rot).has(OPP[dir])) return true;
  }
  return false;
}

const isValidPlacement = (r, c, type, rot) => isValidPlacementOnGrid(grid, r, c, type, rot);

// ── SVG pipe renderer ──

const CELL = 58, HALF = 29, PIPE = 10;

function pipePath(type, rot, color, size = CELL) {
  const h = size / 2, p = size / CELL * PIPE;
  const pts = { N:[h,0], E:[size,h], S:[h,size], W:[0,h] };
  const segs = [];
  for (const dir of getOpenings(type, rot))
    segs.push(`<line x1="${h}" y1="${h}" x2="${pts[dir][0]}" y2="${pts[dir][1]}" stroke="${color}" stroke-width="${p}" stroke-linecap="round"/>`);
  segs.push(`<circle cx="${h}" cy="${h}" r="${p/2}" fill="${color}"/>`);
  return segs.join('');
}

function makeDieSVG(type, rot, color) {
  if (!type) return '';
  return `<svg viewBox="0 0 ${CELL} ${CELL}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${pipePath(type, rot, color)}</svg>`;
}

// ── Grid rendering ──

function buildGrid() {
  if (!sheetCfg) return;
  const { rows, cols } = sheetCfg;
  const G = 22;
  const svgW = cols * CELL + G*2, svgH = rows * CELL + G*2;
  const maxW = Math.min(window.innerWidth - 16, 360);
  const maxH = window.innerHeight - 280;
  const scale = Math.min(maxW / svgW, maxH / svgH, 1);
  EL.gridSvg.setAttribute('width',   svgW * scale);
  EL.gridSvg.setAttribute('height',  svgH * scale);
  EL.gridSvg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

  const edgeColor = (v, conn) =>
    v === 5 ? '#e94560' : v === 3 ? '#ffd700' : (conn ? '#aaa' : '#555');
  const bothPlaced = dicePlaced[0] && dicePlaced[1];
  const curType = bothPlaced ? null : diceTypes[activeDie];
  const curRot  = bothPlaced ? 0   : diceRots[activeDie];
  let html = `<rect x="${G}" y="${G}" width="${cols*CELL}" height="${rows*CELL}" fill="#0f2a4a" rx="4"/>`;

  for (let r = 0; r <= rows; r++)
    html += `<line x1="${G}" y1="${G+r*CELL}" x2="${G+cols*CELL}" y2="${G+r*CELL}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>`;
  for (let c = 0; c <= cols; c++)
    html += `<line x1="${G+c*CELL}" y1="${G}" x2="${G+c*CELL}" y2="${G+rows*CELL}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>`;

  for (let c = 0; c < cols; c++) {
    const tc = edgeConnected(grid[0][c], 'N');
    const bc = edgeConnected(grid[rows-1][c], 'S');
    const tv = sheetCfg.topEdge[c], bv = sheetCfg.bottomEdge[c];
    html += `<text x="${G+c*CELL+HALF}" y="${G-8}" text-anchor="middle" font-size="${tc?15:13}" font-weight="${tc?900:700}" fill="${edgeColor(tv,tc)}">${tv}</text>`;
    html += `<text x="${G+c*CELL+HALF}" y="${G+rows*CELL+16}" text-anchor="middle" font-size="${bc?15:13}" font-weight="${bc?900:700}" fill="${edgeColor(bv,bc)}">${bv}</text>`;
  }
  for (let r = 0; r < rows; r++) {
    const lc = edgeConnected(grid[r][0], 'W');
    const rc = edgeConnected(grid[r][cols-1], 'E');
    const lv = sheetCfg.leftEdge[r], rv = sheetCfg.rightEdge[r];
    html += `<text x="${G-8}" y="${G+r*CELL+HALF+5}" text-anchor="middle" font-size="${lc?15:13}" font-weight="${lc?900:700}" fill="${edgeColor(lv,lc)}">${lv}</text>`;
    html += `<text x="${G+cols*CELL+8}" y="${G+r*CELL+HALF+5}" text-anchor="middle" font-size="${rc?15:13}" font-weight="${rc?900:700}" fill="${edgeColor(rv,rc)}">${rv}</text>`;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const cx = G + c*CELL, cy = G + r*CELL;
      if (cell) {
        html += `<g transform="translate(${cx},${cy})">${pipePath(cell.type, cell.rot, cell.prePlaced ? '#666' : '#4caf50')}</g>`;
      } else {
        const valid = curType ? isValidPlacement(r, c, curType, curRot) : false;
        const clickable = showHints ? valid : (curType && !bothPlaced);
        html += (showHints && valid)
          ? `<rect x="${cx+1}" y="${cy+1}" width="${CELL-2}" height="${CELL-2}" fill="rgba(83,216,251,.07)" rx="2"/>`
          : `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" fill="rgba(0,0,0,.28)" rx="2"/>`;
        if (clickable)
          html += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" fill="transparent" rx="2" data-r="${r}" data-c="${c}" class="cell-click" style="cursor:pointer"/>`;
      }
    }
  }

  for (const p of placedThisRound) {
    const cx = G + p.c*CELL, cy = G + p.r*CELL;
    html += `<g transform="translate(${cx},${cy})" opacity="0.7">${pipePath(diceTypes[p.dieIdx], diceRots[p.dieIdx], '#53d8fb')}</g>`;
    html += `<text x="${cx+CELL-6}" y="${cy+14}" text-anchor="middle" font-size="12" fill="#e94560" data-undo="${placedThisRound.indexOf(p)}" style="cursor:pointer">✕</text>`;
  }

  EL.gridSvg.innerHTML = html;
}

function undoPlace(idx) {
  const p = placedThisRound[idx];
  dicePlaced[p.dieIdx] = false;
  grid[p.r][p.c] = null;
  placedThisRound.splice(idx, 1);
  activeDie = p.dieIdx;   // restore focus to the die that was undone
  updateDicePanel();
  buildGrid();
  updateConfirmBtn();
}

// ── Cell click → place piece ──

function cellClicked(r, c) {
  if (myStuck) return;
  if (dicePlaced[activeDie]) {
    const other = 1 - activeDie;
    if (!dicePlaced[other]) { activeDie = other; updateDicePanel(); buildGrid(); }
    return;
  }
  if (grid[r][c]) return;
  if (!isValidPlacement(r, c, diceTypes[activeDie], diceRots[activeDie])) {
    showToast('⚠️ Must connect to existing pipe');
    return;
  }
  dicePlaced[activeDie] = true;
  grid[r][c] = { type: diceTypes[activeDie], rot: diceRots[activeDie] };
  placedThisRound.push({ r, c, dieIdx: activeDie });
  const other = 1 - activeDie;
  if (!dicePlaced[other]) activeDie = other;
  buildGrid();
  updateDicePanel();
  updateConfirmBtn();
  calcScore();
}

// ── Validation ──

function canPlayerMove(g) {
  const rows = g.length, cols = g[0].length;
  const [t1, t2] = diceTypes;
  for (let rot1 = 0; rot1 < 4; rot1++)
    for (let r1 = 0; r1 < rows; r1++)
      for (let c1 = 0; c1 < cols; c1++) {
        if (g[r1][c1] || !isValidPlacementOnGrid(g, r1, c1, t1, rot1)) continue;
        const g2 = g.map(row => [...row]);
        g2[r1][c1] = { type: t1, rot: rot1 };
        for (let rot2 = 0; rot2 < 4; rot2++)
          for (let r2 = 0; r2 < rows; r2++)
            for (let c2 = 0; c2 < cols; c2++)
              if (!g2[r2][c2] && isValidPlacementOnGrid(g2, r2, c2, t2, rot2)) return true;
      }
  return false;
}

function updateConfirmBtn() {
  EL.confirmBtn.disabled = placedThisRound.length < 2;
}

// ── Score calculation ──

function scoreCell(r, c, type, rot) {
  const { rows, cols, topEdge, bottomEdge, leftEdge, rightEdge } = sheetCfg;
  const openings = getOpenings(type, rot);
  let pts = 0;
  if (r === 0        && openings.has('N')) pts += topEdge[c];
  if (r === rows - 1 && openings.has('S')) pts += bottomEdge[c];
  if (c === 0        && openings.has('W')) pts += leftEdge[r];
  if (c === cols - 1 && openings.has('E')) pts += rightEdge[r];
  return pts;
}

function calcScore() {
  let total = 0;
  for (let r = 0; r < sheetCfg.rows; r++)
    for (let c = 0; c < sheetCfg.cols; c++) {
      const cell = grid[r][c];
      if (cell && !cell.prePlaced) total += scoreCell(r, c, cell.type, cell.rot);
    }
  if (allOnesConnected()) total += 10;
  myScore = total;
  EL.scoreDisplay.textContent = total;
  return total;
}

function edgeConnected(cell, dir) {
  return cell && getOpenings(cell.type, cell.rot).has(dir);
}

function allOnesConnected() {
  const { rows, cols, topEdge, bottomEdge, leftEdge, rightEdge } = sheetCfg;
  for (let c = 0; c < cols; c++) {
    if (topEdge[c]    === 1 && !edgeConnected(grid[0][c],      'N')) return false;
    if (bottomEdge[c] === 1 && !edgeConnected(grid[rows-1][c], 'S')) return false;
  }
  for (let r = 0; r < rows; r++) {
    if (leftEdge[r]  === 1 && !edgeConnected(grid[r][0],       'W')) return false;
    if (rightEdge[r] === 1 && !edgeConnected(grid[r][cols-1],  'E')) return false;
  }
  return true;
}

// ── Dice panel ──

function updateDicePanel() {
  for (let i = 0; i < 2; i++) {
    const { card, svg, mark } = DIE_EL[i];
    const isActive = i === activeDie, isPlaced = dicePlaced[i];
    const color = isPlaced ? '#4caf50' : isActive ? '#53d8fb' : '#888';
    svg.innerHTML  = makeDieSVG(diceTypes[i], diceRots[i], color);
    mark.style.display = isPlaced ? 'block' : 'none';
    card.className = 'die-card' + (isPlaced ? ' placed' : isActive ? ' selected' : '');
  }
}

window.dieCardClick = function(i) {
  if (dicePlaced[i]) return;
  if (activeDie !== i) {
    activeDie = i;
  } else {
    diceRots[i] = (diceRots[i] + 1) % 4;
    const placed = placedThisRound.find(p => p.dieIdx === i);
    if (placed) { grid[placed.r][placed.c].rot = diceRots[i]; calcScore(); }
  }
  updateDicePanel();
  buildGrid();
};

// ── Round lifecycle ──

function rollDice() {
  return {
    d1: DIE1[Math.floor(Math.random() * DIE1.length)],
    d2: DIE2[Math.floor(Math.random() * DIE2.length)],
  };
}

function startRound(d1, d2) {
  diceTypes = [d1, d2];
  diceRots  = [0, 0];
  dicePlaced = [false, false];
  placedThisRound = [];
  activeDie = 0;
  if (!myStuck) {
    // Flash animation — navigator.vibrate not supported on iOS
    EL.dicePanel.classList.remove('dice-flash');
    void EL.dicePanel.offsetWidth;
    EL.dicePanel.classList.add('dice-flash');
    EL.confirmBtn.style.display = 'block';
    EL.confirmBtn.textContent = 'Confirm ✓';
  }
  updateDicePanel();
  updateConfirmBtn();
  buildGrid();
  if (isSolo) saveGame();
}

window.confirmPlacement = async function() {
  if (myStuck) return;
  const score = calcScore();
  const stuck = !canPlayerMove(grid);

  if (isSolo) {
    myStuck = stuck;
    updateStuckUI();
    round++;
    if (stuck || round >= sheetCfg.maxRounds) {
      clearSave();
      showResults([{ name: myName, score, stuck }]);
    } else {
      const dice = rollDice();
      startRound(dice.d1, dice.d2);
    }
    return;
  }

  await updateMyPlayer({ confirmed: true, score, stuck });
  EL.confirmBtn.style.display = 'none';
};

// ── Stuck / no moves ──

function updateStuckUI() {
  EL.stuckBanner.style.display = myStuck ? 'block' : 'none';
  EL.dicePanel.style.display   = myStuck ? 'none'  : 'block';
  EL.confirmBtn.style.display  = myStuck ? 'none'  : 'block';
}

// ── Screen navigation ──

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Grid init ──

function initLocalGame(sheet) {
  sheetCfg = SHEETS[sheet];
  const { rows, cols } = sheetCfg;
  grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const pp of sheetCfg.prePlaced)
    grid[pp.r][pp.c] = { type: pp.type, rot: pp.rot, prePlaced: true };
  myScore = 0; myStuck = false; round = 0;
  EL.scoreDisplay.textContent = 0;
  updateStuckUI();
}

// ── Solo mode ──

window.startSolo = function() {
  myName = EL.nameInput.value.trim() || 'Solo Player';
  isSolo = true;
  showHints = EL.hintsToggle.checked;
  initLocalGame(selectedSheet);
  showScreen('game');
  EL.playersMini.innerHTML = '';
  const dice = rollDice();
  startRound(dice.d1, dice.d2);
};

// ── Multiplayer — create / join ──

function multiplayerSetup() {
  if (!firebaseReady) { showToast('Firebase not configured — try Solo mode'); return false; }
  myName = EL.nameInput.value.trim();
  if (!myName) { showToast('Enter your name first'); return false; }
  isSolo = false;
  return true;
}

function openWaitingRoom(code, asHost) {
  roomCode = code;
  roomRef  = ref(db, `rooms/${roomCode}`);
  document.getElementById('display-code').textContent = roomCode;
  document.getElementById('start-btn').style.display = asHost ? 'block' : 'none';
  showScreen('waiting');
  showQR();
  listenRoom();
}

window.createRoom = async function() {
  if (!multiplayerSetup()) return;
  isHost = true;
  const code = randomCode();
  await set(ref(db, `rooms/${code}`), {
    sheet: selectedSheet, round: 0,
    maxRounds: SHEETS[selectedSheet].maxRounds,
    phase: 'waiting', dice: { d1: null, d2: null }, host: myId,
    players: { [myId]: { name: myName, score: 0, confirmed: false, stuck: false } }
  });
  openWaitingRoom(code, true);
};

window.joinRoom = async function() {
  if (!multiplayerSetup()) return;
  isHost = false;
  const code = EL.joinCodeInput.value.trim().toUpperCase();
  if (code.length !== 4) { showToast('Enter a 4-letter room code'); return; }
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists()) { showToast('Room not found'); return; }
  if (snap.val().phase !== 'waiting') { showToast('Game already started'); return; }
  await update(ref(db, `rooms/${code}/players/${myId}`),
    { name: myName, score: 0, confirmed: false, stuck: false });
  openWaitingRoom(code, false);
};

// ── Firebase listener ──

function listenRoom() {
  if (roomListener) off(roomRef, 'value', roomListener);
  roomListener = onValue(roomRef, snap => {
    if (!snap.exists()) return;
    const data = snap.val();
    const players = data.players || {};
    lastRoomData = data;
    lastPlayers  = players;

    if (data.phase === 'waiting') {
      renderWaitingPlayers(players);
    }

    if (data.phase === 'playing') {
      const gameId = data.gameId ?? 0;
      if (gameId !== lastGameId) {
        lastGameId = gameId;
        showHints = EL.hintsToggle.checked;
        myStuck = false;
        initLocalGame(data.sheet);
        showScreen('game');
      }
      round = data.round;
      renderMiniPlayers(players, data.wins);

      if (data.dice?.d1 && data.dice?.d2 &&
          (diceTypes[0] !== data.dice.d1 || diceTypes[1] !== data.dice.d2)) {
        startRound(data.dice.d1, data.dice.d2);
        if (myStuck) autoConfirm();
      }

      if (isHost) {
        const allConfirmed = Object.values(players).every(p => p.confirmed || p.stuck);
        if (allConfirmed && data.dice?.d1) advanceRound(data, players);
      }
    }

    if (data.phase === 'ended') {
      const wins = data.wins || {};
      const sorted = Object.entries(players)
        .map(([id, p]) => ({ id, name: p.name, score: p.score, stuck: p.stuck, wins: wins[id] || 0 }))
        .sort((a, b) => b.score - a.score);
      showResults(sorted);
    }
  });
}

function updateMyPlayer(updates) {
  return update(ref(db, `rooms/${roomCode}/players/${myId}`), updates);
}

async function autoConfirm() {
  await updateMyPlayer({ confirmed: true, score: myScore, stuck: true });
}

function stopListeningRoom() {
  if (roomListener) { off(roomRef, 'value', roomListener); roomListener = null; }
}

async function advanceRound(data, players) {
  const nextRound = data.round + 1;
  const allStuck  = Object.values(players).every(p => p.stuck);
  if (nextRound >= data.maxRounds || allStuck) {
    await update(roomRef, { phase: 'ended' });
    return;
  }
  const updates = {};
  for (const pid of Object.keys(players))
    updates[`players/${pid}/confirmed`] = players[pid].stuck || false;
  const dice = rollDice();
  await update(roomRef, { ...updates, round: nextRound, 'dice/d1': dice.d1, 'dice/d2': dice.d2 });
}

window.startGame = async function() {
  const dice = rollDice();
  await update(roomRef, { phase: 'playing', gameId: 0, round: 0, 'dice/d1': dice.d1, 'dice/d2': dice.d2 });
};

window.playAgainSamePlayers = async function() {
  if (!isHost || !lastRoomData || !lastPlayers) return;
  const wins = { ...lastRoomData.wins };

  const [[winnerId] = []] = Object.entries(lastPlayers).sort((a, b) => b[1].score - a[1].score);
  if (winnerId) wins[winnerId] = (wins[winnerId] || 0) + 1;

  const updates = { wins, gameId: (lastRoomData.gameId || 0) + 1, phase: 'playing', round: 0 };
  for (const pid of Object.keys(lastPlayers)) {
    updates[`players/${pid}/score`]     = 0;
    updates[`players/${pid}/confirmed`] = false;
    updates[`players/${pid}/stuck`]     = false;
  }
  const { d1, d2 } = rollDice();
  updates['dice/d1'] = d1;
  updates['dice/d2'] = d2;
  await update(roomRef, updates);
};

// ── Player rendering ──

function avatarHTML(name, idx, cls) {
  return `<div class="${cls}" style="background:${PLAYER_COLORS[idx % PLAYER_COLORS.length]}">${name[0].toUpperCase()}</div>`;
}

const winsSpan = (count, cls) => count > 0 ? `<span class="${cls}">${count}W</span>` : '';

function renderWaitingPlayers(players) {
  const entries = Object.entries(players);
  document.getElementById('player-count').textContent = entries.length;
  document.getElementById('waiting-players').innerHTML = entries.map(([id, p], i) => `
    <div class="player-item">
      ${avatarHTML(p.name, i, 'player-avatar')}
      <div class="player-name">${p.name}</div>
      ${id === myId ? '<div class="player-badge">You</div>' : ''}
    </div>`).join('');
}

function renderMiniPlayers(players, wins) {
  EL.playersMini.innerHTML = Object.entries(players).map(([id, p], i) => {
    const icon  = p.stuck ? '🚫' : p.confirmed ? '✓' : '…';
    const color = p.confirmed ? '#4caf50' : p.stuck ? '#e94560' : '#888';
    const winBadge = winsSpan(wins?.[id] ?? 0, 'mini-wins');
    return `<div class="mini-player">
      ${avatarHTML(p.name, i, 'mini-avatar')}
      <span class="mini-check" style="color:${color}">${icon}</span>
      ${winBadge}
    </div>`;
  }).join('');
}

// ── Results ──

function showResults(sorted) {
  showScreen('results');
  const medals = ['🥇','🥈','🥉'];
  document.getElementById('results-list').innerHTML = sorted.map((p, i) => {
    const winsLabel = winsSpan(p.wins, 'result-wins');
    return `<div class="result-row">
      <div class="result-rank ${i===0?'gold':''}">${medals[i] ?? i+1}</div>
      <div class="result-name">${p.name}${p.stuck?' <span class="result-note">(finished early)</span>':''}${winsLabel}</div>
      <div class="result-score">${p.score}</div>
    </div>`;
  }).join('');

  const soloBox = document.getElementById('solo-rating-box');
  const footer  = EL.resultsFooter;
  if (isSolo) {
    const rating = SOLO_RATINGS.find(r => sorted[0].score >= r.min && sorted[0].score <= r.max);
    document.getElementById('solo-rating-text').textContent = rating?.label ?? '—';
    soloBox.style.display = 'block';
    footer.innerHTML = `<button class="btn-primary" onclick="playAgain()">Play Again</button>`;
  } else {
    soloBox.style.display = 'none';
    footer.innerHTML = isHost
      ? `<button class="btn-success" onclick="playAgainSamePlayers()">Play Again (same room) →</button>
         <button class="btn-ghost" onclick="leaveRoom()">← Leave Room</button>`
      : `<button class="btn-ghost" onclick="leaveRoom()">← Leave Room</button>`;
  }
}

window.playAgain = function() {
  stopListeningRoom();
  showScreen('lobby');
};

window.leaveRoom = function() {
  stopListeningRoom();
  if (roomRef && isHost) remove(roomRef);
  showScreen('lobby');
};

window.cancelGame = function() {
  if (!confirm('Leave the game? Your progress will be lost.')) return;
  stopListeningRoom();
  if (!isSolo && roomRef) {
    isHost ? remove(roomRef) : remove(ref(db, `rooms/${roomCode}/players/${myId}`));
  }
  sheetCfg = null;
  showScreen('lobby');
};

// ── Game state persistence (solo) ──

function saveGame() {
  if (!isSolo || !sheetCfg) return;
  const sheet = Object.keys(SHEETS).find(k => SHEETS[k] === sheetCfg);
  localStorage.setItem(SAVE_KEY, JSON.stringify(
    { sheet, grid, round, myScore, myStuck, diceTypes, diceRots, dicePlaced, placedThisRound, activeDie }
  ));
}
function clearSave() { localStorage.removeItem(SAVE_KEY); }
function hasSave()   { return !!localStorage.getItem(SAVE_KEY); }

window.resumeGame = function() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    isSolo = true;
    myName = EL.nameInput.value.trim() || localStorage.getItem(NAME_KEY) || 'Player';
    sheetCfg = SHEETS[s.sheet];
    ({ grid, round, myScore, myStuck, diceTypes, diceRots, dicePlaced, activeDie } = s);
    placedThisRound = s.placedThisRound || [];
    EL.scoreDisplay.textContent = myScore;
    updateStuckUI();
    updateDicePanel();
    updateConfirmBtn();
    buildGrid();
    EL.playersMini.innerHTML = '';
    showScreen('game');
    return true;
  } catch(e) {
    console.warn('Failed to resume save:', e);
    clearSave();
    EL.resumeBanner.style.display = 'none';
    return false;
  }
};

window.discardSave = function() {
  clearSave();
  EL.resumeBanner.style.display = 'none';
};

// ── QR code ──

function showQR() {
  const url = encodeURIComponent(`${location.origin}${location.pathname}?join=${roomCode}`);
  const img = document.getElementById('qr-img');
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${url}&bgcolor=16213e&color=53d8fb&margin=10`;
  img.style.display = 'block';
  document.getElementById('qr-hint').style.display = 'block';
}

window.copyCode = function() {
  navigator.clipboard?.writeText(roomCode).then(() => showToast('Code copied!'));
};

// ── Utilities ──

function randomCode() {
  return Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
}

function showToast(msg) {
  EL.toast.textContent = msg;
  EL.toast.classList.add('show');
  setTimeout(() => EL.toast.classList.remove('show'), 2500);
}

// ── Init ──

// Grid click delegation — one listener instead of per-cell listeners rebuilt on every render
EL.gridSvg.addEventListener('click', e => {
  const cell = e.target.closest('.cell-click');
  if (cell) { cellClicked(+cell.dataset.r, +cell.dataset.c); return; }
  const undo = e.target.closest('[data-undo]');
  if (undo) { e.stopPropagation(); undoPlace(+undo.dataset.undo); }
});

document.querySelectorAll('.sheet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sheet-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedSheet = btn.dataset.sheet;
  });
});

const savedName = localStorage.getItem(NAME_KEY);
if (savedName) EL.nameInput.value = savedName;
EL.nameInput.addEventListener('input', () => localStorage.setItem(NAME_KEY, EL.nameInput.value.trim()));

const joinParam = new URLSearchParams(location.search).get('join');
if (joinParam) {
  EL.joinCodeInput.value = joinParam.toUpperCase();
  setTimeout(() => EL.joinCodeInput.scrollIntoView({ behavior:'smooth', block:'center' }), 300);
}

if (hasSave()) EL.resumeBanner.style.display = 'flex';

window.addEventListener('resize', () => { if (sheetCfg) buildGrid(); });

// Disable pinch-zoom on iOS (user-scalable=no is ignored in Safari)
document.addEventListener('gesturestart',  e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// Live hints preference (updates showHints immediately for current game)
EL.hintsToggle.addEventListener('change', e => {
  showHints = e.target.checked;
  if (sheetCfg) buildGrid();
});

if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('sw.js').catch(console.warn);
