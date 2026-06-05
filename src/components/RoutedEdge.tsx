import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { useMemo } from 'react';
import { routeOrthogonal, type Pt } from '../graph/routing';
import { useObstacles } from './routing-context';

export function RoutedEdge({ id, source, target, sourceX, sourceY, targetX, targetY, style, markerEnd, label }: EdgeProps) {
  const obstacles = useObstacles();
  const d = useMemo(() => {
    const rects = obstacles.filter((o) => o.id !== source && o.id !== target).map((o) => o.rect);
    const pts = routeOrthogonal(
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
      rects,
      { padding: 18, sourceGap: 4, targetGap: markerEnd ? 14 : 6 },
    );
    return roundedPolyline(pts, 10);
  }, [obstacles, source, target, sourceX, sourceY, targetX, targetY]);

  return (
    <BaseEdge
      id={id}
      path={d}
      style={{ ...style, strokeLinecap: 'round', strokeLinejoin: 'round' }}
      markerEnd={markerEnd}
      label={label as any}
      labelStyle={{ fontSize: 10, fontWeight: 700, fill: 'var(--ink-muted)' }}
      labelBgStyle={{ fill: 'var(--surface)', fillOpacity: 0.88 }}
      labelBgPadding={[4, 3]}
      labelBgBorderRadius={4}
    />
  );
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

    const before = {
      x: cur.x + Math.sign(prev.x - cur.x) * r,
      y: cur.y + Math.sign(prev.y - cur.y) * r,
    };
    const after = {
      x: cur.x + Math.sign(next.x - cur.x) * r,
      y: cur.y + Math.sign(next.y - cur.y) * r,
    };
    path += ` L ${before.x},${before.y} Q ${cur.x},${cur.y} ${after.x},${after.y}`;
  }

  const last = points[points.length - 1];
  return `${path} L ${last.x},${last.y}`;
}
