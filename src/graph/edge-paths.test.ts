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
