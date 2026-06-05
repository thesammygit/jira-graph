import { normalizeIssue, normalizeIssues } from './normalize';
import type { Capabilities } from './model';

const caps: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false };
const issuetype = { name: 'Bug', subtask: false };

test('outward blocks link is directed source->target', () => {
  const raw = { key: 'BUG-40', fields: { summary: 's', issuetype, status: {}, issuelinks: [
    { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, outwardIssue: { key: 'STORY-11' } },
  ]}};
  const { edges } = normalizeIssue(raw, caps);
  expect(edges[0]).toMatchObject({ kind: 'link', relation: 'blocks', source: 'BUG-40', target: 'STORY-11', directed: true, label: 'blocks' });
  expect(edges[0].id).toBe('link:blocks:BUG-40->STORY-11');
});

test('inward link is oriented partner->me', () => {
  const raw = { key: 'STORY-11', fields: { summary: 's', issuetype, status: {}, issuelinks: [
    { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: 'BUG-40' } },
  ]}};
  const { edges } = normalizeIssue(raw, caps);
  expect(edges[0]).toMatchObject({ source: 'BUG-40', target: 'STORY-11', relation: 'blocks' });
});

test('relates link is undirected', () => {
  const raw = { key: 'TASK-21', fields: { summary: 's', issuetype, status: {}, issuelinks: [
    { type: { name: 'Relates', inward: 'relates to', outward: 'relates to' }, outwardIssue: { key: 'STORY-10' } },
  ]}};
  const { edges } = normalizeIssue(raw, caps);
  expect(edges[0].directed).toBe(false);
});

test('normalizeIssues dedupes the same link seen from both sides and drops dangling edges', () => {
  const a = { key: 'BUG-40', fields: { summary: 's', issuetype, status: {}, issuelinks: [
    { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, outwardIssue: { key: 'STORY-11' } },
  ]}};
  const b = { key: 'STORY-11', fields: { summary: 's', issuetype: { name: 'Story', subtask: false }, status: {}, issuelinks: [
    { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: 'BUG-40' } },
  ]}};
  const graph = normalizeIssues([a, b], caps);
  expect(graph.nodes).toHaveLength(2);
  expect(graph.edges).toHaveLength(1);
});

test('normalizeIssues drops edges pointing at issues outside the batch', () => {
  const lonely = { key: 'BUG-40', fields: { summary: 's', issuetype, status: {}, issuelinks: [
    { type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, outwardIssue: { key: 'STORY-99' } },
  ]}};
  const graph = normalizeIssues([lonely], caps); // STORY-99 is not in the batch
  expect(graph.nodes).toHaveLength(1);
  expect(graph.edges).toHaveLength(0);
});
