import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { useRouting } from './routing-context';

/**
 * Gutter-routed orthogonal edge. The actual routing happens centrally in
 * GroupedCanvas (graph/edge-paths.ts) so every wire is laid out in ONE pass:
 * cross-box wires travel only through the gutters, same-box wires dodge
 * sibling chips, and parallel/corridor-sharing wires fan into separate lanes
 * instead of rendering on top of each other.
 */
export function RoutedEdge({ id, style, markerEnd }: EdgeProps) {
  const { paths } = useRouting();
  // No path yet = a big board still routing in the worker — render nothing
  // and let the wire appear when its route lands (never a straight stand-in
  // slicing through boxes).
  const d = paths[id];
  if (!d) return null;
  return (
    <BaseEdge
      id={id}
      path={d}
      style={{ ...style, strokeLinecap: 'round', strokeLinejoin: 'round' }}
      markerEnd={markerEnd}
    />
  );
}
