import type { Graph } from '../../core/model';
export type Positions = Map<string, { x: number; y: number }>;
export type LayoutFn = (graph: Graph) => Positions;
export const ROW_H = 150;
export const COL_W = 240;
