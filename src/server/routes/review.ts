import { Router } from 'express';
import { dirname, relative } from 'path';
import { getAllDecks, getDeck, syncIfStale } from '../decks.js';
import { config } from '../config.js';
import { getDueReviewCardIds, getNewCardIdsForQueue, getNewCardIdsForDeckQueue, countNewCardsReviewedToday, getCard, updateCard, getDeckStats } from '../db.js';
import { schedule } from '../fsrs.js';
import type { Rating } from '../fsrs.js';
import { getSettings } from '../settings.js';
import { renderMarkdown, renderClozePrompt, renderClozeReveal } from '../render.js';

const router = Router();

interface RenderedCard {
  cardId: string;
  deckId: string;
  deckName: string;
  type: 'qa' | 'cloze';
  promptHtml: string;
  revealHtml: string;
  questionHtml?: string;
}

function renderCard(cardId: string, deckId: string): RenderedCard | null {
  const deck = getDeck(deckId);
  if (!deck) return null;

  const parsedCard = deck.cards.find(c => c.id === cardId);
  if (!parsedCard) return null;

  const rel = relative(config.decksDir, dirname(deck.filePath));
  const imageBaseUrl = rel ? `/decks/${rel}` : '/decks';

  if (parsedCard.type === 'qa') {
    const questionHtml = renderMarkdown(parsedCard.question ?? '', imageBaseUrl);
    const answerHtml = renderMarkdown(parsedCard.answer ?? '', imageBaseUrl);
    return {
      cardId,
      deckId,
      deckName: deck.name,
      type: 'qa',
      promptHtml: questionHtml,
      revealHtml: `<div class="qa-question">${questionHtml}</div><hr class="my-3 border-gray-300 dark:border-gray-600"/><div class="qa-answer">${answerHtml}</div>`,
      questionHtml,
    };
  } else {
    const template = parsedCard.template ?? '';
    const idx = parsedCard.clozeIndex ?? 0;
    return {
      cardId,
      deckId,
      deckName: deck.name,
      type: 'cloze',
      promptHtml: renderClozePrompt(template, idx, imageBaseUrl),
      revealHtml: renderClozeReveal(template, idx, imageBaseUrl),
    };
  }
}

// GET /api/review — all cards due today, pre-rendered
router.get('/api/review', async (_req, res) => {
  await syncIfStale();
  const now = new Date();
  const settings = getSettings();
  const reviewCards = getDueReviewCardIds(now);
  const newLimit = Math.max(0, settings.maxNewPerDay - countNewCardsReviewedToday(now));
  const newCards = getNewCardIdsForQueue(now, newLimit);
  const due = [...reviewCards, ...newCards];

  const cards: RenderedCard[] = [];
  for (const { cardId, deckId } of due) {
    const rendered = renderCard(cardId, deckId);
    if (rendered) cards.push(rendered);
  }

  res.json({ cards, total: cards.length });
});

// GET /api/review/:deckId — due cards for a specific deck
router.get('/api/review/:deckId', async (req, res) => {
  await syncIfStale();
  const { deckId } = req.params;
  const deck = getDeck(deckId);
  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }

  const now = new Date();
  const settings = getSettings();
  const reviewCards = getDueReviewCardIds(now).filter(d => d.deckId === deckId);
  const newLimit = Math.max(0, settings.maxNewPerDay - countNewCardsReviewedToday(now));
  const newCards = getNewCardIdsForDeckQueue(deckId, now, newLimit);
  const due = [...reviewCards, ...newCards];

  const cards: RenderedCard[] = [];
  for (const { cardId } of due) {
    const rendered = renderCard(cardId, deckId);
    if (rendered) cards.push(rendered);
  }

  res.json({ cards, total: cards.length, deck: { id: deck.id, name: deck.name } });
});

// POST /api/review — submit a review result
router.post('/api/review', (req, res) => {
  const { cardId, pass } = req.body as { cardId?: string; pass?: boolean };

  if (!cardId || typeof pass !== 'boolean') {
    res.status(400).json({ error: 'cardId and pass (boolean) are required' });
    return;
  }

  const card = getCard(cardId);
  if (!card) {
    res.status(404).json({ error: 'Card not found' });
    return;
  }

  const rating: Rating = pass ? 3 : 1; // Good or Again
  const now = new Date();
  const { learningSteps, relearningSteps } = getSettings();
  const result = schedule(card, rating, now, { learningSteps, relearningSteps });
  updateCard(cardId, result.card, rating);

  res.json({
    cardId,
    rating,
    nextDue: result.card.due.toISOString(),
    scheduledDays: result.card.scheduledDays,
    state: result.card.state,
  });
});

export default router;
