import { buildingGroups, byId, statKeys } from './data.js';
import { findRoadPath, reachableRoadRange } from './pathfinding.js';

const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const sidebar = document.getElementById('sidebar');
const statsEl = document.getElementById('stats');
const infoCard = document.getElementById('infoCard');
const importInput = document.getElementById('importInput');

const GRID_W = 140;
const GRID_H = 140;
const state = {
  tool: 'place',
  selectedId: 'road-stone',
  hoverCell: null,
  startRoad: null,
  roadPreview: [],
  roadCells: new Map(),
  buildings: [],
  buildingCells: new Set(),
  camera: { x: 0, y: 0, zoom: 1.1 },
  draggingPan: false,
  dragSelection: null,
  clipboard: null,
  rotation: 0,
  selectedBuildingId: null,
  filters: { public: '', production: '' },
};

const STORAGE_KEY = 'anno117-city-planner-state-v2';

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(600, Math.round(rect.width));
  const height = Math.max(400, Math.round(rect.height));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  if (state.camera.x === 0 && state.camera.y === 0) {
    state.camera.x = canvas.width / 2;
    state.camera.y = canvas.height / 2;
  }
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function cellKey(x, y) { return `${x},${y}`; }
function screenToWorld(sx, sy) {
  const size = 24 * state.camera.zoom;
  const wx = Math.floor((sx - state.camera.x) / size + GRID_W / 2);
  const wy = Math.floor((sy - state.camera.y) / size + GRID_H / 2);
  return { x: wx, y: wy };
}
function worldToScreen(wx, wy) {
  const size = 24 * state.camera.zoom;
  return {
    x: (wx - GRID_W / 2) * size + state.camera.x,
    y: (wy - GRID_H / 2) * size + state.camera.y,
    size,
  };
}

function getFootprint(item, anchor, rotation = state.rotation) {
  const [w, h] = item.size || [1, 1];
  const rotated = rotation % 2 ? [h, w] : [w, h];
  const cells = [];
  for (let y = 0; y < rotated[1]; y++) for (let x = 0; x < rotated[0]; x++) cells.push({ x: anchor.x + x, y: anchor.y + y });
  return { w: rotated[0], h: rotated[1], cells };
}

function inBounds(x, y) { return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H; }
function buildingAt(x, y) {
  return state.buildings.find((b) => b.cells.some((c) => c.x === x && c.y === y));
}
function isBuildingBlocked(x, y) { return state.buildingCells.has(cellKey(x, y)); }

function canPlaceBuilding(item, anchor) {
  const fp = getFootprint(item, anchor);
  return fp.cells.every((c) => inBounds(c.x, c.y) && !buildingAt(c.x, c.y) && !state.roadCells.has(cellKey(c.x, c.y)));
}

function placeAt(cell, item) {
  if (item.category === 'road') {
    state.roadCells.set(cellKey(cell.x, cell.y), { roadType: item.roadType, id: item.id });
    return;
  }
  if (!canPlaceBuilding(item, cell)) return;
  const fp = getFootprint(item, cell);
  state.buildings.push({
    placedId: `${item.id}-${Date.now()}-${Math.random()}`,
    itemId: item.id,
    x: cell.x,
    y: cell.y,
    rotation: state.rotation,
    cells: fp.cells,
  });
  fp.cells.forEach((c) => state.buildingCells.add(cellKey(c.x, c.y)));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    roads: [...state.roadCells.entries()],
    buildings: state.buildings,
    rotation: state.rotation,
    camera: state.camera,
  }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.roadCells = new Map(parsed.roads || []);
    state.buildings = parsed.buildings || [];
    state.buildingCells = new Set(state.buildings.flatMap((b) => b.cells.map((c) => cellKey(c.x, c.y))));
    state.rotation = parsed.rotation || 0;
    if (parsed.camera) state.camera = parsed.camera;
  } catch {
    // ignore malformed save data
  }
}

function deleteAt(cell) {
  state.roadCells.delete(cellKey(cell.x, cell.y));
  const removed = state.buildings.filter((b) => b.cells.some((c) => c.x === cell.x && c.y === cell.y));
  state.buildings = state.buildings.filter((b) => !b.cells.some((c) => c.x === cell.x && c.y === cell.y));
  removed.forEach((b) => b.cells.forEach((c) => state.buildingCells.delete(cellKey(c.x, c.y))));
  if (state.selectedBuildingId && !state.buildings.some((b) => b.placedId === state.selectedBuildingId)) {
    state.selectedBuildingId = null;
  }
}

