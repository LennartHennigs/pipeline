export const DIE_EL = [0,1].map(i => ({
  card: document.getElementById(`die${i}`),
  svg:  document.getElementById(`die${i}-svg`),
}));

export const EL = {
  stuckBanner:   document.getElementById('stuck-banner'),
  dicePanel:     document.getElementById('dice-panel'),
  confirmBtn:    document.getElementById('confirm-btn'),
  scoreDisplay:  document.getElementById('score-display'),
  gridSvg:       document.getElementById('grid-svg'),
  toast:         document.getElementById('toast'),
  resumeBanner:  document.getElementById('resume-banner'),
  playersMini:   document.getElementById('players-mini'),
  nameInput:     document.getElementById('player-name'),
  joinCodeInput: document.getElementById('join-code'),
  hintsToggle:   document.getElementById('hints-toggle'),
  resultsFooter: document.getElementById('results-footer'),
  displayCode:   document.getElementById('display-code'),
  startBtn:      document.getElementById('start-btn'),
  playerCount:   document.getElementById('player-count'),
  waitingList:   document.getElementById('waiting-players'),
  resultsList:   document.getElementById('results-list'),
  soloRatingBox: document.getElementById('solo-rating-box'),
  soloRatingText:document.getElementById('solo-rating-text'),
  qrImg:         document.getElementById('qr-img'),
  qrHint:        document.getElementById('qr-hint'),
  cameraOverlay: document.getElementById('camera-overlay'),
  cameraVideo:   document.getElementById('camera-video'),
  scanBtn:       document.getElementById('scan-btn'),
  buildVersion:  document.getElementById('build-version'),
};

export const SCREENS    = document.querySelectorAll('.screen');
export const SCREEN_EL  = Object.fromEntries([...SCREENS].map(s => [s.id, s]));
