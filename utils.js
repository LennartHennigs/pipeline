import { T } from './i18n.js';
import { EL, SCREENS, SCREEN_EL } from './dom.js';
import state from './state.js';

export function showToast(msg) {
  EL.toast.textContent = msg;
  EL.toast.style.cursor = '';
  EL.toast.onclick = null;
  EL.toast.classList.add('show');
  setTimeout(() => EL.toast.classList.remove('show'), 2500);
}

export function showScreen(id) {
  SCREENS.forEach(s => s.classList.remove('active'));
  SCREEN_EL[id].classList.add('active');
}

export function randomCode() {
  return Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
}

export function returnToLobby() {
  state.isSolo   = false;
  state.sheetCfg = null;
  showScreen('lobby');
}
