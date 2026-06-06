import { computeEdgePaths, type RoutingGeometry } from './edge-paths';

// Two top-level boxes side by side with a gutter between them.
const geo: RoutingGeometry = {
  obstacles: [
    { id: 'A', rect: { x: 0, y: 0, width: 200, height: 200 } },
    { id: 'B', rect: { x: 300, y: 0, width: 200, height: 200 } },
  ],
  topOf: { A: 'A', B: 'B' },
  ancestorsOf: { A: [], B: [] },
};

function samplePath(d: string): Array<[number, number]> {
  // crude: pull every "x,y" coordinate pair out of the path string
  return [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

test('parallel wires between the same box pair get distinct lanes, not identical paths', () => {
  const paths = computeEdgePaths(
    [
      { id: 'A->B:blocks', source: 'A', target: 'B' },
      { id: 'A->B:relates', source: 'A', target: 'B' },
    ],
    geo,
  );
  expect(paths['A->B:blocks']).toBeTruthy();
  expect(paths['A->B:relates']).toBeTruthy();
  expect(paths['A->B:blocks']).not.toEqual(paths['A->B:relates']);
  // anchors are fanned apart along the wall (different y on the facing walls)
  const y1 = samplePath(paths['A->B:blocks'])[0][1];
  const y2 = samplePath(paths['A->B:relates'])[0][1];
  expect(Math.abs(y1 - y2)).toBeGreaterThanOrEqual(10);
});

test('opposite-direction wires between the same pair also separate', () => {
  const paths = computeEdgePaths(
    [
      { id: 'A->B:blocks', source: 'A', target: 'B' },
      { id: 'B->A:blocks', source: 'B', target: 'A' },
    ],
    geo,
  );
  expect(paths['A->B:blocks']).not.toEqual(paths['B->A:blocks']);
});

test('a single wire keeps the plain centered anchor (no offset)', () => {
  const paths = computeEdgePaths([{ id: 'A->B:blocks', source: 'A', target: 'B' }], geo);
  const [x, y] = samplePath(paths['A->B:blocks'])[0];
  expect(x).toBe(200);  // right wall of A
  expect(y).toBe(100);  // vertically centered
});

// Box P with two chips stacked vertically, plus an in-between sibling to dodge.
const inBox: RoutingGeometry = {
  obstacles: [
    { id: 'P', rect: { x: 0, y: 0, width: 400, height: 400 } },
    { id: 'c1', rect: { x: 16, y: 50, width: 168, height: 88 } },
    { id: 'mid', rect: { x: 16, y: 158, width: 168, height: 88 } },
    { id: 'c2', rect: { x: 16, y: 266, width: 168, height: 88 } },
  ],
  topOf: { P: 'P', c1: 'P', mid: 'P', c2: 'P' },
  ancestorsOf: { P: [], c1: ['P'], mid: ['P'], c2: ['P'] },
};

test('same-box wires anchor on facing sides, stay inside the box, and never enter a chip', () => {
  const paths = computeEdgePaths([{ id: 'c1->c2:blocks', source: 'c1', target: 'c2' }], inBox);
  const pts = samplePath(paths['c1->c2:blocks']);
  const first = pts[0], last = pts[pts.length - 1];
  expect(first[1]).toBe(138); // bottom wall of c1 (the side facing c2)
  expect(last[1]).toBe(266);  // top wall of c2 (the side facing c1)
  // every vertex stays inside the box and outside every chip interior
  for (const [x, y] of pts) {
    expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(400);
    expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(400);
    const inMid = x > 17 && x < 183 && y > 159 && y < 245;
    expect(inMid).toBe(false); // never cuts through the sibling chip
  }
});

test('crossing wires get an electrical hop (arc) on the horizontal run', () => {
  // H wire A→B crosses the V wire C→D between two box pairs laid out in a plus.
  const plus: RoutingGeometry = {
    obstacles: [
      { id: 'L', rect: { x: 0, y: 300, width: 100, height: 100 } },
      { id: 'R', rect: { x: 600, y: 300, width: 100, height: 100 } },
      { id: 'T', rect: { x: 300, y: 0, width: 100, height: 100 } },
      { id: 'B', rect: { x: 300, y: 600, width: 100, height: 100 } },
    ],
    topOf: { L: 'L', R: 'R', T: 'T', B: 'B' },
    ancestorsOf: { L: [], R: [], T: [], B: [] },
  };
  const paths = computeEdgePaths(
    [
      { id: 'T->B:blocks', source: 'T', target: 'B' },   // vertical, routed first
      { id: 'L->R:blocks', source: 'L', target: 'R' },   // horizontal, must hop it
    ],
    plus,
  );
  expect(paths['L->R:blocks']).toContain(' A 5 5 ');
});
