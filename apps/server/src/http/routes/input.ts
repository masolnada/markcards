import { Router } from 'express';
import type { InputService } from '../../application/input-service.js';

export function createInputRouter(inputService: InputService): Router {
  const router = Router();

  router.get('/api/input', async (_req, res) => {
    const result = await inputService.getInputCards();
    res.json(result);
  });

  router.post('/api/input/:cardId/confirm', async (req, res) => {
    const { cardId } = req.params;
    const { markdown } = req.body as { markdown?: string };
    try {
      await inputService.confirmCard(cardId, markdown);
      res.json({ ok: true });
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  router.delete('/api/input/:cardId/reject', async (req, res) => {
    const { cardId } = req.params;
    try {
      await inputService.rejectCard(cardId);
      res.json({ ok: true });
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: (err as Error).message });
    }
  });

  return router;
}
