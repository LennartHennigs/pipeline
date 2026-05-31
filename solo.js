import state from './state.js';
import { SHEETS, NAME_KEY } from './constants.js';
import { EL } from './dom.js';
import { showScreen, returnToLobby } from './utils.js';
import { initLocalGame, startRound, rollDice } from './round.js';
import { buildGrid, updateDicePanel, updateConfirmBtn, updateStuckUI } from './rendering.js';
import { loadSave, clearSave } from './persistence.js';

export function startSolo() {
  state._pendingResults = null;
  state.myName  = EL.nameInput.value.trim() || 'Solo Player';
  state.isSolo  = true;
  state.showHints = EL.hintsToggle.checked;
  initLocalGame(state.selectedSheet);
  showScreen('game');
  EL.playersMini.innerHTML = '';
  const dice = rollDice();
  startRound(dice.d1, dice.d2);
}

export function playAgain() { returnToLobby(); }

export function resumeGame() {
  const s = loadSave();
  if (!s) return false;
  try {
    state.isSolo    = true;
    state.myName    = EL.nameInput.value.trim() || localStorage.getItem(NAME_KEY) || 'Player';
    state.sheetCfg  = SHEETS[s.sheet];
    state.grid            = s.grid;
    state.round           = s.round;
    state.myScore         = s.myScore;
    state.myStuck         = s.myStuck;
    state.diceTypes       = s.diceTypes;
    state.diceRots        = s.diceRots;
    state.dicePlaced      = s.dicePlaced;
    state.activeDie       = s.activeDie;
    state.placedThisRound = s.placedThisRound || [];
    EL.scoreDisplay.textContent = state.myScore;
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
}

export function discardSave() {
  clearSave();
  EL.resumeBanner.style.display = 'none';
  returnToLobby();
}
