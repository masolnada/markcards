import { Router } from 'express';
import { getAllDecks, getDeck, syncIfStale } from '../decks.js';
import { getDeckStats, countNewCardsReviewedToday } from '../db.js';
import { getSettings } from '../settings.js';

const router = Router();

router.get('/api/decks', async (_req, res) => {
  await syncIfStale();
  const now = new Date();
  const { maxNewPerDay } = getSettings();
  const newLimit = Math.max(0, maxNewPerDay - countNewCardsReviewedToday(now));
  const decks = getAllDecks().map(deck => ({
    id: deck.id,
    name: deck.name,
    filePath: deck.filePath,
    stats: getDeckStats(deck.id, now, newLimit),
  }));
  res.json(decks);
});

router.get('/api/decks/:deckId', async (req, res) => {
  await syncIfStale();
  const deck = getDeck(req.params.deckId);
  if (!deck) {
    res.status(404).json({ error: 'Deck not found' });
    return;
  }
  const now = new Date();
  const { maxNewPerDay } = getSettings();
  const newLimit = Math.max(0, maxNewPerDay - countNewCardsReviewedToday(now));
  res.json({
    id: deck.id,
    name: deck.name,
    filePath: deck.filePath,
    stats: getDeckStats(deck.id, now, newLimit),
    cards: deck.cards,
  });
});

export default router;
