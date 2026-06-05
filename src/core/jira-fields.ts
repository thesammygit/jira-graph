import type { IssueKind, StatusCategory } from './model';

export function initialsFrom(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function kindFromIssuetype(it: { name?: string; subtask?: boolean } | undefined): IssueKind {
  if (!it) return 'other';
  if (it.subtask) return 'subtask';
  switch ((it.name ?? '').toLowerCase()) {
    case 'epic': return 'epic';
    case 'story': return 'story';
    case 'bug': return 'bug';
    case 'task': return 'task';
    default: return 'other';
  }
}

export function statusCategoryFrom(key: string | undefined): StatusCategory {
  switch (key) {
    case 'indeterminate': return 'inprogress';
    case 'done': return 'done';
    default: return 'todo';
  }
}

export function hierarchyLevelFor(kind: IssueKind): number {
  switch (kind) {
    case 'epic': return 2;
    case 'subtask': return 0;
    default: return 1;
  }
}
