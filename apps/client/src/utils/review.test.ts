import { describe, it, expect } from 'vitest';
import { calcProgress } from './review.js';

describe('calcProgress', () => {
  it('is 0% at the start with no cards reviewed', () => {
    expect(calcProgress(0, 5)).toBe(0);
  });

  it('does not inflate the total as cards are reviewed', () => {
    // Regression: the bug computed total = cards.length + stats.reviewed,
    // which grew with each review and made the bar fall behind.
    const total = 5;
    expect(calcProgress(1, total)).toBeCloseTo(20);
    expect(calcProgress(2, total)).toBeCloseTo(40);
    expect(calcProgress(3, total)).toBeCloseTo(60);
    expect(calcProgress(5, total)).toBeCloseTo(100);
  });

  it('is 0% when the queue is empty', () => {
    expect(calcProgress(0, 0)).toBe(0);
  });
});
