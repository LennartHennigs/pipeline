import state from './state.js';
import { BASE_OPENINGS, DIRS, DIR_INDEX, DIR_RC } from './constants.js';

const _openingsCache = Object.create(null);

export function getOpenings(type, rot) {
  const key = `${type}:${rot}`;
  if (key in _openingsCache) return _openingsCache[key];
  const base = BASE_OPENINGS[type] || [];
  const result = new Set(base.map(d => DIRS[(DIR_INDEX[d] + rot) % 4]));
  _openingsCache[key] = result;
  return result;
}

// ── Placement validation ──

export function isValidPlacementOnGrid(g, r, c, type, rot) {
  const rows = g.length, cols = g[0].length;
  const newOpenings = getOpenings(type, rot);
  let hasConnection = false;

  for (const dir of DIRS) {
    const [dr, dc] = DIR_RC[dir];
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
    const nb = g[nr][nc];
    if (!nb) continue;

    const opp      = DIRS[(DIR_INDEX[dir] + 2) % 4];
    const weOpen   = newOpenings.has(dir);
    const theyOpen = getOpenings(nb.type, nb.rot).has(opp);

    if ( weOpen &&  theyOpen) { hasConnection = true; continue; }
    if ( weOpen && !theyOpen) return false;
    if (!weOpen &&  theyOpen) return false;
  }

  return hasConnection;
}

export function canPlayerMove(g) {
  const rows = g.length, cols = g[0].length;
  const [t1, t2] = state.diceTypes;
  // Try both orderings — placement order can matter on a dense board
  return _tryOrder(g, rows, cols, t1, t2) || (t1 !== t2 && _tryOrder(g, rows, cols, t2, t1));
}

function _tryOrder(g, rows, cols, ta, tb) {
  for (let rotA = 0; rotA < 4; rotA++)
    for (let rA = 0; rA < rows; rA++)
      for (let cA = 0; cA < cols; cA++) {
        if (g[rA][cA] || !isValidPlacementOnGrid(g, rA, cA, ta, rotA)) continue;
        g[rA][cA] = { type: ta, rot: rotA };
        let found = false;
        outer:
        for (let rotB = 0; rotB < 4; rotB++)
          for (let rB = 0; rB < rows; rB++)
            for (let cB = 0; cB < cols; cB++)
              if (!g[rB][cB] && isValidPlacementOnGrid(g, rB, cB, tb, rotB)) { found = true; break outer; }
        g[rA][cA] = null;
        if (found) return true;
      }
  return false;
}

// ── Scoring ──

export function edgeConnected(cell, dir) {
  return cell && getOpenings(cell.type, cell.rot).has(dir);
}

export function scoreCell(r, c, type, rot) {
  const { rows, cols, topEdge, bottomEdge, leftEdge, rightEdge } = state.sheetCfg;
  const openings = getOpenings(type, rot);
  let pts = 0;
  if (r === 0        && openings.has('N')) pts += topEdge[c];
  if (r === rows - 1 && openings.has('S')) pts += bottomEdge[c];
  if (c === 0        && openings.has('W')) pts += leftEdge[r];
  if (c === cols - 1 && openings.has('E')) pts += rightEdge[r];
  return pts;
}

export function allOnesConnected() {
  const { rows, cols, topEdge, bottomEdge, leftEdge, rightEdge } = state.sheetCfg;
  const { grid } = state;
  for (let c = 0; c < cols; c++) {
    if (topEdge[c]    === 1 && !edgeConnected(grid[0][c],      'N')) return false;
    if (bottomEdge[c] === 1 && !edgeConnected(grid[rows-1][c], 'S')) return false;
  }
  for (let r = 0; r < rows; r++) {
    if (leftEdge[r]  === 1 && !edgeConnected(grid[r][0],       'W')) return false;
    if (rightEdge[r] === 1 && !edgeConnected(grid[r][cols-1],  'E')) return false;
  }
  return true;
}

export function calcScore() {
  const { grid, sheetCfg } = state;
  let total = 0;
  for (let r = 0; r < sheetCfg.rows; r++)
    for (let c = 0; c < sheetCfg.cols; c++) {
      const cell = grid[r][c];
      if (cell && !cell.prePlaced) total += scoreCell(r, c, cell.type, cell.rot);
    }
  if (allOnesConnected()) total += 10;
  state.myScore = total;
  return total;
}
