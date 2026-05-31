import state from './state.js';
import { SHEETS, SAVE_KEY } from './constants.js';

export function saveGame() {
  if (!state.isSolo || !state.sheetCfg) return;
  const { grid, round, myScore, myStuck, diceTypes, diceRots, dicePlaced, placedThisRound, activeDie } = state;
  const sheet = Object.keys(SHEETS).find(k => SHEETS[k] === state.sheetCfg);
  localStorage.setItem(SAVE_KEY, JSON.stringify(
    { sheet, grid, round, myScore, myStuck, diceTypes, diceRots, dicePlaced, placedThisRound, activeDie }
  ));
}

export function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}
