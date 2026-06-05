import { adfToText } from './adf';

test('passes plain strings through (v2)', () => {
  expect(adfToText('hello world')).toBe('hello world');
});

test('returns empty string for null/undefined', () => {
  expect(adfToText(null)).toBe('');
  expect(adfToText(undefined)).toBe('');
});

test('flattens an ADF document (v3) joining blocks with newlines', () => {
  const adf = {
    type: 'doc', version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'First line.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Second ' }, { type: 'text', text: 'line.' }] },
    ],
  };
  expect(adfToText(adf)).toBe('First line.\nSecond line.');
});
