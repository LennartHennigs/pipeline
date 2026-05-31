import { T } from './i18n.js';
import state from './state.js';
import { PLAYER_COLORS, SOLO_RATINGS } from './constants.js';
import { EL, DIE_EL } from './dom.js';
import { getOpenings, isValidPlacementOnGrid, edgeConnected } from './scoring.js';
import { showScreen } from './utils.js';

// ── SVG constants (local) ──

const CELL = 58, HALF = 29, PIPE = 10, G = 22;
const PIPE_PTS = { N:[HALF,0], E:[CELL,HALF], S:[HALF,CELL], W:[0,HALF] };

// ── Pipe SVG ──

export function pipePath(type, rot, color) {
  const segs = [];
  for (const dir of getOpenings(type, rot))
    segs.push(`<line x1="${HALF}" y1="${HALF}" x2="${PIPE_PTS[dir][0]}" y2="${PIPE_PTS[dir][1]}" stroke="${color}" stroke-width="${PIPE}" stroke-linecap="round"/>`);
  segs.push(`<circle cx="${HALF}" cy="${HALF}" r="${PIPE/2}" fill="${color}"/>`);
  return segs.join('');
}

export function makeDieSVG(type, rot, color) {
  if (!type) return '';
  return `<svg viewBox="0 0 ${CELL} ${CELL}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${pipePath(type, rot, color)}</svg>`;
}

// ── Grid ──

// Scale cache — only recomputed on resize or sheet change, not on every cell interaction
let _svgW = 0, _svgH = 0, _scale = 1;

export function resizeGrid() {
  if (!state.sheetCfg) return;
  const { rows, cols } = state.sheetCfg;
  _svgW = cols * CELL + G * 2;
  _svgH = rows * CELL + G * 2;
  const maxW = Math.min(window.innerWidth - 16, 360);
  const maxH = window.innerHeight - 280;
  _scale = Math.min(maxW / _svgW, maxH / _svgH, 1);
  EL.gridSvg.setAttribute('width',   _svgW * _scale);
  EL.gridSvg.setAttribute('height',  _svgH * _scale);
  EL.gridSvg.setAttribute('viewBox', `0 0 ${_svgW} ${_svgH}`);
}

export function resetGridSize() { _svgW = 0; }

export function buildGrid() {
  const { sheetCfg, grid, diceTypes, diceRots, dicePlaced, activeDie, placedThisRound, showHints } = state;
  if (!sheetCfg) return;
  const { rows, cols } = sheetCfg;
  if (_svgW === 0) resizeGrid();

  const edgeColor = (v, conn) =>
    v === 5 ? '#e94560' : v === 3 ? '#ffd700' : (conn ? '#aaa' : '#555');
  const edgeText = (x, y, v, conn) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${conn?15:13}" font-weight="${conn?900:700}" fill="${edgeColor(v,conn)}">${v}</text>`;

  const bothPlaced = dicePlaced[0] && dicePlaced[1];
  const curType = bothPlaced ? null : diceTypes[activeDie];
  const curRot  = bothPlaced ? 0   : diceRots[activeDie];

  let html = `<rect x="${G}" y="${G}" width="${cols*CELL}" height="${rows*CELL}" fill="#0f2a4a" rx="4"/>`;

  for (let r = 0; r <= rows; r++)
    html += `<line x1="${G}" y1="${G+r*CELL}" x2="${G+cols*CELL}" y2="${G+r*CELL}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>`;
  for (let c = 0; c <= cols; c++)
    html += `<line x1="${G+c*CELL}" y1="${G}" x2="${G+c*CELL}" y2="${G+rows*CELL}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>`;

  for (let c = 0; c < cols; c++) {
    const x = G + c*CELL + HALF;
    html += edgeText(x, G-8,            sheetCfg.topEdge[c],    edgeConnected(grid[0][c],      'N'));
    html += edgeText(x, G+rows*CELL+16, sheetCfg.bottomEdge[c], edgeConnected(grid[rows-1][c], 'S'));
  }
  for (let r = 0; r < rows; r++) {
    const y = G + r*CELL + HALF + 5;
    html += edgeText(G-8,           y, sheetCfg.leftEdge[r],  edgeConnected(grid[r][0],       'W'));
    html += edgeText(G+cols*CELL+8, y, sheetCfg.rightEdge[r], edgeConnected(grid[r][cols-1],  'E'));
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const cx = G + c*CELL, cy = G + r*CELL;
      if (cell) {
        html += `<g transform="translate(${cx},${cy})">${pipePath(cell.type, cell.rot, cell.prePlaced ? '#666' : '#888')}</g>`;
      } else {
        const valid = (showHints && curType) ? isValidPlacementOnGrid(grid, r, c, curType, curRot) : false;
        const clickable = showHints ? valid : (curType && !bothPlaced);
        html += (showHints && valid)
          ? `<rect x="${cx+1}" y="${cy+1}" width="${CELL-2}" height="${CELL-2}" fill="rgba(83,216,251,.07)" rx="2"/>`
          : `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" fill="rgba(0,0,0,.28)" rx="2"/>`;
        if (clickable)
          html += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" fill="transparent" rx="2" data-r="${r}" data-c="${c}" class="cell-click" style="cursor:pointer"/>`;
      }
    }
  }

  placedThisRound.forEach((p, idx) => {
    const cx = G + p.c*CELL, cy = G + p.r*CELL;
    html += `<g transform="translate(${cx},${cy})" data-undo="${idx}" style="cursor:pointer">${pipePath(diceTypes[p.dieIdx], diceRots[p.dieIdx], '#4caf50')}</g>`;
  });

  EL.gridSvg.innerHTML = html;
}

