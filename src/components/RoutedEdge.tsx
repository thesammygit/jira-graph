import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { useRouting } from './routing-context';

/**
 * Gutter-routed orthogonal edge. The actual routing happens centrally in
 * GroupedCanvas (graph/edge-paths.ts) so every wire is laid out in ONE pass:
 * cross-box wires travel only through the gutters, same-box wires dodge
 * sibling chips, and parallel/corridor-sharing wires fan into separate lanes
 * instead of rendering on top of each other.
 */
export function RoutedEdge({ id, sourceX, sourceY, targetX, targetY, style, markerEnd }: EdgeProps) {
  const { paths } = useRouting();
  // Fallback (first-paint race only): a plain elbow between the handles.
  const d = paths[id] ?? `M ${sourceX},${sourceY} L ${sourceX},${(sourceY + targetY) / 2} L ${targetX},${(sourceY + targetY) / 2} L ${targetX},${targetY}`;
  return (
    <BaseEdge
      id={id}
      path={d}
      style={{ ...style, strokeLinecap: 'round', strokeLinejoin: 'round' }}
      markerEnd={markerEnd}
    />
  );
}
