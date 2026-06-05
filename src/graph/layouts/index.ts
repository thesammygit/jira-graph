import type { LayoutFn } from './types';
import { hierarchical } from './hierarchical';
import { force } from './force';
import { hybrid } from './hybrid';

export type LayoutKind = 'hierarchical' | 'force' | 'hybrid';
export const layouts: Record<LayoutKind, LayoutFn> = { hierarchical, force, hybrid };
