export interface Rect { x: number; y: number; width: number; height: number }
export interface Pt { x: number; y: number }

const inflate = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, width: r.width + 2 * p, height: r.height + 2 * p });
const ptInRect = (p: Pt, r: Rect) => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

// ── Shared-corridor usage ─────────────────────────────────────────────────
// Routed paths stamp the cells they pass through; later edges pay a cost
// premium for re-using a cell, so parallel wires spread into separate lanes
// instead of rendering on top of each other.
const USAGE_Q = 7; // quantization (px) — half the gutter grid, so adjacent lanes differ
export const usageKey = (x: number, y: number) => `${Math.round(x / USAGE_Q)}:${Math.round(y / USAGE_Q)}`;

/** Stamp a polyline's cells into `usage`. Endpoint stubs (within `skip` px of
 *  either end) stay unstamped — fan-in at a shared handle is intentional. */
export function markUsage(pts: Pt[], usage: Set<string>, skip = 12): void {
  if (pts.length < 2) return;
  const first = pts[0], last = pts[pts.length - 1];
  const nearEnd = (x: number, y: number) =>
    (Math.abs(x - first.x) + Math.abs(y - first.y)) < skip || (Math.abs(x - last.x) + Math.abs(y - last.y)) < skip;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const steps = Math.max(1, Math.ceil((Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / USAGE_Q));
    for (let s = 0; s <= steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps, y = a.y + ((b.y - a.y) * s) / steps;
      if (!nearEnd(x, y)) usage.add(usageKey(x, y));
    }
  }
}

function segUsed(a: Pt, b: Pt, usage: Set<string>): boolean {
  const steps = Math.max(1, Math.ceil((Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / USAGE_Q));
  for (let s = 0; s <= steps; s++) {
    if (usage.has(usageKey(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps))) return true;
  }
  return false;
}

// Does axis-aligned segment a-b cross rect interior?
function segHits(a: Pt, b: Pt, r: Rect): boolean {
  const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x), y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
  return x1 < r.x + r.width && x2 > r.x && y1 < r.y + r.height && y2 > r.y;
}
const clear = (a: Pt, b: Pt, rects: Rect[]) => rects.every((r) => !segHits(a, b, r));

