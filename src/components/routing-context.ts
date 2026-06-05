import { createContext, useContext } from 'react';
import type { Rect } from '../graph/routing';
export interface Obstacle { id: string; rect: Rect }
export const RoutingContext = createContext<Obstacle[]>([]);
export const useObstacles = () => useContext(RoutingContext);
