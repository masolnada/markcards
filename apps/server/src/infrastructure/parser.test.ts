import { describe, it, expect } from 'vitest';
import { parseDeck, removeCardBlocks } from './parser.js';

describe('parseDeck — QA cards', () => {
  it('parses a basic QA card', () => {
    const deck = parseDeck('/decks/test.md', 'Q: What is 2+2?\nA: 4');
    expect(deck.cards).toHaveLength(1);
    const [card] = deck.cards;
    expect(card.type).toBe('qa');
    expect(card.question).toBe('What is 2+2?');
    expect(card.answer).toBe('4');
  });

  it('produces a stable card ID (content-addressed)', () => {
    const content = 'Q: What is 2+2?\nA: 4';
    const a = parseDeck('/decks/test.md', content);
    const b = parseDeck('/decks/test.md', content);
    expect(a.cards[0].id).toBe(b.cards[0].id);
  });

  it('card ID changes when content changes', () => {
    const a = parseDeck('/decks/test.md', 'Q: foo\nA: bar');
    const b = parseDeck('/decks/test.md', 'Q: foo\nA: baz');
    expect(a.cards[0].id).not.toBe(b.cards[0].id);
  });
});

describe('parseDeck — cloze cards', () => {
  it('generates one card per bracket', () => {
    const deck = parseDeck('/decks/test.md', 'C: The [sun] rises in the [east]');
    expect(deck.cards).toHaveLength(2);
    expect(deck.cards.every(c => c.type === 'cloze')).toBe(true);
    expect(deck.cards[0].clozeIndex).toBe(0);
    expect(deck.cards[1].clozeIndex).toBe(1);
  });

  it('produces stable cloze card IDs', () => {
    const content = 'C: The [sun] rises in the [east]';
    const a = parseDeck('/decks/test.md', content);
    const b = parseDeck('/decks/test.md', content);
    expect(a.cards[0].id).toBe(b.cards[0].id);
    expect(a.cards[1].id).toBe(b.cards[1].id);
  });
});

describe('parseDeck — TOML frontmatter', () => {
  it('uses filename as deck name when no frontmatter', () => {
    const deck = parseDeck('/decks/my-topic.md', 'Q: q\nA: a');
    expect(deck.name).toBe('my-topic');
  });

  it('overrides name from TOML frontmatter', () => {
    const content = '---\nname = "My Topic"\n---\nQ: q\nA: a';
    const deck = parseDeck('/decks/my-topic.md', content);
    expect(deck.name).toBe('My Topic');
  });
});

describe('parseDeck — multi-block mixed deck', () => {
  it('parses multiple QA and cloze cards from one file', () => {
    const content = [
      'Q: Capital of France?',
      'A: Paris',
      '',
      'C: The [mitochondria] is the powerhouse of the [cell]',
      '',
      'Q: What is H2O?',
      'A: Water',
    ].join('\n');

    const deck = parseDeck('/decks/mixed.md', content);
    // 2 QA + 2 cloze
    expect(deck.cards).toHaveLength(4);
    expect(deck.cards.filter(c => c.type === 'qa')).toHaveLength(2);
    expect(deck.cards.filter(c => c.type === 'cloze')).toHaveLength(2);
  });
});

describe('removeCardBlocks', () => {
  it('removes a QA card block by its ID', () => {
    const content = 'Q: What is 2+2?\nA: 4\n\nQ: Capital of France?\nA: Paris\n';
    const deck = parseDeck('/decks/test.md', content);
    const [first] = deck.cards;

    const result = removeCardBlocks(content, new Set([first.id]));
    const remaining = parseDeck('/decks/test.md', result);

    expect(remaining.cards).toHaveLength(1);
    expect(remaining.cards[0].question).toBe('Capital of France?');
  });

  it('removes the last QA card block', () => {
    const content = 'Q: What is 2+2?\nA: 4\n\nQ: Capital of France?\nA: Paris\n';
    const deck = parseDeck('/decks/test.md', content);
    const last = deck.cards[1];

    const result = removeCardBlocks(content, new Set([last.id]));
    const remaining = parseDeck('/decks/test.md', result);

    expect(remaining.cards).toHaveLength(1);
    expect(remaining.cards[0].question).toBe('What is 2+2?');
  });

  it('removes a cloze block when any of its card IDs is targeted', () => {
    const content = 'C: The [sun] rises in the [east]\n\nQ: foo?\nA: bar\n';
    const deck = parseDeck('/decks/test.md', content);
    const cloze0 = deck.cards.find(c => c.type === 'cloze' && c.clozeIndex === 0)!;

    const result = removeCardBlocks(content, new Set([cloze0.id]));
    const remaining = parseDeck('/decks/test.md', result);

    expect(remaining.cards).toHaveLength(1);
    expect(remaining.cards[0].type).toBe('qa');
  });

  it('keeps cards not in the removal set', () => {
    const content = 'Q: A?\nA: 1\n\nQ: B?\nA: 2\n\nQ: C?\nA: 3\n';
    const deck = parseDeck('/decks/test.md', content);
    const middleId = deck.cards[1].id;

    const result = removeCardBlocks(content, new Set([middleId]));
    const remaining = parseDeck('/decks/test.md', result);

    expect(remaining.cards).toHaveLength(2);
    expect(remaining.cards.map(c => c.question)).toEqual(['A?', 'C?']);
  });

  it('preserves frontmatter', () => {
    const content = '---\nname = "My Deck"\n---\nQ: foo?\nA: bar\n\nQ: baz?\nA: qux\n';
    const deck = parseDeck('/decks/test.md', content);
    const [first] = deck.cards;

    const result = removeCardBlocks(content, new Set([first.id]));

    expect(result).toContain('name = "My Deck"');
    const remaining = parseDeck('/decks/test.md', result);
    expect(remaining.name).toBe('My Deck');
    expect(remaining.cards).toHaveLength(1);
    expect(remaining.cards[0].question).toBe('baz?');
  });

  it('returns valid content when all cards are removed', () => {
    const content = 'Q: only?\nA: card\n';
    const deck = parseDeck('/decks/test.md', content);

    const result = removeCardBlocks(content, new Set([deck.cards[0].id]));
    const remaining = parseDeck('/decks/test.md', result);

    expect(remaining.cards).toHaveLength(0);
  });

  it('is idempotent when card ID is not present', () => {
    const content = 'Q: foo?\nA: bar\n';
    const result = removeCardBlocks(content, new Set(['nonexistent-id']));
    const remaining = parseDeck('/decks/test.md', result);

    expect(remaining.cards).toHaveLength(1);
  });
});
