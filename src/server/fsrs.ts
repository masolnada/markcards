// FSRS 4.5 implementation
// Based on the open-source FSRS algorithm: https://github.com/open-spaced-repetition/fsrs4anki

export type CardState = 0 | 1 | 2 | 3; // New, Learning, Review, Relearning
export type Rating = 1 | 2 | 3 | 4;    // Again, Hard, Good, Easy

export interface FSRSCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview: Date | null;
}

export interface ReviewLog {
  rating: Rating;
  scheduledDays: number;
  elapsedDays: number;
  review: Date;
}

export interface ScheduleResult {
  card: FSRSCard;
  reviewLog: ReviewLog;
}

// FSRS 4.5 default weights
const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589, 1.5330,
  0.1544, 1.0070, 1.9395, 0.1100, 0.2900, 2.2700, 0.0000, 2.9898, 0.5100,
  0.4300,
];

const FACTOR = 19 / 81;
const DECAY = -0.5;
const GRAD = Math.pow(1 + FACTOR, DECAY); // Used for retrievability calc

// Retrievability: probability of recall after t days with stability S
function retrievability(t: number, s: number): number {
  return Math.pow(1 + FACTOR * t / s, DECAY);
}

// Initial stability for a given rating (New card)
function initStability(rating: Rating): number {
  return Math.max(W[rating - 1], 0.1);
}

// Initial difficulty for a given rating (New card)
function initDifficulty(rating: Rating): number {
  const d = W[4] - Math.exp(W[5] * (rating - 1)) + 1;
  return Math.min(Math.max(d, 1), 10);
}

// Next stability after a successful recall
function nextRecallStability(d: number, s: number, r: number, rating: Rating): number {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  return s * (
    Math.exp(W[8]) *
    (11 - d) *
    Math.pow(s, -W[9]) *
    (Math.exp((1 - r) * W[10]) - 1) *
    hardPenalty *
    easyBonus + 1
  );
}

// Next stability after forgetting (Again)
function nextForgetStability(d: number, s: number, r: number): number {
  return W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
}

// Next difficulty after a review
function nextDifficulty(d: number, rating: Rating): number {
  const deltaD = -W[6] * (rating - 3);
  const meanReversion = W[7] * (W[4] - d);
  const next = d + deltaD + meanReversion;
  return Math.min(Math.max(next, 1), 10);
}

// Short-interval steps for learning/relearning states (in minutes)
const LEARNING_STEPS = [1, 10]; // minutes
const RELEARNING_STEPS = [10];  // minutes

export function createEmptyCard(now: Date = new Date()): FSRSCard {
  return {
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0, // New
    lastReview: null,
  };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function schedule(card: FSRSCard, rating: Rating, now: Date = new Date()): ScheduleResult {
  const elapsed = card.lastReview
    ? Math.max(0, Math.round((now.getTime() - card.lastReview.getTime()) / 86400000))
    : 0;

  let next: FSRSCard = { ...card, lastReview: now, elapsedDays: elapsed };
  let scheduledDays = 0;

  if (card.state === 0) {
    // New card — initialize stability and difficulty
    next.stability = initStability(rating);
    next.difficulty = initDifficulty(rating);

    if (rating === 1) {
      // Again: stay in Learning, step 0
      next.state = 1;
      const interval = LEARNING_STEPS[0];
      next.due = addMinutes(now, interval);
      next.scheduledDays = 0;
    } else if (rating === 2 || rating === 3) {
      // Hard/Good: move to next step or graduate
      next.state = 1;
      const interval = LEARNING_STEPS[LEARNING_STEPS.length - 1];
      next.due = addMinutes(now, interval);
      next.scheduledDays = 0;
    } else {
      // Easy: graduate immediately
      next.state = 2;
      scheduledDays = Math.max(1, Math.round(next.stability));
      next.due = addDays(now, scheduledDays);
      next.scheduledDays = scheduledDays;
    }
    next.reps = 1;

  } else if (card.state === 1) {
    // Learning
    next.reps += 1;

    if (rating === 1) {
      // Again: reset to first step
      next.stability = initStability(rating);
      next.difficulty = initDifficulty(rating);
      next.due = addMinutes(now, LEARNING_STEPS[0]);
      next.scheduledDays = 0;
    } else if (rating === 2 || rating === 3) {
      // Hard/Good: graduate to Review
      next.state = 2;
      scheduledDays = Math.max(1, Math.round(next.stability));
      next.due = addDays(now, scheduledDays);
      next.scheduledDays = scheduledDays;
    } else {
      // Easy: graduate to Review with bonus
      next.state = 2;
      scheduledDays = Math.max(1, Math.round(next.stability * W[16]));
      next.due = addDays(now, scheduledDays);
      next.scheduledDays = scheduledDays;
    }

  } else if (card.state === 2) {
    // Review
    const r = retrievability(elapsed, card.stability);

    if (rating === 1) {
      // Again: lapse
      next.lapses += 1;
      next.stability = nextForgetStability(card.difficulty, card.stability, r);
      next.difficulty = nextDifficulty(card.difficulty, rating);
      next.state = 3; // Relearning
      next.due = addMinutes(now, RELEARNING_STEPS[0]);
      next.scheduledDays = 0;
    } else {
      // Hard/Good/Easy: successful recall
      next.stability = nextRecallStability(card.difficulty, card.stability, r, rating);
      next.difficulty = nextDifficulty(card.difficulty, rating);
      next.state = 2;
      scheduledDays = Math.max(1, Math.round(next.stability));
      next.due = addDays(now, scheduledDays);
      next.scheduledDays = scheduledDays;
    }
    next.reps += 1;

  } else {
    // Relearning (state === 3)
    next.reps += 1;

    if (rating === 1) {
      // Again: stay in relearning
      next.stability = nextForgetStability(card.difficulty, card.stability, 0);
      next.due = addMinutes(now, RELEARNING_STEPS[0]);
      next.scheduledDays = 0;
    } else {
      // Hard/Good/Easy: graduate back to Review
      next.state = 2;
      scheduledDays = Math.max(1, Math.round(next.stability));
      next.due = addDays(now, scheduledDays);
      next.scheduledDays = scheduledDays;
    }
  }

  return {
    card: next,
    reviewLog: {
      rating,
      scheduledDays: next.scheduledDays,
      elapsedDays: elapsed,
      review: now,
    },
  };
}
