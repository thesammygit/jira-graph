import { createContext, useContext } from 'react';

/** True when the canvas is zoomed far out — ticket chips render a cheap
 *  low-detail variant (text would be unreadable anyway). */
export const LodContext = createContext(false);
export const useLod = () => useContext(LodContext);
