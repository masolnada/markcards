import { Router } from 'express';
import { getAllDecks, getDeck, syncIfStale } from '../decks.js';
import { getDeckStats } from '../db.js';

const router = Router();

router.get('/api/decks', async (_req, res) => {
  await syncIfStale();
  const now = new Date();
  const decks = getAllDecks().map(deck => ({
    id: deck.id,
    name: deck.name,
    filePath: deck.filePath,
    stats: getDeckStats(deck.id, now),
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
  res.json({
    id: deck.id,
    name: deck.name,
    filePath: deck.filePath,
    stats: getDeckStats(deck.id, now),
    cards: deck.cards,
  });
});

export default router;
