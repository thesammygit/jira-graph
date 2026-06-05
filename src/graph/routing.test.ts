import { routeOrthogonal, type Rect } from './routing';

function segmentsAxisAligned(path: { x: number; y: number }[]) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (a.x !== b.x && a.y !== b.y) return false;
  }
  return true;
}
// true if the axis-aligned segment a-b passes through rect r's interior
function segHitsRect(a: any, b: any, r: Rect) {
  const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x), y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
  return x1 < r.x + r.width && x2 > r.x && y1 < r.y + r.height && y2 > r.y;
}

test('clear path: returns an orthogonal route connecting the endpoints', () => {
  const path = routeOrthogonal({ x: 0, y: 0 }, { x: 200, y: 100 }, []);
  expect(path[0]).toEqual({ x: 0, y: 0 });
  expect(path[path.length - 1]).toEqual({ x: 200, y: 100 });
  expect(segmentsAxisAligned(path)).toBe(true);
});

test('obstacle between endpoints: no segment passes through the obstacle', () => {
  const obstacle: Rect = { x: 80, y: -40, width: 60, height: 120 }; // straddles the straight line
  const path = routeOrthogonal({ x: 0, y: 20 }, { x: 220, y: 20 }, [obstacle]);
  expect(segmentsAxisAligned(path)).toBe(true);
  expect(path.some(() => true)).toBe(true);
  for (let i = 1; i < path.length; i++) {
    expect(segHitsRect(path[i - 1], path[i], obstacle)).toBe(false);
  }
});

test('deterministic', () => {
  const o: Rect[] = [{ x: 80, y: -40, width: 60, height: 120 }];
  expect(routeOrthogonal({ x: 0, y: 20 }, { x: 220, y: 20 }, o)).toEqual(routeOrthogonal({ x: 0, y: 20 }, { x: 220, y: 20 }, o));
});