export function routeOrthogonal(
  from: Pt,
  to: Pt,
  obstacles: Rect[],
  opts: { padding?: number; grid?: number; sourceGap?: number; targetGap?: number; usage?: Set<string> } = {},
): Pt[] {
  const pad = opts.padding ?? 12;
  const grid = Math.max(4, opts.grid ?? 16);
  const rects = obstacles.map((r) => inflate(r, pad));
  const usage = opts.usage;

  // Spatial hash so A* blocked() checks query a local bucket instead of
  // every obstacle — the difference between O(cells) and O(cells × rects)
  // on boards with hundreds of boxes.
  const CELL = 160;
  const buckets = new Map<string, Rect[]>();
  for (const r of rects) {
    for (let cx = Math.floor(r.x / CELL); cx <= Math.floor((r.x + r.width) / CELL); cx++) {
      for (let cy = Math.floor(r.y / CELL); cy <= Math.floor((r.y + r.height) / CELL); cy++) {
        const k = `${cx}:${cy}`;
        const arr = buckets.get(k);
        if (arr) arr.push(r); else buckets.set(k, [r]);
      }
    }
  }
  const nearRects = (x: number, y: number): Rect[] => buckets.get(`${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`) ?? [];

  // Fast path: two-bend L routes (HV and VH). Use whichever is clear of
  // obstacles AND of already-routed wires (else fall through to A*, which
  // pays a premium per shared cell and finds a parallel lane).
  for (const mid of [{ x: to.x, y: from.y }, { x: from.x, y: to.y }]) {
    if (clear(from, mid, rects) && clear(mid, to, rects)
      && !(usage && (segUsed(from, mid, usage) || segUsed(mid, to, usage)))) {
      return applyEndpointGaps(simplify([from, mid, to]), opts.sourceGap ?? 0, opts.targetGap ?? 0);
    }
  }

  // A* on a uniform grid spanning the endpoints + obstacles (with margin).
  const xs = [from.x, to.x, ...rects.flatMap((r) => [r.x, r.x + r.width])];
  const ys = [from.y, to.y, ...rects.flatMap((r) => [r.y, r.y + r.height])];
  const margin = grid * 3;
  const minX = Math.min(...xs) - margin, maxX = Math.max(...xs) + margin;
  const minY = Math.min(...ys) - margin, maxY = Math.max(...ys) + margin;
  const cols = Math.ceil((maxX - minX) / grid) + 1;
  const rows = Math.ceil((maxY - minY) / grid) + 1;
  const gx = (c: number) => minX + c * grid, gy = (r: number) => minY + r * grid;
  const snapC = (x: number) => Math.round((x - minX) / grid), snapR = (y: number) => Math.round((y - minY) / grid);

  const blocked = (c: number, r: number) => {
    const x = gx(c), y = gy(r);
    const near = nearRects(x, y);
    for (let i = 0; i < near.length; i++) if (ptInRect({ x, y }, near[i])) return true;
    return false;
  };
  const start = { c: snapC(from.x), r: snapR(from.y) }, goal = { c: snapC(to.x), r: snapR(to.y) };
  // State key encodes (col, row, dir) so turn-penalty A* is correct
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  // 5 directions: 0-3 = DIRS above, 4 = "no direction yet" (start)
  const stateKey = (c: number, r: number, d: number) => (r * cols + c) * 5 + (d < 0 ? 4 : d);
  const h = (c: number, r: number) => (Math.abs(c - goal.c) + Math.abs(r - goal.r)) * grid;

  type N = { c: number; r: number; dir: number; g: number; f: number; prevKey: number | null };
  const open: N[] = [];
  const closed = new Set<number>();
  // best cost per (c,r,dir) state
  const best = new Map<number, number>();
  // track path: state-key → node
  const came = new Map<number, N>();

  const sk0 = stateKey(start.c, start.r, -1);
  const startNode: N = { ...start, dir: -1, g: 0, f: h(start.c, start.r), prevKey: null };
  open.push(startNode);
  best.set(sk0, 0);
  came.set(sk0, startNode);

  let goalNode: N | null = null;

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const curSk = stateKey(cur.c, cur.r, cur.dir);
    if (closed.has(curSk)) continue;
    closed.add(curSk);

    if (cur.c === goal.c && cur.r === goal.r) { goalNode = cur; break; }

    for (let d = 0; d < 4; d++) {
      const nc = cur.c + DIRS[d][0], nr = cur.r + DIRS[d][1];
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (blocked(nc, nr)) continue;
      const turn = cur.dir !== -1 && cur.dir !== d ? grid : 0;
      const crowd = usage?.has(usageKey(gx(nc), gy(nr))) ? grid * 3 : 0; // shared-lane premium
      const ng = cur.g + grid + turn + crowd;
      const nsk = stateKey(nc, nr, d);
      if (closed.has(nsk)) continue;
      if ((best.get(nsk) ?? Infinity) <= ng) continue;
      best.set(nsk, ng);
      const nn: N = { c: nc, r: nr, dir: d, g: ng, f: ng + h(nc, nr), prevKey: curSk };
      came.set(nsk, nn);
      open.push(nn);
    }
  }

  if (!goalNode) {
    // Boxed in: return whichever L-path collides with fewer obstacles (best effort).
    const hv = [from, { x: to.x, y: from.y }, to];
    const vh = [from, { x: from.x, y: to.y }, to];
    const hits = (p: Pt[]) => { let n = 0; for (let i = 1; i < p.length; i++) if (!clear(p[i - 1], p[i], rects)) n++; return n; };
    return applyEndpointGaps(simplify(hits(hv) <= hits(vh) ? hv : vh), opts.sourceGap ?? 0, opts.targetGap ?? 0);
  }

  const pts: Pt[] = [];
  let n: N | undefined = goalNode;
  while (n) {
    pts.push({ x: gx(n.c), y: gy(n.r) });
    n = n.prevKey != null ? came.get(n.prevKey) : undefined;
  }
  pts.reverse();
  // Build the full path: actual from → grid path → actual to.
  // The grid path starts/ends at snapped coords, which may not equal from/to.
  // Connect them orthogonally: replace pts[0] with from, pts[last] with to,
  // but insert bend points as needed to keep every segment axis-aligned.
  const full: Pt[] = [from];
  // Skip the first grid point if it equals from (exact match after snap)
  const iFirst = (pts.length > 0 && pts[0].x === from.x && pts[0].y === from.y) ? 1 : 0;
  // Skip the last grid point if it equals to
  const iLast = (pts.length > iFirst && pts[pts.length - 1].x === to.x && pts[pts.length - 1].y === to.y)
    ? pts.length - 1 : pts.length;
  // Connect from → first grid point orthogonally (mirror of the tail connector):
  // if the first grid point differs from `from` in BOTH axes, insert a bend so the
  // approach segment is never diagonal. Align the bend with the A* path's first step.
  if (iFirst < pts.length && pts[iFirst].x !== from.x && pts[iFirst].y !== from.y) {
    const nextPt = iFirst + 1 < iLast ? pts[iFirst + 1] : null;
    if (nextPt && nextPt.x === pts[iFirst].x) full.push({ x: pts[iFirst].x, y: from.y });
    else full.push({ x: from.x, y: pts[iFirst].y });
  }
  for (let i = iFirst; i < iLast; i++) full.push(pts[i]);
  // Connect last point in full → to orthogonally
  const last = full[full.length - 1];
  if (last.x !== to.x || last.y !== to.y) {
    // Need an orthogonal connector: try horizontal-then-vertical or vertical-then-horizontal
    if (last.x !== to.x && last.y !== to.y) {
      // Insert a bend point: use the direction of the last A* segment to decide
      // Last segment direction
      const prevPt = full.length >= 2 ? full[full.length - 2] : null;
      if (prevPt && prevPt.x === last.x) {
        // Last segment was vertical → continue with horizontal bend
        full.push({ x: to.x, y: last.y });
      } else {
        // Last segment was horizontal → continue with vertical bend
        full.push({ x: last.x, y: to.y });
      }
    }
    full.push(to);
  }
  return applyEndpointGaps(simplify(full), opts.sourceGap ?? 0, opts.targetGap ?? 0);
}

// Drop collinear / duplicate points.
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) { out[out.length - 1] = p; continue; }
    }
    out.push(p);
  }
  return out;
}

function movePointToward(point: Pt, toward: Pt, gap: number): Pt {
  if (gap <= 0) return point;
  const dx = toward.x - point.x;
  const dy = toward.y - point.y;
  const len = Math.abs(dx) + Math.abs(dy);
  if (len <= 0) return point;
  const safeGap = Math.min(gap, Math.max(0, len - 1));
  return {
    x: point.x + Math.sign(dx) * safeGap,
    y: point.y + Math.sign(dy) * safeGap,
  };
}

function applyEndpointGaps(pts: Pt[], sourceGap: number, targetGap: number): Pt[] {
  if (pts.length < 2 || (sourceGap <= 0 && targetGap <= 0)) return pts;
  const out = pts.map((p) => ({ ...p }));
  if (sourceGap > 0) out[0] = movePointToward(out[0], out[1], sourceGap);
  if (targetGap > 0) out[out.length - 1] = movePointToward(out[out.length - 1], out[out.length - 2], targetGap);
  return simplify(out);
}
