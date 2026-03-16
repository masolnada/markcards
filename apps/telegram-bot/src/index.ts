import { Bot } from 'grammy';
import { SchedulerManager } from './scheduler.js';
import { ConfigStore } from './config-store.js';
import { registerCardHandlers } from './handlers/cards.js';
import { registerRemindCommand } from './handlers/remind.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
if (!process.env.GOOGLE_GEMINI_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY is required');
if (!process.env.GITHUB_REPO) throw new Error('GITHUB_REPO is required');
if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required');
if (!process.env.MARKCARDS_API_URL) throw new Error('MARKCARDS_API_URL is required');

const [githubOwner, githubRepo] = process.env.GITHUB_REPO.split('/');
if (!githubOwner || !githubRepo) throw new Error('GITHUB_REPO must be "owner/repo"');

const allowedUsers =
  process.env.ALLOWED_USER_IDS?.split(',').map(Number).filter(Boolean) ?? [];
if (allowedUsers.length === 0) {
  console.warn('Warning: ALLOWED_USER_IDS is not set — bot is open to everyone');
}

const isAuthorized = (userId: number) =>
  allowedUsers.length === 0 || allowedUsers.includes(userId);

const bot = new Bot(token);

registerCardHandlers(bot, {
  token,
  githubOwner,
  githubRepo,
  githubBranch: process.env.GITHUB_BRANCH ?? 'main',
  githubToken: process.env.GITHUB_TOKEN!,
  githubBasePath: process.env.GITHUB_PATH ?? 'cards',
  plantnetApiKey: process.env.PLANTNET_API_KEY ?? null,
  isAuthorized,
});

const reminderChatId = allowedUsers[0] ?? null;
const configStore = new ConfigStore(process.env.CONFIG_PATH ?? './bot-config.json');
const scheduler = reminderChatId
  ? new SchedulerManager(process.env.MARKCARDS_API_URL!, (text) =>
      bot.api.sendMessage(reminderChatId, text).then(() => undefined),
    )
  : null;

if (scheduler) {
  scheduler.setTimes(configStore.load().reminderTimes);
}

registerRemindCommand(bot, { scheduler, configStore, isAuthorized });

bot.start();
console.log('Bot started');
