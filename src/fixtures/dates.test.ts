import { v3Issues, v3Caps } from './v3';
import { normalizeIssues } from '../core/normalize';

test('v3 caps expose start/sprint field ids and most issues have a dueDate', () => {
  expect(v3Caps.startDateFieldId).toBeTruthy();
  expect(v3Caps.sprintFieldId).toBeTruthy();
  const g = normalizeIssues(v3Issues, v3Caps);
  const dated = g.nodes.filter((n) => n.dueDate).length;
  expect(dated).toBeGreaterThanOrEqual(10);
});
