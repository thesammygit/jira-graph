import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { useMemo } from 'react';
import { routeOrthogonal, simplify, type Pt, type Rect } from '../graph/routing';
import { useRouting } from './routing-context';

/**
 * Gutter-routed orthogonal edge.
 *
 * Cross-box edges never travel through ANY box: the wire leaves the source
 * ticket with a short stub to its top-level container's wall, runs through the
 * gutters between containers (all other top-level boxes are hard obstacles),
 * and enters the target container with a matching stub. Same-box edges route
 * around sibling chips inside the box.
 */
export function RoutedEdge({ id, source, target, sourceX, sourceY, targetX, targetY, style, markerEnd }: EdgeProps) {
  const { obstacles, topOf, ancestorsOf } = useRouting();

  const d = useMemo(() => {
    const rectOf = new Map(obstacles.map((o) => [o.id, o.rect]));
    const from: Pt = { x: sourceX, y: sourceY };
    const to: Pt = { x: targetX, y: targetY };
    const topS = topOf[source] ?? source;
    const topT = topOf[target] ?? target;

    let pts: Pt[];
    if (topS === topT) {
      // Same top-level box: avoid sibling chips/sub-boxes inside it, but never
      // treat our own ancestors (which contain the endpoints) as obstacles.
      const excluded = new Set([source, target, ...(ancestorsOf[source] ?? []), ...(ancestorsOf[target] ?? [])]);
      const rects = obstacles
        .filter((o) => (topOf[o.id] ?? o.id) === topS && !excluded.has(o.id) && o.id !== topS)
        .map((o) => o.rect);
      pts = routeOrthogonal(from, to, rects, { padding: 10, grid: 12 });
    } else {
      const Rs = rectOf.get(topS);
      const Rt = rectOf.get(topT);
      if (!Rs || !Rt) {
        pts = routeOrthogonal(from, to, [], {});
      } else {
        // Cross-box wires are aggregated box-to-box: attach to the facing walls and
        // travel ONLY through the gutters (every other top-level box is a hard
        // obstacle). No interior legs — nothing ever crosses a box.
        const exit = borderPointToward(Rs, center(Rt));
        const entry = borderPointToward(Rt, center(Rs));
        const gutterRects = obstacles
          .filter((o) => (topOf[o.id] ?? o.id) === o.id && o.id !== topS && o.id !== topT)
          .map((o) => o.rect);
        pts = simplify(routeOrthogonal(exit, entry, gutterRects, { padding: 14, grid: 14 }));
      }
    }
    return roundedPolyline(pts, 8);
  }, [obstacles, topOf, ancestorsOf, source, target, sourceX, sourceY, targetX, targetY]);

  return (
    <BaseEdge
      id={id}
      path={d}
      style={{ ...style, strokeLinecap: 'round', strokeLinejoin: 'round' }}
      markerEnd={markerEnd}
    />
  );
}

function center(r: Rect): Pt { return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }

/** The point on `r`'s border facing `toward` — picks the wall by dominant axis,
 *  positioned at the clamped coordinate so stubs leave perpendicular to the wall. */
function borderPointToward(r: Rect, toward: Pt): Pt {
  const c = center(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  const margin = 18;
  const clampX = Math.min(Math.max(toward.x, r.x + margin), r.x + r.width - margin);
  const clampY = Math.min(Math.max(toward.y, r.y + margin), r.y + r.height - margin);
  if (Math.abs(dx) * r.height >= Math.abs(dy) * r.width) {
    // leave through left/right wall
    return { x: dx >= 0 ? r.x + r.width : r.x, y: clampY };
  }
  // leave through top/bottom wall
  return { x: clampX, y: dy >= 0 ? r.y + r.height : r.y };
}

function roundedPolyline(points: Pt[], radius: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const inLen = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
    const outLen = Math.abs(next.x - cur.x) + Math.abs(next.y - cur.y);
    const isCorner = (prev.x !== next.x) && (prev.y !== next.y);
    const r = isCorner ? Math.min(radius, inLen / 2, outLen / 2) : 0;

    if (r <= 0) {
      path += ` L ${cur.x},${cur.y}`;
      continue;
    }

    const before = { x: cur.x + Math.sign(prev.x - cur.x) * r, y: cur.y + Math.sign(prev.y - cur.y) * r };
    const after = { x: cur.x + Math.sign(next.x - cur.x) * r, y: cur.y + Math.sign(next.y - cur.y) * r };
    path += ` L ${before.x},${before.y} Q ${cur.x},${cur.y} ${after.x},${after.y}`;
  }

  const last = points[points.length - 1];
  return `${path} L ${last.x},${last.y}`;
}
