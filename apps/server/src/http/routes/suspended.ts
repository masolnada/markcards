import { Router } from 'express';
import type { ReviewService } from '../../application/review-service.js';

export function createSuspendedRouter(reviewService: ReviewService): Router {
  const router = Router();

  router.get('/api/suspended', async (_req, res) => {
    const result = await reviewService.getSuspendedCards();
    res.json(result);
  });

  router.post('/api/suspended', (req, res) => {
    const { cardId } = req.body as { cardId?: string };
    if (!cardId) {
      res.status(400).json({ error: 'cardId is required' });
      return;
    }
    reviewService.setSuspended(cardId, true);
    res.json({ ok: true });
  });

  router.delete('/api/suspended/:cardId', (req, res) => {
    reviewService.setSuspended(req.params.cardId, false);
    res.json({ ok: true });
  });

  return router;
}
