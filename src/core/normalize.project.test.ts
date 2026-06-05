import { normalizeIssue } from './normalize';
import type { Capabilities } from './model';
const caps: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false };
const it = { name: 'Story', subtask: false };

test('reads project from fields.project', () => {
  const raw = { key: 'CHK-10', fields: { summary: 's', issuetype: it, status: {}, project: { key: 'CHK', name: 'Checkout' } } };
  expect(normalizeIssue(raw, caps).node.project).toEqual({ key: 'CHK', name: 'Checkout' });
});

test('falls back to the issue-key prefix when project is absent', () => {
  const raw = { key: 'CHK-10', fields: { summary: 's', issuetype: it, status: {} } };
  expect(normalizeIssue(raw, caps).node.project).toEqual({ key: 'CHK', name: 'CHK' });
});

test('flattens description via adfToText', () => {
  const raw = { key: 'CHK-10', fields: { summary: 's', issuetype: it, status: {}, description: 'plain text' } };
  expect(normalizeIssue(raw, caps).node.description).toBe('plain text');
});
