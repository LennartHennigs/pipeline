import { T } from './i18n.js';
import state from './state.js';
import { SHEETS, DIE1, DIE2 } from './constants.js';
import { EL } from './dom.js';
import { showToast } from './utils.js';
import { canPlayerMove, calcScore, isValidPlacementOnGrid } from './scoring.js';
import { buildGrid, updateDicePanel, updateConfirmBtn, updateStuckUI, showResults, resetGridSize } from './rendering.js';
import { saveGame, clearSave } from './persistence.js';

// Provided by multiplayer.js via setMultiplayerDb; no-op in solo
let _updateMyPlayer = () => Promise.resolve();

export function setMultiplayerDb(fn) {
  _updateMyPlayer = fn;
}

// ── Game initialisation ──

export function initLocalGame(sheet) {
  state.sheetCfg = SHEETS[sheet];
  resetGridSize(); // sheet may have changed (front/back have different dimensions)
  const { rows, cols } = state.sheetCfg;
  state.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const pp of state.sheetCfg.prePlaced)
    state.grid[pp.r][pp.c] = { type: pp.type, rot: pp.rot, prePlaced: true };
  state.myScore = 0;
  state.myStuck = false;
  state.round   = 0;
  state.lastRound = -1;
  state.diceTypes       = [null, null];
  state.diceRots        = [0, 0];
  state.dicePlaced      = [false, false];
  state.placedThisRound = [];
  state.activeDie       = 0;
  EL.scoreDisplay.textContent = 0;
  updateStuckUI();
}

// ── Dice ──

export function rollDice() {
  return {
    d1: DIE1[Math.floor(Math.random() * DIE1.length)],
    d2: DIE2[Math.floor(Math.random() * DIE2.length)],
  };
}

// ── Round lifecycle ──

export function startRound(d1, d2) {
  state.diceTypes       = [d1, d2];
  state.diceRots        = [0, 0];
  state.dicePlaced      = [false, false];
  state.placedThisRound = [];
  state.activeDie       = 0;
  state.myStuck         = false;

  EL.confirmBtn.textContent = T('confirm');
  updateStuckUI();
  updateConfirmBtn();

  EL.dicePanel.classList.remove('dice-flash');
  void EL.dicePanel.offsetWidth;
  EL.dicePanel.classList.add('dice-flash');

  updateDicePanel();
  buildGrid();

  if (!canPlayerMove(state.grid)) {
    state.myStuck = true;
    updateStuckUI();
    if (state.isSolo) {
      clearSave();
      state._pendingResults = [{ name: state.myName, score: state.myScore, stuck: true }];
      EL.confirmBtn.textContent   = T('seeResults');
      EL.confirmBtn.style.display = 'block';
    } else {
      _updateMyPlayer({ confirmed: true, score: state.myScore, stuck: true });
    }
    return;
  }

  if (state.isSolo) saveGame();
}

// ── Cell interaction ──

export function cellClicked(r, c) {
  if (state.myStuck) return;
  const { activeDie, dicePlaced, grid, diceTypes, diceRots } = state;
  if (dicePlaced[activeDie]) {
    const other = 1 - activeDie;
    if (!dicePlaced[other]) { state.activeDie = other; updateDicePanel(); buildGrid(); }
    return;
  }
  if (grid[r][c]) return;
  if (!isValidPlacementOnGrid(grid, r, c, diceTypes[activeDie], diceRots[activeDie])) {
    showToast(T('mustConnect'));
    return;
  }
  state.dicePlaced[activeDie] = true;
  state.grid[r][c] = { type: diceTypes[activeDie], rot: diceRots[activeDie] };
  state.placedThisRound.push({ r, c, dieIdx: activeDie });
  const other = 1 - activeDie;
  if (!dicePlaced[other]) state.activeDie = other;
  buildGrid();
  updateDicePanel();
  updateConfirmBtn();
  EL.scoreDisplay.textContent = calcScore();
}

export function undoPlace(idx) {
  const p = state.placedThisRound[idx];
  state.dicePlaced[p.dieIdx] = false;
  state.grid[p.r][p.c] = null;
  state.placedThisRound.splice(idx, 1);
  state.activeDie = p.dieIdx;
  updateDicePanel();
  buildGrid();
  updateConfirmBtn();
}

// ── Confirm placement ──

export async function confirmPlacement() {
  if (state._pendingResults) {
    showResults(state._pendingResults);
    state._pendingResults = null;
    return;
  }
  if (state.myStuck) return;

  const score = state.myScore;
  const stuck = !canPlayerMove(state.grid);

  if (state.isSolo) {
    state.myStuck = stuck;
    state.round++;
    const gameOver = stuck || state.round >= state.sheetCfg.maxRounds;
    if (gameOver) {
      clearSave();
      state._pendingResults = [{ name: state.myName, score, stuck }];
      EL.confirmBtn.textContent   = T('seeResults');
      EL.confirmBtn.style.display = 'block';
    } else {
      const { d1, d2 } = rollDice();
      startRound(d1, d2);
    }
    return;
  }

  await _updateMyPlayer({ confirmed: true, score, stuck });
  EL.confirmBtn.style.display = 'none';
}
