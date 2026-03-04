import { Router } from 'express';
import type { DeckService } from '../../application/deck-service.js';

export function createDecksRouter(deckService: DeckService): Router {
  const router = Router();

  router.get('/api/decks', async (_req, res) => {
    const decks = await deckService.listDecks(new Date());
    res.json(decks);
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
