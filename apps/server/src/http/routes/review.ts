import { Router } from 'express';
import type { ReviewService } from '../../application/review-service.js';

export function createReviewRouter(reviewService: ReviewService): Router {
  const router = Router();

  router.get('/api/review', async (_req, res) => {
    const result = await reviewService.getDueCards(new Date());
    res.json(result);
  });

  router.get('/api/review/:deckId', async (req, res) => {
    const result = await reviewService.getDueCardsForDeck(req.params.deckId, new Date());
    if (!result) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }
    res.json(result);
  });

  router.post('/api/review', (req, res) => {
    const { cardId, pass } = req.body as { cardId?: string; pass?: boolean };

    if (!cardId || typeof pass !== 'boolean') {
      res.status(400).json({ error: 'cardId and pass (boolean) are required' });
      return;
    }

    const result = reviewService.submitReview(cardId, pass, new Date());
    if (!result) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    res.json({ cardId, ...result });
  });

  return router;
}