function rangeAround(center, radius) {
  const arr = [];
  for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) if (x * x + y * y <= radius * radius) arr.push({ x: center.x + x, y: center.y + y });
  return arr;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = 24 * state.camera.zoom;

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const s = worldToScreen(x, y);
      if (s.x + size < 0 || s.y + size < 0 || s.x > canvas.width || s.y > canvas.height) continue;
      ctx.fillStyle = '#1a2332';
      ctx.fillRect(s.x, s.y, size, size);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeRect(s.x, s.y, size, size);
    }
  }

  for (const [k, road] of state.roadCells) {
    const [x, y] = k.split(',').map(Number);
    const s = worldToScreen(x, y);
    const item = byId.get(road.id);
    ctx.fillStyle = item.color;
    ctx.fillRect(s.x + 1, s.y + 1, size - 2, size - 2);
  }

  for (const b of state.buildings) {
    const item = byId.get(b.itemId);
    for (const c of b.cells) {
      const s = worldToScreen(c.x, c.y);
      ctx.fillStyle = item.category === 'residential' ? '#2f9e44' : item.category === 'public' ? '#1971c2' : '#5f3dc4';
      ctx.fillRect(s.x + 2, s.y + 2, size - 4, size - 4);
    }
    const anchor = worldToScreen(b.x, b.y);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(10, size / 2.8)}px sans-serif`;
    ctx.fillText(item.icon, anchor.x + 4, anchor.y + size * 0.72);
    if (b.placedId === state.selectedBuildingId) {
      ctx.strokeStyle = '#ffd43b';
      ctx.lineWidth = 2;
      for (const c of b.cells) {
        const cs = worldToScreen(c.x, c.y);
        ctx.strokeRect(cs.x + 1, cs.y + 1, size - 2, size - 2);
      }
    }
  }

  if (state.roadPreview.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const c of state.roadPreview) {
      const s = worldToScreen(c.x, c.y);
      ctx.fillRect(s.x + 3, s.y + 3, size - 6, size - 6);
    }
  }

  if (state.hoverCell && state.tool === 'place') {
    const item = byId.get(state.selectedId);
    if (item?.category !== 'road') {
      const fp = getFootprint(item, state.hoverCell);
      const valid = canPlaceBuilding(item, state.hoverCell);
      ctx.fillStyle = valid ? 'rgba(80,200,120,0.35)' : 'rgba(255,80,80,0.35)';
      for (const c of fp.cells) {
        const s = worldToScreen(c.x, c.y);
        ctx.fillRect(s.x + 2, s.y + 2, size - 4, size - 4);
      }

      if (item.radius > 0) {
        const center = { x: state.hoverCell.x + Math.floor(fp.w / 2), y: state.hoverCell.y + Math.floor(fp.h / 2) };
        ctx.fillStyle = 'rgba(133,153,255,0.16)';
        for (const c of rangeAround(center, item.radius)) {
          if (!inBounds(c.x, c.y)) continue;
          const s = worldToScreen(c.x, c.y);
          ctx.fillRect(s.x + 6, s.y + 6, size - 12, size - 12);
        }
      }

      if (item.category === 'public' || item.category === 'production') {
        const origins = fp.cells.filter((c) => {
          const n = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => state.roadCells.has(cellKey(c.x+dx,c.y+dy)));
          return n;
        });
        const reachable = reachableRoadRange(origins, state.roadCells, item.roadRange);
        ctx.fillStyle = 'rgba(255,212,59,0.2)';
        for (const k of reachable) {
          const [x, y] = k.split(',').map(Number);
          const s = worldToScreen(x, y);
          ctx.fillRect(s.x + 5, s.y + 5, size - 10, size - 10);
        }
      }
    }
  }

  if (state.selectedBuildingId) {
    const b = state.buildings.find((it) => it.placedId === state.selectedBuildingId);
    if (b) {
      const item = byId.get(b.itemId);
      const origins = b.cells.filter((c) => [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => state.roadCells.has(cellKey(c.x+dx,c.y+dy))));
      const reachable = reachableRoadRange(origins, state.roadCells, item.roadRange);
      ctx.fillStyle = 'rgba(255,212,59,0.2)';
      for (const k of reachable) {
        const [x, y] = k.split(',').map(Number);
        const s = worldToScreen(x, y);
        ctx.fillRect(s.x + 5, s.y + 5, size - 10, size - 10);
      }
      if (item.radius > 0) {
        const fp = getFootprint(item, { x: b.x, y: b.y }, b.rotation);
        const center = { x: b.x + Math.floor(fp.w / 2), y: b.y + Math.floor(fp.h / 2) };
        ctx.fillStyle = 'rgba(133,153,255,0.14)';
        for (const c of rangeAround(center, item.radius)) {
          if (!inBounds(c.x, c.y)) continue;
          const s = worldToScreen(c.x, c.y);
          ctx.fillRect(s.x + 6, s.y + 6, size - 12, size - 12);
        }
      }
    }
  }

  if (state.dragSelection) {
    const a = worldToScreen(state.dragSelection.start.x, state.dragSelection.start.y);
    const b = worldToScreen(state.dragSelection.end.x, state.dragSelection.end.y);
    ctx.strokeStyle = '#4dabf7';
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x) + size, Math.abs(a.y - b.y) + size);
    ctx.setLineDash([]);
  }
}

function updateSidebar() {
  const groupTpl = (title, key, list, filterable = false) => {
    const filter = state.filters[key] || '';
    const filtered = filterable ? list.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase())) : list;
    return `<section><h3>${title}</h3>${filterable ? `<input data-filter="${key}" placeholder="Filtern" value="${filter}" />` : ''}<div class="items">${filtered.map((item) => `<button class="item ${state.selectedId === item.id ? 'active' : ''}" data-select="${item.id}"><span>${item.icon}</span><small>${item.name}</small></button>`).join('')}</div></section>`;
  };

  sidebar.innerHTML = [
    groupTpl('Straßen', 'roads', buildingGroups.roads),
    groupTpl('Wohngebäude', 'residential', buildingGroups.residential),
    groupTpl('Öffentliche Gebäude', 'public', buildingGroups.public, true),
    groupTpl('Produktionsgebäude', 'production', buildingGroups.production, true),
  ].join('');
}

function updateStats() {
  const totals = { gold: 0, population: 0, religion: 0, prestige: 0, satisfaction: 0, fire: 0 };
  const counts = new Map();
  for (const b of state.buildings) {
    const item = byId.get(b.itemId);
    Object.entries(item.effects || {}).forEach(([k, v]) => { totals[k] += v; });
    counts.set(item.name, (counts.get(item.name) || 0) + 1);
  }

  statsEl.innerHTML = `
    <div class="stat-row">${statKeys.map(([k, label]) => `<span><b>${label}:</b> ${totals[k]}</span>`).join('')}</div>
    <div class="stat-row"><b>Gebäude:</b> ${[...counts.entries()].slice(0, 8).map(([n, c]) => `${n} (${c})`).join(' · ')}${counts.size > 8 ? ' …' : ''}</div>
    <div class="stat-row"><b>Einwohner gesamt:</b> ${totals.population}</div>
  `;
}

function updateInfoCard() {
  if (!state.selectedBuildingId) {
    infoCard.classList.add('hidden');
    return;
  }
  const building = state.buildings.find((b) => b.placedId === state.selectedBuildingId);
  if (!building) return;
  const item = byId.get(building.itemId);
  infoCard.classList.remove('hidden');
  infoCard.innerHTML = `
    <button id="unselectBtn">←</button>
    <h4>${item.icon} ${item.name}</h4>
    <p>Typ: ${item.category}</p>
    <p>Größe: ${getFootprint(item, { x: 0, y: 0 }, building.rotation).w}x${getFootprint(item, { x: 0, y: 0 }, building.rotation).h}</p>
    <p>Straßenreichweite: ${item.roadRange}</p>
    <p>Wirkungsradius: ${item.radius || 0}</p>
    <p>Effekte: ${Object.entries(item.effects || {}).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ')}</p>
  `;
  document.getElementById('unselectBtn').onclick = () => { state.selectedBuildingId = null; updateInfoCard(); draw(); };
}

function applyArea(start, end, fn) {
  const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) fn({ x, y });
}

canvas.addEventListener('mousemove', (e) => {
  const point = getCanvasPoint(e);
  const cell = screenToWorld(point.x, point.y);
  state.hoverCell = cell;

  if (state.draggingPan) {
    state.camera.x += e.movementX;
    state.camera.y += e.movementY;
  }

  if (state.startRoad && byId.get(state.selectedId)?.category === 'road') {
    state.roadPreview = findRoadPath(state.startRoad, cell, (x, y) => isBuildingBlocked(x, y), { w: GRID_W, h: GRID_H });
  }

  if (state.dragSelection) state.dragSelection.end = cell;
  draw();
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) { state.draggingPan = true; return; }

  const point = getCanvasPoint(e);
  const cell = screenToWorld(point.x, point.y);
  const item = byId.get(state.selectedId);

  if (state.tool === 'copy' || state.tool === 'delete') {
    state.dragSelection = { start: cell, end: cell, mode: state.tool };
    return;
  }

  if (state.tool === 'place' && item?.category === 'road') {
    if (e.ctrlKey) {
      placeAt(cell, item);
    } else if (!state.startRoad) {
      state.startRoad = cell;
    } else {
      const path = findRoadPath(state.startRoad, cell, (x, y) => isBuildingBlocked(x, y), { w: GRID_W, h: GRID_H });
      path.forEach((p) => placeAt(p, item));
      state.startRoad = null;
      state.roadPreview = [];
    }
    updateStats();
    saveState();
    draw();
    return;
  }

  if (state.tool === 'place' && item && item.category !== 'road') {
    const existing = buildingAt(cell.x, cell.y);
    if (existing) {
      state.selectedBuildingId = existing.placedId;
      updateInfoCard();
      draw();
      return;
    }
    placeAt(cell, item);
    updateStats();
    saveState();
    draw();
    return;
  }

  const hitBuilding = buildingAt(cell.x, cell.y);
  state.selectedBuildingId = hitBuilding?.placedId || null;
  updateInfoCard();
  draw();
});

canvas.addEventListener('mouseup', () => {
  state.draggingPan = false;
  if (!state.dragSelection) return;

  const { start, end, mode } = state.dragSelection;
  if (mode === 'delete') {
    applyArea(start, end, deleteAt);
    updateStats();
    saveState();
  }

  if (mode === 'copy') {
    const width = Math.abs(end.x - start.x) + 1;
    const height = Math.abs(end.y - start.y) + 1;
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);

    if (width === 1 && height === 1) {
      const hit = buildingAt(minX, minY);
      if (hit) {
        state.selectedId = hit.itemId;
        state.tool = 'place';
      } else {
        const road = state.roadCells.get(cellKey(minX, minY));
        if (road) {
          state.selectedId = road.id;
          state.tool = 'place';
        }
      }
    } else {
      const roads = [];
      const buildings = [];
      for (const [k, v] of state.roadCells) {
        const [x, y] = k.split(',').map(Number);
        if (x >= minX && y >= minY && x < minX + width && y < minY + height) roads.push({ x: x - minX, y: y - minY, id: v.id });
      }
      for (const b of state.buildings) {
        if (b.cells.every((c) => c.x >= minX && c.y >= minY && c.x < minX + width && c.y < minY + height)) {
          buildings.push({ ...b, x: b.x - minX, y: b.y - minY });
        }
      }
      state.clipboard = { width, height, roads, buildings };
    }
  }

  state.dragSelection = null;
  updateSidebar();
  draw();
});

canvas.addEventListener('click', (e) => {
  if (state.tool !== 'place' || !state.clipboard || byId.get(state.selectedId)?.category === 'road') return;
  if (e.button !== 0) return;
  const point = getCanvasPoint(e);
  const base = screenToWorld(point.x, point.y);
  for (const r of state.clipboard.roads) placeAt({ x: base.x + r.x, y: base.y + r.y }, byId.get(r.id));
  for (const b of state.clipboard.buildings) {
    const item = byId.get(b.itemId);
    const prev = state.rotation;
    state.rotation = b.rotation;
    placeAt({ x: base.x + b.x, y: base.y + b.y }, item);
    state.rotation = prev;
  }
  updateStats();
  saveState();
  draw();
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  state.camera.zoom = Math.max(0.25, Math.min(2.8, state.camera.zoom - Math.sign(e.deltaY) * 0.08));
  draw();
});

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') {
    state.rotation = (state.rotation + 1) % 2;
    draw();
  }
});

document.querySelectorAll('[data-tool]').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    state.startRoad = null;
    state.roadPreview = [];
    draw();
  };
});

document.getElementById('rotateBtn').onclick = () => { state.rotation = (state.rotation + 1) % 2; draw(); };
document.getElementById('centerBtn').onclick = () => { state.camera.x = canvas.width / 2; state.camera.y = canvas.height / 2; draw(); };

document.getElementById('exportJsonBtn').onclick = () => {
  const payload = JSON.stringify({ roads: [...state.roadCells.entries()], buildings: state.buildings, rotation: state.rotation }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  a.download = 'anno117-plan.json';
  a.click();
};
document.getElementById('importJsonBtn').onclick = () => importInput.click();
importInput.onchange = async () => {
  const file = importInput.files[0];
  if (!file) return;
  const txt = await file.text();
  const json = JSON.parse(txt);
  state.roadCells = new Map(json.roads);
  state.buildings = json.buildings;
  state.buildingCells = new Set(state.buildings.flatMap((b) => b.cells.map((c) => cellKey(c.x, c.y))));
  state.rotation = json.rotation || 0;
  state.selectedBuildingId = null;
  updateStats();
  updateInfoCard();
  saveState();
  draw();
};

document.getElementById('exportImageBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'anno117-plan.png';
  a.click();
};

sidebar.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-select]');
  if (!btn) return;
  state.selectedId = btn.dataset.select;
  state.selectedBuildingId = null;
  updateSidebar();
  updateInfoCard();
  draw();
});

sidebar.addEventListener('input', (e) => {
  if (!e.target.dataset.filter) return;
  state.filters[e.target.dataset.filter] = e.target.value;
  updateSidebar();
});

loadState();
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); draw(); });
updateSidebar();
updateStats();
updateInfoCard();
draw();
