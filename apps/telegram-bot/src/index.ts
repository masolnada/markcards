import { Bot, InlineKeyboard } from 'grammy';
import { generateCards } from './agent.js';
import { appendOrCreateFile } from './github.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
if (!process.env.GOOGLE_GEMINI_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY is required');
if (!process.env.GITHUB_REPO) throw new Error('GITHUB_REPO is required');
if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required');

const [githubOwner, githubRepo] = process.env.GITHUB_REPO.split('/');
if (!githubOwner || !githubRepo) throw new Error('GITHUB_REPO must be "owner/repo"');
const githubToken = process.env.GITHUB_TOKEN;
const githubBasePath = process.env.GITHUB_PATH ?? 'cards';

const allowedUsers =
  process.env.ALLOWED_USER_IDS?.split(',').map(Number).filter(Boolean) ?? [];
if (allowedUsers.length === 0) {
  console.warn('Warning: ALLOWED_USER_IDS is not set — bot is open to everyone');
}

interface CardState {
  card: string;
  filePath: string;
  deckName: string;
  userId: number;
}
const cardStates = new Map<number, CardState>(); // key: messageId

interface StagedCard {
  card: string;
  filePath: string;
  deckName: string;
}
const stagedCards = new Map<number, StagedCard[]>(); // key: userId

function isAuthorized(userId: number): boolean {
  return allowedUsers.length === 0 || allowedUsers.includes(userId);
}

function splitCards(cards: string): string[] {
  return cards.split(/\n---\n/).map((c) => c.trim()).filter(Boolean);
}

function approveDiscardKeyboard() {
  return new InlineKeyboard().text('✅ Approve', 'approve').text('❌ Discard', 'discard');
}

const bot = new Bot(token);

bot.on('message:photo', async (ctx) => {
  if (!isAuthorized(ctx.from.id)) return;
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  const photo = ctx.message.photo.at(-1)!;
  const file = await ctx.api.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const imageBuffer = await fetch(fileUrl).then((r) => r.arrayBuffer());

  const placeholder = await ctx.reply('Generating cards...');
  try {
    const result = await generateCards(imageBuffer, ctx.message.caption);
    const filePath = `${githubBasePath}/${result.filePath}`;

    await ctx.api.deleteMessage(chatId, placeholder.message_id);
    await ctx.reply(`📁 \`${filePath}\``, { parse_mode: 'Markdown' });

    for (const card of splitCards(result.cards)) {
      const msg = await bot.api.sendMessage(chatId, card, { reply_markup: approveDiscardKeyboard() });
      cardStates.set(msg.message_id, { card, filePath, deckName: result.deckName, userId });
    }
  } catch (err) {
    console.error(err);
    await ctx.api.editMessageText(chatId, placeholder.message_id, 'Something went wrong generating cards.');
  }
});

bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery();

  const chatId = ctx.callbackQuery.message?.chat.id;
  const messageId = ctx.callbackQuery.message?.message_id;
  if (!chatId || !messageId) return;

  const cardState = cardStates.get(messageId);
  if (!cardState) {
    await ctx.api.editMessageReplyMarkup(chatId, messageId, { reply_markup: undefined });
    return;
  }

  await ctx.api.editMessageReplyMarkup(chatId, messageId, { reply_markup: undefined });
  cardStates.delete(messageId);

  if (ctx.callbackQuery.data === 'discard') return;

  if (ctx.callbackQuery.data === 'approve') {
    const staged = stagedCards.get(cardState.userId) ?? [];
    staged.push({ card: cardState.card, filePath: cardState.filePath, deckName: cardState.deckName });
    stagedCards.set(cardState.userId, staged);
    await ctx.api.sendMessage(chatId, `✅ Staged (${staged.length} card${staged.length === 1 ? '' : 's'} ready — /push to commit)`);
  }
});

bot.command('push', async (ctx) => {
  if (!isAuthorized(ctx.from!.id)) return;
  const userId = ctx.from!.id;
  const chatId = ctx.chat.id;

  const staged = stagedCards.get(userId);
  if (!staged || staged.length === 0) {
    await ctx.reply('No staged cards. Approve some cards first.');
    return;
  }

  stagedCards.delete(userId);

  const byFile = new Map<string, { cards: string[]; deckName: string }>();
  for (const { card, filePath, deckName } of staged) {
    const entry = byFile.get(filePath) ?? { cards: [], deckName };
    entry.cards.push(card);
    byFile.set(filePath, entry);
  }

  const pushMsg = await ctx.reply(`Pushing ${staged.length} card${staged.length === 1 ? '' : 's'} to GitHub...`);
  const lines: string[] = [];

  for (const [filePath, { cards, deckName }] of byFile) {
    try {
      const { url, created } = await appendOrCreateFile(githubOwner, githubRepo, filePath, githubToken, cards.join('\n\n---\n\n'));
      lines.push(`${created ? 'Created' : 'Appended to'} \`${filePath}\` (+${cards.length})\n${url}`);
    } catch (err) {
      console.error(err);
      lines.push(`❌ Failed: \`${filePath}\``);
    }
  }

  await ctx.api.editMessageText(chatId, pushMsg.message_id, lines.join('\n\n'), { parse_mode: 'Markdown' });
});

bot.start();
console.log('Bot started');
