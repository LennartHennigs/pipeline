// ── Language detection & translations ──
// Detects German via navigator.language, falls back to English.

export const LANG = navigator.language.startsWith('de') ? 'de' : 'en';

const i18n = {
  en: {
    // lobby — resume banner
    gameInProgress: 'Game in Progress',
    unfinishedGame: 'You have an unfinished solo game. Continue where you left off?',
    continueGame: '▶ Continue Game',
    discardStart: '✕ Discard & Start Fresh',
    // lobby — name card
    yourName: 'Your Name',
    namePlaceholder: 'Enter your name',
    // lobby — new game card
    newGame: 'New Game',
    frontSheet: 'Front',    frontDetails: '5×5 · 12 rounds',
    backSheet: 'Back',      backDetails: '5×6 · 14 rounds',
    showHints: 'Show placement hints',
    createRoom: 'Create Room',
    soloGame: 'Solo Game',
    // lobby — join card
    orDivider: '— or —',
    joinGame: 'Join Game',
    roomCodePlaceholder: 'Room code (e.g. ABCD)',
    joinRoom: 'Join Room',
    stopCamera: '✕ Stop',
    // waiting room
    roomCodeLabel: 'Room Code',
    tapToCopy: 'Tap to copy · Share with friends',
    scanToJoin: 'Scan to join on another phone',
    players: 'Players',
    startGame: 'Start Game ▶',
    leave: '← Leave',
    // game screen
    leaveGame: 'Leave',
    stuckMessage: "🚫 No moves left — you're done! Others are still playing.",
    score: 'Score',
    confirm: 'Confirm',
    // results
    results: '🏆 Results',
    yourRating: 'Your Rating',
    // dynamic / toast messages
    firebaseError: 'Firebase not configured — try Solo mode',
    enterName: 'Enter your name first',
    mustConnect: '⚠️ Piece must connect to a neighbour',
    enterCode: 'Enter a 4-letter room code',
    roomNotFound: 'Room not found',
    gameStarted: 'Game already started',
    codeCopied: 'Code copied!',
    youBadge: 'You',
    finishedEarly: '(finished early)',
    leaveConfirm: 'Leave the game? Your progress will be lost.',
    playAgain: 'Play Again',
    playAgainRoom: 'Play Again (same room) →',
    leaveRoom: '← Leave Room',
    cameraUnsupported: 'Camera scanning not supported on this browser',
    newVersion: 'New version available — tap to reload',
  },

  de: {
    // lobby — resume banner
    gameInProgress: 'Spiel läuft',
    unfinishedGame: 'Du hast ein unfertiges Solo-Spiel. Weitermachen?',
    continueGame: '▶ Weiterspielen',
    discardStart: '✕ Verwerfen & neu starten',
    // lobby — name card
    yourName: 'Dein Name',
    namePlaceholder: 'Name eingeben',
    // lobby — new game card
    newGame: 'Neues Spiel',
    frontSheet: 'Vorderseite', frontDetails: '5×5 · 12 Runden',
    backSheet: 'Rückseite',    backDetails: '5×6 · 14 Runden',
    showHints: 'Platzierungshinweise',
    createRoom: 'Raum erstellen',
    soloGame: 'Solo-Spiel',
    // lobby — join card
    orDivider: '— oder —',
    joinGame: 'Spiel beitreten',
    roomCodePlaceholder: 'Raumcode (z.B. ABCD)',
    joinRoom: 'Beitreten',
    stopCamera: '✕ Stopp',
    // waiting room
    roomCodeLabel: 'Raumcode',
    tapToCopy: 'Tippen zum Kopieren · Teilen',
    scanToJoin: 'Zum Beitreten scannen',
    players: 'Spieler',
    startGame: 'Spiel starten ▶',
    leave: '← Verlassen',
    // game screen
    leaveGame: 'Verlassen',
    stuckMessage: '🚫 Keine Züge mehr — du bist fertig! Andere spielen noch.',
    score: 'Punkte',
    confirm: 'Bestätigen',
    // results
    results: '🏆 Ergebnis',
    yourRating: 'Deine Wertung',
    // dynamic / toast messages
    firebaseError: 'Firebase nicht konfiguriert — Solo-Modus nutzen',
    enterName: 'Bitte zuerst Namen eingeben',
    mustConnect: '⚠️ Teil muss an ein Nachbarfeld anschließen',
    enterCode: '4-stelligen Raumcode eingeben',
    roomNotFound: 'Raum nicht gefunden',
    gameStarted: 'Spiel bereits gestartet',
    codeCopied: 'Code kopiert!',
    youBadge: 'Du',
    finishedEarly: '(früh beendet)',
    leaveConfirm: 'Spiel verlassen? Fortschritt geht verloren.',
    playAgain: 'Nochmal spielen',
    playAgainRoom: 'Nochmal spielen (gleicher Raum) →',
    leaveRoom: '← Raum verlassen',
    cameraUnsupported: 'Kamera-Scannen nicht unterstützt',
    newVersion: 'Neue Version verfügbar — tippen zum Laden',
  },
};

export function T(key) {
  return (i18n[LANG] || i18n.en)[key] ?? key;
}

// Walk the DOM and apply translations to all data-i18n / data-i18n-attr elements.
// Call once at app startup.
export function applyTranslations() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key  = el.dataset.i18n;
    const attr = el.dataset.i18nAttr;
    if (attr === 'placeholder') el.placeholder = T(key);
    else el.textContent = T(key);
  });
}
