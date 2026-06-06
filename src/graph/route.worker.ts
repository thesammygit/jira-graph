import { computeEdgePaths, type EdgeLite, type RoutingGeometry } from './edge-paths';

/** Off-main-thread edge routing for big boards — pure data in, SVG paths out. */
self.onmessage = (e: MessageEvent<{ seq: number; edges: EdgeLite[]; info: RoutingGeometry }>) => {
  const { seq, edges, info } = e.data;
  const paths = computeEdgePaths(edges, info);
  (self as unknown as Worker).postMessage({ seq, paths });
};
