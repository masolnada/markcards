import { describe, it, expect, vi, beforeEach } from 'vitest';
import { timeToCron, checkAndNotify, SchedulerManager } from './scheduler.js';

vi.mock('node-cron', () => {
  const schedule = vi.fn(() => ({ stop: vi.fn() }));
  return { default: { schedule } };
});

describe('timeToCron', () => {
  it('converts HH:MM to a daily cron expression', () => {
    expect(timeToCron('09:00')).toBe('0 9 * * *');
    expect(timeToCron('18:30')).toBe('30 18 * * *');
    expect(timeToCron('00:00')).toBe('0 0 * * *');
  });
});

describe('checkAndNotify', () => {
  const apiUrl = 'http://localhost:3000';
  let sendMessage: (text: string) => Promise<void>;

  beforeEach(() => {
    sendMessage = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    vi.restoreAllMocks();
  });

  it('sends a message with the card count when cards are due', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cards: [{}, {}, {}], total: 3 }),
    }));

    await checkAndNotify(apiUrl, sendMessage);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('3'));
  });

  it('does not send a message when no cards are due', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cards: [], total: 0 }),
    }));

    await checkAndNotify(apiUrl, sendMessage);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('uses singular form for a single card', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cards: [{}], total: 1 }),
    }));

    await checkAndNotify(apiUrl, sendMessage);

    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('1 card'));
    expect(sendMessage).not.toHaveBeenCalledWith(expect.stringContaining('cards'));
  });

  it('throws when the API returns a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    await expect(checkAndNotify(apiUrl, sendMessage)).rejects.toThrow();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe('SchedulerManager', () => {
  const apiUrl = 'http://localhost:3000';
  let sendMessage: (text: string) => Promise<void>;
  let cron: { schedule: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sendMessage = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    cron = (await import('node-cron')).default as unknown as typeof cron;
    vi.mocked(cron.schedule).mockClear();
  });

  it('schedules one cron job per time', () => {
    const manager = new SchedulerManager(apiUrl, sendMessage);
    manager.setTimes(['09:00', '21:00']);
    expect(cron.schedule).toHaveBeenCalledTimes(2);
    expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function));
    expect(cron.schedule).toHaveBeenCalledWith('0 21 * * *', expect.any(Function));
  });

  it('stops existing tasks before scheduling new ones', () => {
    const stopFn = vi.fn();
    vi.mocked(cron.schedule).mockReturnValue({ stop: stopFn } as never);

    const manager = new SchedulerManager(apiUrl, sendMessage);
    manager.setTimes(['09:00']);
    manager.setTimes(['21:00']);

    expect(stopFn).toHaveBeenCalledOnce();
    expect(cron.schedule).toHaveBeenCalledTimes(2);
  });

  it('stops all tasks and schedules nothing when given an empty list', () => {
    const stopFn = vi.fn();
    vi.mocked(cron.schedule).mockReturnValue({ stop: stopFn } as never);

    const manager = new SchedulerManager(apiUrl, sendMessage);
    manager.setTimes(['09:00']);
    manager.setTimes([]);

    expect(stopFn).toHaveBeenCalledOnce();
    expect(cron.schedule).toHaveBeenCalledTimes(1);
  });
});
