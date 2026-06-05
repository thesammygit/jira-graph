import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { useMemo } from 'react';
import { routeOrthogonal } from '../graph/routing';
import { useObstacles } from './routing-context';

export function RoutedEdge({ id, source, target, sourceX, sourceY, targetX, targetY, style, markerEnd, label }: EdgeProps) {
  const obstacles = useObstacles();
  const d = useMemo(() => {
    const rects = obstacles.filter((o) => o.id !== source && o.id !== target).map((o) => o.rect);
    const pts = routeOrthogonal({ x: sourceX, y: sourceY }, { x: targetX, y: targetY }, rects);
    let path = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x},${pts[i].y}`;
    }
    return path;
  }, [obstacles, source, target, sourceX, sourceY, targetX, targetY]);

  return <BaseEdge id={id} path={d} style={style} markerEnd={markerEnd} label={label as any} labelStyle={{ fontSize: 10 }} />;
}
