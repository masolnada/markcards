import { Bot, InlineKeyboard } from 'grammy';
import { generateCards, generateCardCorrection, chat, type ConversationMessage } from './agent.js';
import { appendOrCreateFile } from './github.js';

// --- Env validation ---
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

// --- State ---
interface PendingState {
  cards: string;
  filePath: string;
  deckName: string;
  imageBuffer: ArrayBuffer;
  history: ConversationMessage[];
  promptMessageId: number;
}
const pendingStates = new Map<number, PendingState>();

// --- Helpers ---
function isAuthorized(userId: number): boolean {
  return allowedUsers.length === 0 || allowedUsers.includes(userId);
}

function buildCardsMessage(cards: string, filePath: string): string {
  return `📁 \`${filePath}\`\n\n${cards}`;
}

const pushDiscardKeyboard = new InlineKeyboard()
  .text('✅ Push', 'push')
  .text('❌ Discard', 'discard');

// --- Bot ---
const bot = new Bot(token);

bot.on('message:photo', async (ctx) => {
  if (!isAuthorized(ctx.from.id)) return;
  const userId = ctx.from.id;

  pendingStates.delete(userId);

  const photo = ctx.message.photo.at(-1)!;
  const file = await ctx.api.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const imageBuffer = await fetch(fileUrl).then((r) => r.arrayBuffer());
  const caption = ctx.message.caption;

  const placeholder = await ctx.reply('Analyzing image...');

  try {
    const { result, updatedHistory } = await generateCards(imageBuffer, caption, []);
    const filePath = `${githubBasePath}/${result.filePath}`;
    const text = buildCardsMessage(result.cards, filePath);

    await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, text, {
      reply_markup: pushDiscardKeyboard,
      parse_mode: 'Markdown',
    });

    pendingStates.set(userId, {
      cards: result.cards,
      filePath,
      deckName: result.deckName,
      imageBuffer,
      history: updatedHistory,
      promptMessageId: placeholder.message_id,
    });
  } catch (err) {
    console.error(err);
    await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, 'Something went wrong analyzing the image.');
  }
});

bot.on('message:text', async (ctx) => {
  if (!isAuthorized(ctx.from.id)) return;
  const userId = ctx.from.id;
  const pending = pendingStates.get(userId);

  if (pending) {
    const ephemeral = await ctx.reply('Regenerating...');
    try {
      const { result, updatedHistory } = await generateCardCorrection(ctx.message.text, pending.history);
      const filePath = `${githubBasePath}/${result.filePath}`;
      const text = buildCardsMessage(result.cards, filePath);

      await ctx.api.editMessageText(ctx.chat.id, pending.promptMessageId, text, {
        reply_markup: pushDiscardKeyboard,
        parse_mode: 'Markdown',
      });
      await ctx.api.deleteMessage(ctx.chat.id, ephemeral.message_id);

      pendingStates.set(userId, {
        ...pending,
        cards: result.cards,
        filePath,
        deckName: result.deckName,
        history: updatedHistory,
      });
    } catch (err) {
      console.error(err);
      await ctx.api.editMessageText(ctx.chat.id, ephemeral.message_id, 'Something went wrong regenerating cards.');
    }
    return;
  }

  try {
    const { reply } = await chat(ctx.message.text, []);
    await ctx.reply(reply);
  } catch (err) {
    console.error(err);
    await ctx.reply('Something went wrong.');
  }
});

bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery();

  const userId = ctx.from.id;
  const chatId = ctx.chat?.id ?? ctx.callbackQuery.message?.chat.id;
  const messageId = ctx.callbackQuery.message?.message_id;

  if (!chatId || !messageId) return;

  const pending = pendingStates.get(userId);

  if (!pending) {
    await ctx.api.editMessageReplyMarkup(chatId, messageId, { reply_markup: undefined });
    await ctx.reply('Session expired.');
    return;
  }

  // Remove inline buttons
  await ctx.api.editMessageReplyMarkup(chatId, messageId, { reply_markup: undefined });
  pendingStates.delete(userId);

  const action = ctx.callbackQuery.data;

  if (action === 'discard') {
    await ctx.reply('Cards discarded.');
    return;
  }

  if (action === 'push') {
    const pushMsg = await ctx.reply('Pushing to GitHub...');
    try {
      const { url, created } = await appendOrCreateFile(
        githubOwner,
        githubRepo,
        pending.filePath,
        githubToken,
        pending.cards,
        pending.deckName,
      );
      const verb = created ? 'Created' : 'Appended to';
      await ctx.api.editMessageText(
        chatId,
        pushMsg.message_id,
        `${verb} \`${pending.filePath}\`\n${url}`,
        { parse_mode: 'Markdown' },
      );
    } catch (err) {
      console.error(err);
      await ctx.api.editMessageText(chatId, pushMsg.message_id, 'Failed to push to GitHub.');
    }
  }
});

bot.start();
console.log('Bot started');
