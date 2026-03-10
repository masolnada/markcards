import { Router } from 'express';
import type { DeckService } from '../../application/deck-service.js';
import type { ReviewService } from '../../application/review-service.js';

export function createDecksRouter(deckService: DeckService, reviewService: ReviewService): Router {
  const router = Router();

  router.get('/api/decks', async (_req, res) => {
    const decks = await deckService.listDecks(new Date());
    res.json(decks);
  });

  router.get('/api/decks/:deckId/cards', async (req, res) => {
    const result = await reviewService.getAllCardsForDeck(req.params.deckId);
    if (!result) { res.status(404).json({ error: 'Deck not found' }); return; }
    res.json(result);
  });

  router.delete('/api/decks/:deckId/cards', async (req, res) => {
    const { cardIds } = req.body as { cardIds?: unknown };
    if (!Array.isArray(cardIds) || cardIds.some(id => typeof id !== 'string')) {
      res.status(400).json({ error: 'cardIds must be an array of strings' });
      return;
    }
    await reviewService.deleteCards(req.params.deckId, cardIds as string[]);
    res.status(204).end();
  });

  router.get('/api/decks/:deckId', async (req, res) => {
    const result = await deckService.getDeck(req.params.deckId, new Date());
    if (!result) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }
    res.json(result);
  });

  return router;
}
