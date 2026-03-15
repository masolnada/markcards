import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createInputRouter } from './input.js';
import type { InputService } from '../../application/input-service.js';

function makeStubService(overrides: Partial<InputService> = {}): InputService {
  return {
    getInputCards: vi.fn().mockResolvedValue({ cards: [] }),
    confirmCard: vi.fn().mockResolvedValue(undefined),
    rejectCard: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as InputService;
}

function makeApp(service: InputService) {
  const app = express();
  app.use(express.json());
  app.use(createInputRouter(service));
  return app;
}

const SAMPLE_CARD = {
  id: 'abc123',
  destPath: 'math/algebra.md',
  rawMarkdown: 'Q: What is x?\nA: A variable',
};

describe('GET /api/input', () => {
  it('returns empty cards list', async () => {
    const app = makeApp(makeStubService());
    const res = await request(app).get('/api/input');
    expect(res.status).toBe(200);
    expect(res.body.cards).toEqual([]);
  });

  it('returns cards from service', async () => {
    const app = makeApp(makeStubService({
      getInputCards: vi.fn().mockResolvedValue({ cards: [SAMPLE_CARD] }),
    }));
    const res = await request(app).get('/api/input');
    expect(res.status).toBe(200);
    expect(res.body.cards).toHaveLength(1);
    expect(res.body.cards[0].id).toBe('abc123');
    expect(res.body.cards[0].destPath).toBe('math/algebra.md');
  });
});

describe('POST /api/input/:cardId/confirm', () => {
  it('returns 200 ok on successful confirm', async () => {
    const app = makeApp(makeStubService());
    const res = await request(app).post('/api/input/abc123/confirm').send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('passes markdown body to service', async () => {
    const confirmCard = vi.fn().mockResolvedValue(undefined);
    const app = makeApp(makeStubService({ confirmCard }));
    await request(app).post('/api/input/abc123/confirm').send({ markdown: 'Q: X?\nA: Y' });
    expect(confirmCard).toHaveBeenCalledWith('abc123', 'Q: X?\nA: Y');
  });

  it('passes undefined when no markdown in body', async () => {
    const confirmCard = vi.fn().mockResolvedValue(undefined);
    const app = makeApp(makeStubService({ confirmCard }));
    await request(app).post('/api/input/abc123/confirm').send({});
    expect(confirmCard).toHaveBeenCalledWith('abc123', undefined);
  });

  it('returns 404 when card not found', async () => {
    const app = makeApp(makeStubService({
      confirmCard: vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { status: 404 })),
    }));
    const res = await request(app).post('/api/input/missing/confirm').send({});
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/input/:cardId/reject', () => {
  it('returns 200 ok on successful reject', async () => {
    const app = makeApp(makeStubService());
    const res = await request(app).delete('/api/input/abc123/reject');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('calls rejectCard with the correct cardId', async () => {
    const rejectCard = vi.fn().mockResolvedValue(undefined);
    const app = makeApp(makeStubService({ rejectCard }));
    await request(app).delete('/api/input/abc123/reject');
    expect(rejectCard).toHaveBeenCalledWith('abc123');
  });

  it('returns 404 when card not found', async () => {
    const app = makeApp(makeStubService({
      rejectCard: vi.fn().mockRejectedValue(Object.assign(new Error('not found'), { status: 404 })),
    }));
    const res = await request(app).delete('/api/input/missing/reject');
    expect(res.status).toBe(404);
  });
});
