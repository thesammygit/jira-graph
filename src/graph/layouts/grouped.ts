import type { Grouping, GroupContainer } from '../grouping';

export const GROUP = {
  CHIP_W: 150, CHIP_H: 56, GAP: 12, PAD: 14, HEADER_H: 34, COLS: 3, CONTAINER_GAP: 28,
};

export interface PlacedContainer { key: string; x: number; y: number; width: number; height: number; parentKey?: string; depth: number }
export interface PlacedMember { key: string; x: number; y: number; parentKey: string }
export interface GroupedLayout { containers: PlacedContainer[]; members: PlacedMember[] }

// Pack n cells in a grid of COLS columns; return grid pixel size.
function gridSize(n: number): { w: number; h: number } {
  if (n === 0) return { w: 0, h: 0 };
  const cols = Math.min(GROUP.COLS, n);
  const rows = Math.ceil(n / cols);
  return { w: cols * GROUP.CHIP_W + (cols - 1) * GROUP.GAP, h: rows * GROUP.CHIP_H + (rows - 1) * GROUP.GAP };
}

export function layoutGrouped(grouping: Grouping): GroupedLayout {
  const containers: PlacedContainer[] = [];
  const members: PlacedMember[] = [];

  // Recursively measure a container's intrinsic size (bottom-up), placing its
  // sub-containers and members relative to the container's own top-left.
  function measure(c: GroupContainer, depth: number): { width: number; height: number } {
    let cursorY = GROUP.HEADER_H + GROUP.PAD;
    let maxRowRight = GROUP.PAD;

    // sub-containers stacked vertically (each full-width row)
    const subSizes = c.subContainers.map((s) => measure(s, depth + 1));
    c.subContainers.forEach((s, i) => {
      const size = subSizes[i];
      containers.push({ key: s.key, x: GROUP.PAD, y: cursorY, width: size.width, height: size.height, parentKey: c.key, depth: depth + 1 });
      cursorY += size.height + GROUP.GAP;
      maxRowRight = Math.max(maxRowRight, GROUP.PAD + size.width);
    });

    // members packed in a grid below the sub-containers
    const grid = gridSize(c.members.length);
    c.members.forEach((m, i) => {
      const col = i % GROUP.COLS, row = Math.floor(i / GROUP.COLS);
      members.push({ key: m.key, parentKey: c.key, x: GROUP.PAD + col * (GROUP.CHIP_W + GROUP.GAP), y: cursorY + row * (GROUP.CHIP_H + GROUP.GAP) });
    });
    if (c.members.length) { cursorY += grid.h + GROUP.GAP; maxRowRight = Math.max(maxRowRight, GROUP.PAD + grid.w); }

    const width = Math.max(maxRowRight + GROUP.PAD, 200);
    const height = cursorY + GROUP.PAD;
    return { width, height };
  }

  // Place top-level containers in a wrapped row.
  let x = 0, y = 0, rowH = 0;
  const MAXW = 1600;
  for (const c of grouping.containers) {
    const size = measure(c, 0);
    if (x > 0 && x + size.width > MAXW) { x = 0; y += rowH + GROUP.CONTAINER_GAP; rowH = 0; }
    containers.push({ key: c.key, x, y, width: size.width, height: size.height, depth: 0 });
    x += size.width + GROUP.CONTAINER_GAP;
    rowH = Math.max(rowH, size.height);
  }
  return { containers, members };
}
