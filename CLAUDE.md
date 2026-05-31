# Pipeline — Claude Context

Vanilla-JS PWA implementation of the **Pipeline** board game by Reiner Knizia.
No build tools, no framework — plain ES modules loaded via `<script type="module" src="app.js">`.
Deployed to GitHub Pages via `.github/workflows/deploy.yml` which injects Firebase secrets and `%%BUILD_DATE%%`.

## Architecture

| File | Role |
|------|------|
| `app.js` | Entry point: Firebase init, `window.*` bindings, event listeners, SW registration. All `%%PLACEHOLDER%%` CI targets live here. |
| `constants.js` | Pure constants: `DIE1`, `DIE2`, `BASE_OPENINGS`, `DIRS`, `DIR_INDEX`, `DIR_RC`, `PLAYER_COLORS`, `SHEETS`, `SOLO_RATINGS`, `SAVE_KEY`, `NAME_KEY`. No imports. |
| `state.js` | Single exported `state` object holding all shared mutable variables. No imports. |
| `dom.js` | `EL` object (22 element refs), `DIE_EL` array, `SCREENS` NodeList, `SCREEN_EL` map. No imports. |
| `utils.js` | `showToast()`, `showScreen()`, `randomCode()` |
| `persistence.js` | `saveGame()`, `clearSave()`, `hasSave()` — localStorage serialisation for solo saves |
| `scoring.js` | `getOpenings()`, `isValidPlacementOnGrid()`, `canPlayerMove()`, `edgeConnected()`, `scoreCell()`, `allOnesConnected()`, `calcScore()` |
| `rendering.js` | `pipePath()`, `makeDieSVG()`, `buildGrid()`, `updateDicePanel()`, `updateConfirmBtn()`, `updateStuckUI()`, `renderWaitingPlayers()`, `renderMiniPlayers()`, `showResults()`, `winsSpan()` |
| `round.js` | `initLocalGame()`, `rollDice()`, `startRound()`, `cellClicked()`, `undoPlace()`, `confirmPlacement()`, `setMultiplayerDb()` |
| `solo.js` | `startSolo()`, `playAgain()`, `resumeGame()`, `discardSave()` |
| `multiplayer.js` | `initMultiplayer()`, `createRoom()`, `joinRoom()`, `startGame()`, `playAgainSamePlayers()`, `leaveRoom()`, `cancelGame()`, `stopListeningRoom()`, `showQR()`, `copyCode()` |
| `camera.js` | `startCameraQR()`, `stopCamera()` |
| `i18n.js` | Language detection (DE/EN), translation table, `T()` helper, `applyTranslations()` |
| `index.html` | Static shell — 4 screens + camera overlay; text marked with `data-i18n` attrs |
| `style.css` | CSS custom properties, dark theme, mobile-first |
| `sw.js` | Service-worker cache `pipeline-v5` — stale-while-revalidate (bump version on deploy) |

## Key Game Rules

- **Placement**: fully bidirectional — both the new piece and every occupied neighbour must agree on each shared face: either both open toward each other, or both are closed. At least one matched connection required. Board edges are always fine (they score points).
- **Scoring**: each pipe opening that faces a numbered edge scores that edge's value. Bonus +10 if every edge-1 opening is connected.
- **Stuck**: a player is stuck when `canPlayerMove` returns false — no valid bidirectional placement exists for both dice. Checked at round start (in `startRound`) and at round end (in `confirmPlacement`).
- **Undo**: tap a green (this-round) pipe to undo and re-place it. Confirm button is disabled until both dice are placed.

## Code Patterns

### i18n
`LANG` is detected once at module load (`navigator.language.startsWith('de')`). `T(key)` looks up the current language, falling back to English. `applyTranslations()` walks `[data-i18n]` elements and sets `textContent` (or `placeholder` for `data-i18n-attr="placeholder"`). Called once at startup. Dynamic strings in JS use `T()` directly.

