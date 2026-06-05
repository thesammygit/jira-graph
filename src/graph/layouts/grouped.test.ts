import { layoutGrouped } from './grouped';
import type { Grouping } from '../grouping';

function leaf(key: string): any { return { key, summary: key, type: { kind: 'task' } }; }
const grouping: Grouping = {
  containers: [
    { key: 'EPIC-1', node: leaf('EPIC-1'), members: [leaf('TASK-99')], subContainers: [
      { key: 'STORY-10', node: leaf('STORY-10'), members: [leaf('TASK-20'), leaf('SUB-30')], subContainers: [] },
    ] },
  ],
};

test('every container gets a positive size and a depth', () => {
  const lay = layoutGrouped(grouping);
  const epic = lay.containers.find((c) => c.key === 'EPIC-1')!;
  expect(epic.width).toBeGreaterThan(0);
  expect(epic.height).toBeGreaterThan(0);
  expect(epic.depth).toBe(0);
  expect(lay.containers.find((c) => c.key === 'STORY-10')!.parentKey).toBe('EPIC-1');
});

test('members are positioned and reference their parent container', () => {
  const lay = layoutGrouped(grouping);
  const t20 = lay.members.find((m) => m.key === 'TASK-20')!;
  expect(t20.parentKey).toBe('STORY-10');
  expect(Number.isFinite(t20.x)).toBe(true);
  expect(Number.isFinite(t20.y)).toBe(true);
});

test('a sub-container fits within its parent width', () => {
  const lay = layoutGrouped(grouping);
  const epic = lay.containers.find((c) => c.key === 'EPIC-1')!;
  const story = lay.containers.find((c) => c.key === 'STORY-10')!;
  expect(story.x + story.width).toBeLessThanOrEqual(epic.width + 0.01);
});

test('is deterministic', () => {
  expect(layoutGrouped(grouping)).toEqual(layoutGrouped(grouping));
});
