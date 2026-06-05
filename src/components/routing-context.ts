import { createContext, useContext } from 'react';
import type { Rect } from '../graph/routing';

export interface Obstacle { id: string; rect: Rect }

export interface RoutingInfo {
  /** Every rendered node with its FULL absolute rect (containers = full box). */
  obstacles: Obstacle[];
  /** node id → its top-level container id (itself when already top-level). */
  topOf: Record<string, string>;
  /** node id → ancestor container ids, nearest first. */
  ancestorsOf: Record<string, string[]>;
}

export const RoutingContext = createContext<RoutingInfo>({ obstacles: [], topOf: {}, ancestorsOf: {} });
export const useRouting = () => useContext(RoutingContext);
