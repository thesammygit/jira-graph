import { normalizeIssue } from './normalize';
import type { Capabilities } from './model';

const caps: Capabilities = { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false, startDateFieldId: 'customfield_10015', sprintFieldId: 'customfield_10020' };
const issuetype = { name: 'Story', subtask: false };

test('reads dueDate from fields.duedate and start from the configured field', () => {
  const raw = { key: 'S-1', fields: { summary: 's', issuetype, status: {}, duedate: '2026-07-10', customfield_10015: '2026-07-01' } };
  const { node } = normalizeIssue(raw, caps);
  expect(node.dueDate).toBe('2026-07-10');
  expect(node.startDate).toBe('2026-07-01');
});

test('reads sprint name from the sprint custom field array (last sprint)', () => {
  const raw = { key: 'S-2', fields: { summary: 's', issuetype, status: {}, customfield_10020: [{ name: 'Sprint 4' }, { name: 'Sprint 5' }] } };
  expect(normalizeIssue(raw, caps).node.sprint).toBe('Sprint 5');
});

test('dates are undefined when fields/caps are absent', () => {
  const { node } = normalizeIssue({ key: 'S-3', fields: { summary: 's', issuetype, status: {} } }, { apiVersion: 3, baseUrl: 'https://x', hasEpicLink: false });
  expect(node.dueDate).toBeUndefined();
  expect(node.startDate).toBeUndefined();
  expect(node.sprint).toBeUndefined();
});