// ── Dice panel ──

export function updateDicePanel() {
  const { activeDie, dicePlaced, diceTypes, diceRots } = state;
  for (let i = 0; i < 2; i++) {
    const { card, svg } = DIE_EL[i];
    const isActive = i === activeDie, isPlaced = dicePlaced[i];
    svg.innerHTML = isPlaced ? '' : makeDieSVG(diceTypes[i], diceRots[i], isActive ? '#4caf50' : '#888');
    card.className = 'die-card' + (isPlaced ? ' placed' : isActive ? ' selected' : '');
  }
}

// ── Confirm button ──

export function updateConfirmBtn() {
  EL.confirmBtn.style.display = (!state.myStuck && state.placedThisRound.length >= 2) ? 'block' : 'none';
}

// ── Stuck UI ──

export function updateStuckUI() {
  EL.stuckBanner.style.display = state.myStuck ? 'block' : 'none';
  EL.dicePanel.style.display   = state.myStuck ? 'none'  : 'block';
  if (state.myStuck) EL.confirmBtn.style.display = 'none';
}

// ── Waiting room player list ──

function avatarHTML(name, idx, cls) {
  return `<div class="${cls}" style="background:${PLAYER_COLORS[idx % PLAYER_COLORS.length]}">${name[0].toUpperCase()}</div>`;
}

export const winsSpan = (count, cls) => count > 0 ? `<span class="${cls}">${count}W</span>` : '';

export function renderWaitingPlayers(players) {
  const { myId } = state;
  const entries = Object.entries(players);
  EL.playerCount.textContent = entries.length;
  EL.waitingList.innerHTML = entries.map(([id, p], i) => `
    <div class="player-item">
      ${avatarHTML(p.name, i, 'player-avatar')}
      <div class="player-name">${p.name}</div>
      ${id === myId ? `<div class="player-badge">${T('youBadge')}</div>` : ''}
    </div>`).join('');
}

export function renderMiniPlayers(players, wins) {
  EL.playersMini.innerHTML = Object.entries(players).map(([id, p], i) => {
    const icon     = p.stuck ? '🚫' : p.confirmed ? '✓' : '…';
    const color    = p.confirmed ? '#4caf50' : p.stuck ? '#e94560' : '#888';
    const winBadge = winsSpan(wins?.[id] ?? 0, 'mini-wins');
    return `<div class="mini-player">
      ${avatarHTML(p.name, i, 'mini-avatar')}
      <span class="mini-check" style="color:${color}">${icon}</span>
      ${winBadge}
    </div>`;
  }).join('');
}

// ── Results screen ──

export function showResults(sorted) {
  showScreen('results');
  const medals = ['🥇','🥈','🥉'];
  EL.resultsList.innerHTML = sorted.map((p, i) => {
    const winsLabel = winsSpan(p.wins, 'result-wins');
    return `<div class="result-row">
      <div class="result-rank ${i===0?'gold':''}">${medals[i] ?? i+1}</div>
      <div class="result-name">${p.name}${p.stuck?` <span class="result-note">${T('finishedEarly')}</span>`:''}${winsLabel}</div>
      <div class="result-score">${p.score}</div>
    </div>`;
  }).join('');

  const footer = EL.resultsFooter;
  if (state.isSolo) {
    const rating = SOLO_RATINGS.find(r => sorted[0].score >= r.min && sorted[0].score <= r.max);
    EL.soloRatingText.textContent = rating?.label ?? '—';
    EL.soloRatingBox.style.display = 'block';
    footer.innerHTML = `<button class="btn-primary" onclick="playAgain()">${T('playAgain')}</button>`;
  } else {
    EL.soloRatingBox.style.display = 'none';
    footer.innerHTML = state.isHost
      ? `<button class="btn-success" onclick="playAgainSamePlayers()">${T('playAgainRoom')}</button>
         <button class="btn-ghost" onclick="leaveRoom()">${T('leaveRoom')}</button>`
      : `<button class="btn-ghost" onclick="leaveRoom()">${T('leaveRoom')}</button>`;
  }
}
