import type { Graph } from '../../core/model';
import type { Positions } from './types';

const ITER = 300, REPULSION = 120_000, SPRING = 0.02, REST = 220, DAMP = 0.85;

export function force(graph: Graph): Positions {
  const keys = graph.nodes.map((n) => n.key);
  const N = keys.length || 1;
  const p = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  keys.forEach((k, i) => {
    const a = (i / N) * Math.PI * 2;
    p.set(k, { x: Math.cos(a) * 300, y: Math.sin(a) * 300, vx: 0, vy: 0 });
  });
  for (let it = 0; it < ITER; it++) {
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = p.get(keys[i])!, b = p.get(keys[j])!;
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy || 0.01;
        const f = REPULSION / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    for (const e of graph.edges) {
      const a = p.get(e.source), b = p.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - REST) * SPRING;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
    for (const k of keys) {
      const v = p.get(k)!;
      v.vx *= DAMP; v.vy *= DAMP;
      v.x += v.vx; v.y += v.vy;
    }
  }
  const out: Positions = new Map();
  for (const k of keys) { const v = p.get(k)!; out.set(k, { x: v.x, y: v.y }); }
  return out;
}
