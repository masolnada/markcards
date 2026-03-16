import cron, { type ScheduledTask } from 'node-cron';

export function timeToCron(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return `${minutes} ${hours} * * *`;
}

export async function checkAndNotify(
  apiUrl: string,
  sendMessage: (text: string) => Promise<void>,
): Promise<void> {
  const res = await fetch(`${apiUrl}/api/review`);
  if (!res.ok) throw new Error(`Markcards API error: ${res.status}`);

  const { total } = (await res.json()) as { total: number };
  if (total === 0) return;

  const label = total === 1 ? '1 card' : `${total} cards`;
  await sendMessage(`📚 You have ${label} due for review.`);
}

export class SchedulerManager {
  private tasks: ScheduledTask[] = [];

  constructor(
    private readonly apiUrl: string,
    private readonly sendMessage: (text: string) => Promise<void>,
  ) {}

  setTimes(times: string[]): void {
    this.tasks.forEach((t) => t.stop());
    this.tasks = times.map((time) =>
      cron.schedule(timeToCron(time), () => {
        checkAndNotify(this.apiUrl, this.sendMessage).catch((err) =>
          console.error('[scheduler] error:', err),
        );
      }),
    );
    if (times.length > 0) {
      console.log(`[scheduler] reminders set for: ${times.join(', ')}`);
    } else {
      console.log('[scheduler] all reminders cleared');
    }
  }
}
