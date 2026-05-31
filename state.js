const state = {
  // Identity
  myId:   'p_' + Math.random().toString(36).slice(2,8),
  myName: '',

  // Room / session
  roomCode:      '',
  isHost:        false,
  isSolo:        false,
  roomRef:       null,
  roomListener:  null,
  selectedSheet: 'front',

  // Game board
  sheetCfg:        null,
  grid:            [],
  diceTypes:       [null, null],
  diceRots:        [0, 0],
  dicePlaced:      [false, false],
  placedThisRound: [],
  activeDie:       0,

  // Scores / status
  myScore:         0,
  myStuck:         false,
  round:           0,
  _pendingResults: null,
  showHints:       true,

  // Multiplayer bookkeeping
  lastGameId:   -1,
  lastRound:    -1,
  lastRoomData: null,
  lastPlayers:  null,
};

export default state;