### DOM cache
All elements cached at startup in `EL` (single-element refs) and `DIE_EL` (array of `{card, svg}` for each die) in `dom.js`. Never call `getElementById` at runtime. Camera elements (`cameraOverlay`, `cameraVideo`, `scanBtn`) are in `EL` too.

### Rendering (`rendering.js`)
`buildGrid()` rebuilds the entire SVG innerHTML on every change (no virtual DOM). Called on: cell click, undo, die tap, resize, round start. CELL/HALF/PIPE/PIPE_PTS constants are local to `rendering.js`.

`pipePath(type, rot, color)` — returns SVG fragment for one pipe piece. Uses `PIPE_PTS` and `getOpenings()` from `scoring.js`.

### Placement validation (`scoring.js`)
`isValidPlacementOnGrid(g, r, c, type, rot)` — iterates all 4 DIRS; for each occupied neighbour, checks `weOpen` (new piece opens toward neighbour) and `theyOpen` (neighbour opens back). Both must agree: both open → connection; either alone → `return false`; both closed → fine. Returns `true` only if `hasConnection` is set (at least one matched pair).

`canPlayerMove(g)` — exhaustively tries all rot×cell combinations for die 1, places a `{ type, rot }` sentinel, then checks die 2 on the updated grid. Returns `true` if any (die1, die2) placement pair is valid. Called at round start (`startRound`) and round end (`confirmPlacement`). Reads `state.diceTypes`.

### Multiplayer sync
Firebase Realtime Database under `rooms/{code}`. The host writes dice and advances rounds; all clients listen with `onValue`. `gameId` counter detects "play again" restarts client-side.

State written per-player: `score`, `confirmed`, `stuck`. Host reads `allConfirmed` and calls `advanceRound`.

### Color conventions
| Context | Color |
|---------|-------|
| Pre-placed corners | `#666` |
| Prior-round pieces | `#888` |
| Placed this round (undoable) | `#4caf50` green |
| Active die glow | `#4caf50` green |
| Accent / 5-point edges | `#e94560` red |
| 3-point edges | `#ffd700` gold |

### Camera QR scanning
`window.startCameraQR` — opens rear camera via `getUserMedia`, runs `BarcodeDetector.detect()` in a `setTimeout(250ms)` loop, auto-fills `#join-code` when a `?join=` URL is found. The scan button is hidden at startup if `BarcodeDetector` is unavailable. `window.stopCamera` kills the stream and hides the overlay; `_cameraStream === null` is the canonical "not scanning" signal.

### Build date
`BUILD_DATE` constant holds `%%BUILD_DATE%%`, replaced by `deploy.yml` with a UTC ISO timestamp. Falls back to `document.lastModified` in local dev. Displayed as a tiny version stamp at the bottom of the lobby.

### Constants worth knowing
- `DIE1` / `DIE2` — the six faces of each die (pipe types)
- `SHEETS` — `front` (5×5, 12 rounds) and `back` (6×5, 14 rounds), includes `prePlaced` corners and edge arrays
- `SOLO_RATINGS` — score → label table (labels are in German by design)
- `SAVE_KEY` / `NAME_KEY` — localStorage keys

## What NOT to change
- Placement validation is **fully bidirectional** — iterate all 4 DIRS, not just the new piece's openings. The `!weOpen && theyOpen` case (neighbour's pipe into new piece's closed wall) is just as invalid as `weOpen && !theyOpen`. Do not revert to iterating only the new piece's openings.
- `canPlayerMove` stores `{ type, rot }` sentinels (not bare `{}`), so `getOpenings` works correctly when die 2 checks adjacency to die 1's placement.
- iOS zoom is suppressed via `gesturestart`/`gesturechange` events (not `user-scalable=no`, which Safari ignores).
- `showToast()` clears `onclick` and cursor on each call — the SW update notification intentionally sets them after calling it to make the toast persistent and clickable.
