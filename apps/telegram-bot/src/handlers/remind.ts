import { type Bot } from 'grammy';
import { type SchedulerManager } from '../scheduler.js';
import { type ConfigStore } from '../config-store.js';

const TIME_RE = /^\d{2}:\d{2}$/;

export interface RemindConfig {
  scheduler: SchedulerManager | null;
  configStore: ConfigStore;
  isAuthorized: (userId: number) => boolean;
}

export function registerRemindCommand(bot: Bot, config: RemindConfig): void {
  const { scheduler, configStore, isAuthorized } = config;

  bot.command('remind', async (ctx) => {
    if (!isAuthorized(ctx.from!.id)) return;

    if (!scheduler) {
      await ctx.reply('Reminders are not configured (ALLOWED_USER_IDS is not set).');
      return;
    }

    const arg = ctx.match.trim();

    if (!arg) {
      const { reminderTimes } = configStore.load();
      const reply = reminderTimes.length > 0
        ? `Current reminders: ${reminderTimes.join(', ')}`
        : 'No reminders set. Use /remind HH:MM or /remind HH:MM,HH:MM';
      await ctx.reply(reply);
      return;
    }

    if (arg === 'off') {
      scheduler.setTimes([]);
      configStore.save({ reminderTimes: [] });
      await ctx.reply('All reminders cleared.');
      return;
    }

    const times = arg.split(',').map((t) => t.trim());
    if (!times.every((t) => TIME_RE.test(t))) {
      await ctx.reply('Invalid format. Use HH:MM, e.g. /remind 09:00 or /remind 09:00,21:00');
      return;
    }

    scheduler.setTimes(times);
    configStore.save({ reminderTimes: times });
    await ctx.reply(`Reminders set for: ${times.join(', ')}`);
  });
}
