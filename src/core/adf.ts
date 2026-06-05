const BLOCK_TYPES = new Set(['paragraph', 'heading', 'blockquote', 'listItem', 'codeBlock']);

export function adfToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  return collect(value as AdfNode).replace(/\n{2,}/g, '\n').trim();
}

interface AdfNode { type?: string; text?: string; content?: AdfNode[] }

function collect(node: AdfNode): string {
  if (node.type === 'text') return node.text ?? '';
  const inner = (node.content ?? []).map(collect).join('');
  return BLOCK_TYPES.has(node.type ?? '') ? inner + '\n' : inner;
}
