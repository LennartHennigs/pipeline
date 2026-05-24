# Pipeline — Claude Context

Vanilla-JS PWA implementation of the **Pipeline** board game by Reiner Knizia.
No build tools, no framework — just `index.html`, `app.js`, `style.css`, `sw.js`.
Deployed to GitHub Pages via `.github/workflows/deploy.yml` which injects Firebase secrets.

## Architecture

| File | Role |
|------|------|
| `app.js` | All game logic, Firebase sync, SVG rendering (~800 lines) |
| `index.html` | Static shell — 4 screens: lobby, waiting, game, results |
| `style.css` | CSS custom properties, dark theme, mobile-first |
| `sw.js` | Service-worker cache (bump version on deploy) |

## Key Game Rules

- **Placement**: adjacency only — a piece can go in any empty cell that neighbours an already-placed cell. Openings do **not** need to match for placement; they only matter for scoring.
- **Scoring**: each pipe opening that faces a numbered edge scores that edge's value. Bonus +10 if every edge-1 opening is connected.
- **Stuck**: a player is stuck when no empty cell adjacent to existing pieces remains (regardless of piece type/rotation).
- **Undo**: tap a green (this-round) pipe to undo and re-place it. Confirm button is disabled until both dice are placed.

## Code Patterns

### DOM cache
All elements cached at startup in `EL` (single-element refs) and `DIE_EL` (array of `{card, svg}` for each die). Never call `getElementById` at runtime.

### Rendering
`buildGrid()` rebuilds the entire SVG innerHTML on every change (no virtual DOM). Called on: cell click, undo, die tap, resize, round start.

`pipePath(type, rot, color)` — returns SVG fragment for one pipe piece. Uses `PIPE_PTS` and `getOpenings()`. `NEIGHBORS = Object.values(DIR_RC)` is the hoisted direction-delta array for adjacency checks.

### Placement validation
```js
function isValidPlacementOnGrid(g, r, c) {
  // adjacency only — no opening match needed
  for (const [dr, dc] of NEIGHBORS) { ... }
}
```
`canPlayerMove(g)` — checks if two pieces can still be placed (clones row arrays, marks first cell with a truthy sentinel, checks a second adjacent cell exists).

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

### Constants worth knowing
- `DIE1` / `DIE2` — the six faces of each die (pipe types)
- `SHEETS` — `front` (5×5, 12 rounds) and `back` (6×5, 14 rounds), includes `prePlaced` corners and edge arrays
- `SOLO_RATINGS` — score → label table
- `SAVE_KEY` / `NAME_KEY` — localStorage keys

## What NOT to change
- Placement validation is **adjacency-only** by design (not opening-match). Don't re-add opening checks.
- `canPlayerMove` uses a plain truthy object as a cell sentinel — it never calls `getOpenings` on it, so the type string doesn't matter.
- iOS zoom is suppressed via `gesturestart`/`gesturechange` events (not `user-scalable=no`, which Safari ignores).
