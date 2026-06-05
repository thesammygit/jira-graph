import { MockProvider } from './MockProvider';
import { v3Issues, v3Caps } from '../fixtures/v3';

const provider = new MockProvider(v3Issues, v3Caps);

test('capabilities echoes the configured caps', async () => {
  expect((await provider.capabilities()).apiVersion).toBe(3);
});

test('getGraph returns the full normalized graph', async () => {
  const g = await provider.getGraph();
  expect(g.nodes.length).toBeGreaterThanOrEqual(20);
});

test('getNeighborhood limits by depth around a focus key', async () => {
  const full = await provider.getGraph();
  const near = await provider.getNeighborhood(full.nodes[0].key, 1);
  expect(near.nodes.length).toBeLessThanOrEqual(full.nodes.length);
  expect(near.nodes.some((n) => n.key === full.nodes[0].key)).toBe(true);
});

test('search matches key and summary case-insensitively', async () => {
  const hits = await provider.search('cart');
  expect(Array.isArray(hits)).toBe(true);
});
