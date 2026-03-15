import { describe, it, expect } from 'vitest';
import { parseInputFile, removeInputCard } from './input-parser.js';

const SINGLE_CARD = `# path: math/calculus/derivatives.md

Q: What is the derivative of x²?
A: 2x`;

const MULTI_CARD = `# path: math/calculus/derivatives.md

Q: What is the derivative of x²?
A: 2x

---

# path: history/wwii/causes.md

Q: What caused WWII?
A: Many factors including the Treaty of Versailles`;

describe('parseInputFile', () => {
  it('returns empty array for empty string', () => {
    expect(parseInputFile('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseInputFile('   \n   ')).toEqual([]);
  });

  it('parses a single card', () => {
    const cards = parseInputFile(SINGLE_CARD);
    expect(cards).toHaveLength(1);
    expect(cards[0].destPath).toBe('math/calculus/derivatives.md');
    expect(cards[0].rawMarkdown).toBe('Q: What is the derivative of x²?\nA: 2x');
    expect(typeof cards[0].id).toBe('string');
    expect(cards[0].id).toHaveLength(64); // SHA256 hex
  });

  it('parses multiple cards', () => {
    const cards = parseInputFile(MULTI_CARD);
    expect(cards).toHaveLength(2);
    expect(cards[0].destPath).toBe('math/calculus/derivatives.md');
    expect(cards[1].destPath).toBe('history/wwii/causes.md');
  });

  it('generates stable IDs (same input → same ID)', () => {
    const cards1 = parseInputFile(SINGLE_CARD);
    const cards2 = parseInputFile(SINGLE_CARD);
    expect(cards1[0].id).toBe(cards2[0].id);
  });

  it('generates different IDs for different cards', () => {
    const cards = parseInputFile(MULTI_CARD);
    expect(cards[0].id).not.toBe(cards[1].id);
  });

  it('ignores segments without # path:', () => {
    const content = `Some random text\n\n---\n\n# path: math/algebra.md\n\nQ: What is x?\nA: A variable`;
    const cards = parseInputFile(content);
    expect(cards).toHaveLength(1);
    expect(cards[0].destPath).toBe('math/algebra.md');
  });

  it('trims whitespace from rawMarkdown', () => {
    const content = `# path: deck.md\n\n\n  Q: What?\n  A: This\n\n`;
    const cards = parseInputFile(content);
    expect(cards[0].rawMarkdown).toBe('Q: What?\n  A: This');
  });
});

describe('removeInputCard', () => {
  it('removes the matching card block', () => {
    const cards = parseInputFile(MULTI_CARD);
    const result = removeInputCard(MULTI_CARD, cards[0].id);
    const remaining = parseInputFile(result);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].destPath).toBe('history/wwii/causes.md');
  });

  it('removes the second card block', () => {
    const cards = parseInputFile(MULTI_CARD);
    const result = removeInputCard(MULTI_CARD, cards[1].id);
    const remaining = parseInputFile(result);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].destPath).toBe('math/calculus/derivatives.md');
  });

  it('removes the only card from a single-card file', () => {
    const cards = parseInputFile(SINGLE_CARD);
    const result = removeInputCard(SINGLE_CARD, cards[0].id);
    expect(parseInputFile(result)).toHaveLength(0);
  });

  it('returns original content when cardId is not found', () => {
    const result = removeInputCard(SINGLE_CARD, 'nonexistent-id');
    expect(parseInputFile(result)).toHaveLength(1);
  });
});
