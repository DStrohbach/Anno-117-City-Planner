const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function key(x, y, dir) {
  return `${x},${y},${dir}`;
}

class MinHeap {
  constructor(compare) {
    this.data = [];
    this.compare = compare;
  }

  push(item) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return null;
    const top = this.data[0];
    const end = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = end;
      this.bubbleDown(0);
    }
    return top;
  }

  get size() {
    return this.data.length;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.data[index], this.data[parent]) >= 0) break;
      [this.data[index], this.data[parent]] = [this.data[parent], this.data[index]];
      index = parent;
    }
  }

  bubbleDown(index) {
    const length = this.data.length;
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = index * 2 + 2;

      if (left < length && this.compare(this.data[left], this.data[smallest]) < 0) smallest = left;
      if (right < length && this.compare(this.data[right], this.data[smallest]) < 0) smallest = right;
      if (smallest === index) break;

      [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
      index = smallest;
    }
  }
}

export function findRoadPath(start, end, isBlocked, bounds) {
  if (start.x === end.x && start.y === end.y) return [start];

  const heap = new MinHeap((a, b) => (a.f - b.f) || (a.turns - b.turns) || (a.h - b.h));
  const best = new Map();
  const dirs = DIRS.map((v, i) => ({ v, i })).sort(() => Math.random() - 0.5);

  const h0 = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
  heap.push({ x: start.x, y: start.y, g: 0, h: h0, f: h0, turns: 0, dir: -1 });
  best.set(key(start.x, start.y, -1), { g: 0, turns: 0, prev: null });

  let found = null;
  while (heap.size > 0) {
    const current = heap.pop();
    if (current.x === end.x && current.y === end.y) {
      found = current;
      break;
    }

    for (const { v, i } of dirs) {
      const nx = current.x + v[0];
      const ny = current.y + v[1];
      if (nx < 0 || ny < 0 || nx >= bounds.w || ny >= bounds.h) continue;
      if (isBlocked(nx, ny) && !(nx === end.x && ny === end.y)) continue;

      const ng = current.g + 1;
      const nTurns = current.dir === -1 || current.dir === i ? current.turns : current.turns + 1;
      const nh = Math.abs(nx - end.x) + Math.abs(ny - end.y);
      const nf = ng + nh;
      const k = key(nx, ny, i);
      const prev = best.get(k);

      if (!prev || ng < prev.g || (ng === prev.g && nTurns < prev.turns)) {
        best.set(k, {
          g: ng,
          turns: nTurns,
          prev: { x: current.x, y: current.y, dir: current.dir },
        });
        heap.push({ x: nx, y: ny, g: ng, h: nh, f: nf, turns: nTurns, dir: i });
      }
    }
  }

  if (!found) return [];

  const path = [];
  let cursor = found;
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
