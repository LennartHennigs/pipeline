import { ref, set, get, update, onValue, remove }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { T } from './i18n.js';
import state from './state.js';
import { SHEETS } from './constants.js';
import { EL, SCREEN_EL } from './dom.js';
import { showToast, showScreen, randomCode, returnToLobby } from './utils.js';
import { initLocalGame, startRound, rollDice, setMultiplayerDb } from './round.js';
import { renderWaitingPlayers, renderMiniPlayers, showResults } from './rendering.js';

let _db = null;
let _myPlayer = null;

export function initMultiplayer(db) {
  _db = db;
  _myPlayer = updates => update(ref(_db, `rooms/${state.roomCode}/players/${state.myId}`), updates);
  setMultiplayerDb(_myPlayer);
}

function multiplayerSetup(firebaseReady) {
  if (!firebaseReady) { showToast(T('firebaseError')); return false; }
  state.myName = EL.nameInput.value.trim();
  if (!state.myName) { showToast(T('enterName')); return false; }
  state.isSolo = false;
  return true;
}

function openWaitingRoom(code, asHost) {
  state.roomCode = code;
  state.roomRef  = ref(_db, `rooms/${state.roomCode}`);
  EL.displayCode.textContent = code;
  EL.startBtn.style.display  = asHost ? 'block' : 'none';
  showScreen('waiting');
  showQR();
  listenRoom();
}

// ── Room creation / joining ──

export async function createRoom(firebaseReady) {
  if (!multiplayerSetup(firebaseReady)) return;
  state.isHost = true;
  const code   = randomCode();
  await set(ref(_db, `rooms/${code}`), {
    sheet: state.selectedSheet,
    round: 0,
    maxRounds: SHEETS[state.selectedSheet].maxRounds,
    phase: 'waiting',
    dice: { d1: null, d2: null },
    host: state.myId,
    players: { [state.myId]: { name: state.myName, score: 0, confirmed: false, stuck: false } }
  });
  openWaitingRoom(code, true);
}

export async function joinRoom(firebaseReady) {
  if (!multiplayerSetup(firebaseReady)) return;
  state.isHost = false;
  const code = EL.joinCodeInput.value.trim().toUpperCase();
  if (code.length !== 4) { showToast(T('enterCode')); return; }
  const snap = await get(ref(_db, `rooms/${code}`));
  if (!snap.exists()) { showToast(T('roomNotFound')); return; }
  if (snap.val().phase !== 'waiting') { showToast(T('gameStarted')); return; }
  await update(ref(_db, `rooms/${code}/players/${state.myId}`),
    { name: state.myName, score: 0, confirmed: false, stuck: false });
  openWaitingRoom(code, false);
}

// ── Firebase listener ──

function listenRoom() {
  stopListeningRoom();
  state.roomListener = onValue(state.roomRef, snap => {
    if (!snap.exists()) return;
    const data    = snap.val();
    const players = data.players || {};
    state.lastRoomData = data;
    state.lastPlayers  = players;

    if (data.phase === 'waiting') {
      renderWaitingPlayers(players);
    }

    if (data.phase === 'playing') {
      const gameId = data.gameId ?? 0;
      if (!SCREEN_EL.game.classList.contains('active')) {
        state.lastGameId  = gameId;
        state.showHints   = EL.hintsToggle.checked;
        state.myStuck     = false;
        initLocalGame(data.sheet);
        showScreen('game');
      }
      state.round = data.round;
      renderMiniPlayers(players, data.wins);

      if (data.dice?.d1 && data.dice?.d2 && state.round !== state.lastRound) {
        state.lastRound = state.round;
        startRound(data.dice.d1, data.dice.d2);
        if (state.myStuck) autoConfirm();
      }

      if (state.isHost) {
        const allConfirmed = Object.values(players).every(p => p.confirmed || p.stuck);
        if (allConfirmed && data.dice?.d1) advanceRound(data, players);
      }
    }

    if (data.phase === 'ended') {
      const wins   = data.wins || {};
      const sorted = Object.entries(players)
        .map(([id, p]) => ({ id, name: p.name, score: p.score, stuck: p.stuck, wins: wins[id] || 0 }))
        .sort((a, b) => b.score - a.score);
      showResults(sorted);
    }
  });
}

async function autoConfirm() {
  await _myPlayer({ confirmed: true, score: state.myScore, stuck: true });
}

async function advanceRound(data, players) {
  const nextRound = data.round + 1;
  const allStuck  = Object.values(players).every(p => p.stuck);
  if (nextRound >= data.maxRounds || allStuck) {
    await update(state.roomRef, { phase: 'ended' });
    return;
  }
  const updates = {};
  for (const pid of Object.keys(players))
    updates[`players/${pid}/confirmed`] = !!players[pid].stuck;
  const { d1, d2 } = rollDice();
  await update(state.roomRef, { ...updates, round: nextRound, 'dice/d1': d1, 'dice/d2': d2 });
}

// ── Host controls ──

export async function startGame() {
  const { d1, d2 } = rollDice();
  await update(state.roomRef, { phase: 'playing', gameId: 0, round: 0, 'dice/d1': d1, 'dice/d2': d2 });
}

export async function playAgainSamePlayers() {
  if (!state.isHost || !state.lastRoomData || !state.lastPlayers) return;
  const wins = { ...state.lastRoomData.wins };

  const [[winnerId] = []] = Object.entries(state.lastPlayers).sort((a, b) => b[1].score - a[1].score);
  if (winnerId) wins[winnerId] = (wins[winnerId] || 0) + 1;

  const updates = { wins, gameId: (state.lastRoomData.gameId || 0) + 1, phase: 'playing', round: 0 };
  for (const pid of Object.keys(state.lastPlayers)) {
    updates[`players/${pid}/score`]     = 0;
    updates[`players/${pid}/confirmed`] = false;
    updates[`players/${pid}/stuck`]     = false;
  }
  const { d1, d2 } = rollDice();
  updates['dice/d1'] = d1;
  updates['dice/d2'] = d2;
  await update(state.roomRef, updates);
}

// ── Room exit ──

export function leaveRoom() {
  stopListeningRoom();
  if (state.roomRef && state.isHost) remove(state.roomRef);
  returnToLobby();
}

export function cancelGame() {
  if (!confirm(T('leaveConfirm'))) return;
  stopListeningRoom();
  if (!state.isSolo && state.roomRef) {
    state.isHost
      ? remove(state.roomRef)
      : remove(ref(_db, `rooms/${state.roomCode}/players/${state.myId}`));
  }
  returnToLobby();
}

export function stopListeningRoom() {
  if (state.roomListener) { state.roomListener(); state.roomListener = null; }
}

// ── QR code ──

export function showQR() {
  const url = encodeURIComponent(`${location.origin}${location.pathname}?join=${state.roomCode}`);
  EL.qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${url}&bgcolor=16213e&color=53d8fb&margin=10`;
  EL.qrImg.style.display  = 'block';
  EL.qrHint.style.display = 'block';
}

export function copyCode() {
  navigator.clipboard?.writeText(state.roomCode).then(() => showToast(T('codeCopied')));
}
