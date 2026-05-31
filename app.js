import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { T, LANG, applyTranslations } from './i18n.js';
import state from './state.js';
import { EL } from './dom.js';
import { hasSave } from './persistence.js';
import { calcScore } from './scoring.js';
import { buildGrid, updateDicePanel, resizeGrid } from './rendering.js';
import { cellClicked, undoPlace, confirmPlacement } from './round.js';
import { startSolo, playAgain, resumeGame, discardSave } from './solo.js';
import { NAME_KEY } from './constants.js';
import { initMultiplayer, createRoom, joinRoom, startGame, playAgainSamePlayers,
         leaveRoom, cancelGame, copyCode } from './multiplayer.js';
import { startCameraQR, stopCamera } from './camera.js';

const BUILD_DATE = '%%BUILD_DATE%%';

const FIREBASE_CONFIG = {
  apiKey:            "%%FIREBASE_API_KEY%%",
  authDomain:        "%%FIREBASE_AUTH_DOMAIN%%",
  databaseURL:       "%%FIREBASE_DATABASE_URL%%",
  projectId:         "%%FIREBASE_PROJECT_ID%%",
  storageBucket:     "%%FIREBASE_STORAGE_BUCKET%%",
  messagingSenderId: "%%FIREBASE_MESSAGING_SENDER_ID%%",
  appId:             "%%FIREBASE_APP_ID%%"
};

let firebaseReady = false;
try {
  const db = getDatabase(initializeApp(FIREBASE_CONFIG));
  initMultiplayer(db);
  firebaseReady = true;
} catch(e) { console.warn('Firebase unavailable — solo only', e); }

// ── Window bindings (HTML onclick compatibility) ──

window.dieCardClick = function(i) {
  if (state.dicePlaced[i]) return;
  if (state.activeDie !== i) {
    state.activeDie = i;
  } else {
    state.diceRots[i] = (state.diceRots[i] + 1) % 4;
    const placed = state.placedThisRound.find(p => p.dieIdx === i);
    if (placed) { state.grid[placed.r][placed.c].rot = state.diceRots[i]; EL.scoreDisplay.textContent = calcScore(); }
  }
  updateDicePanel();
  buildGrid();
};

window.confirmPlacement    = confirmPlacement;
window.startSolo           = startSolo;
window.createRoom          = () => createRoom(firebaseReady);
window.joinRoom            = () => joinRoom(firebaseReady);
window.startGame           = startGame;
window.playAgainSamePlayers = playAgainSamePlayers;
window.playAgain           = playAgain;
window.leaveRoom           = leaveRoom;
window.cancelGame          = cancelGame;
window.resumeGame          = resumeGame;
window.discardSave         = discardSave;
window.copyCode            = copyCode;
window.startCameraQR       = startCameraQR;
window.stopCamera          = stopCamera;

// ── Init ──

// Grid click delegation — one listener instead of per-cell listeners rebuilt on every render
EL.gridSvg.addEventListener('click', e => {
  const cell = e.target.closest('.cell-click');
  if (cell) { cellClicked(+cell.dataset.r, +cell.dataset.c); return; }
  const undo = e.target.closest('[data-undo]');
  if (undo) { e.stopPropagation(); undoPlace(+undo.dataset.undo); }
});

const sheetBtns = document.querySelectorAll('.sheet-btn');
sheetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sheetBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.selectedSheet = btn.dataset.sheet;
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

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => { if (state.sheetCfg) { resizeGrid(); buildGrid(); } }, 150);
});

// Disable pinch-zoom on iOS (user-scalable=no is ignored in Safari)
document.addEventListener('gesturestart',  e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// Live hints preference
EL.hintsToggle.addEventListener('change', e => {
  state.showHints = e.target.checked;
  if (state.sheetCfg) buildGrid();
});

applyTranslations();

// Build date display — falls back to document.lastModified in local dev
const _locales = { de: 'de-DE', en: 'en-US' };
EL.buildVersion.textContent = new Date(
  BUILD_DATE.startsWith('%%') ? document.lastModified : BUILD_DATE
).toLocaleString(_locales[LANG] ?? 'en-US', { dateStyle: 'short', timeStyle: 'short' });

if (!('BarcodeDetector' in window)) EL.scanBtn.style.display = 'none';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          // Persistent toast (intentionally bypasses showToast's auto-hide).
          EL.toast.textContent = T('newVersion');
          EL.toast.classList.add('show');
          EL.toast.style.cursor = 'pointer';
          EL.toast.onclick = () => location.reload();
        }
      });
    });
  }).catch(console.warn);
}
