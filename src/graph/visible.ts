import type { GraphNode, IssueKind, StatusCategory } from '../core/model';

export interface VisibilityFilters {
  hiddenTypes: Set<IssueKind>;
  hiddenStatuses: Set<StatusCategory>;
  hiddenProjects: Set<string>;
  hiddenAssignees: Set<string>;
}

export function isNodeVisible(node: GraphNode, f: VisibilityFilters): boolean {
  if (f.hiddenTypes.has(node.type.kind)) return false;
  if (f.hiddenStatuses.has(node.status.category)) return false;
  if (f.hiddenProjects.has(node.project.key)) return false;
  const a = node.assignee?.displayName ?? '__unassigned__';
  if (f.hiddenAssignees.has(a)) return false;
  return true;
}
