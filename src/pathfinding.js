const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function key(x, y, dir) {
  return `${x},${y},${dir}`;
}

export function findRoadPath(start, end, isBlocked, bounds) {
  if (start.x === end.x && start.y === end.y) return [start];

  const randomDirOrder = DIRS.map((v, i) => ({ v, i })).sort(() => Math.random() - 0.5);
  const queue = [{ x: start.x, y: start.y, dist: 0, turns: 0, dir: -1 }];
  const best = new Map([[key(start.x, start.y, -1), { dist: 0, turns: 0, prev: null }]]);

  let foundState = null;
  while (queue.length > 0) {
    queue.sort((a, b) => (a.dist - b.dist) || (a.turns - b.turns) || (Math.random() - 0.5));
    const current = queue.shift();

    if (current.x === end.x && current.y === end.y) {
      foundState = current;
      break;
    }

    for (const { v, i } of randomDirOrder) {
      const nx = current.x + v[0];
      const ny = current.y + v[1];
      if (nx < 0 || ny < 0 || nx >= bounds.w || ny >= bounds.h) continue;
      if (isBlocked(nx, ny) && !(nx === end.x && ny === end.y)) continue;

      const nd = current.dist + 1;
      const nt = current.dir === -1 || current.dir === i ? current.turns : current.turns + 1;
      const k = key(nx, ny, i);
      const prevBest = best.get(k);
      if (!prevBest || nd < prevBest.dist || (nd === prevBest.dist && nt < prevBest.turns)) {
        best.set(k, { dist: nd, turns: nt, prev: { x: current.x, y: current.y, dir: current.dir } });
        queue.push({ x: nx, y: ny, dist: nd, turns: nt, dir: i });
      }
    }
  }

  if (!foundState) return [];

  const path = [];
  let cursor = foundState;
  while (cursor) {
    path.push({ x: cursor.x, y: cursor.y });
    const entry = best.get(key(cursor.x, cursor.y, cursor.dir));
    cursor = entry?.prev || null;
  }

  return path.reverse();
}

export function reachableRoadRange(originCells, roads, maxRange) {
  const result = new Set();
  const queue = [];

  for (const c of originCells) {
    queue.push({ ...c, d: 0 });
    result.add(`${c.x},${c.y}`);
  }

  while (queue.length) {
    const cur = queue.shift();
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const road = roads.get(`${nx},${ny}`);
      if (!road) continue;
      const step = road.roadType === 1 ? 2 : 1;
      const nd = cur.d + step;
      if (nd > maxRange) continue;
      const k = `${nx},${ny}`;
      if (result.has(k)) continue;
      result.add(k);
      queue.push({ x: nx, y: ny, d: nd });
    }
  }

  return result;
}
