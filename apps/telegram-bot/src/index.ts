import { Bot } from 'grammy';
import { classify, generateCards, type Source } from './agent.js';
import { getFileContent, appendToInputFile } from './github.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
if (!process.env.GOOGLE_GEMINI_API_KEY) throw new Error('GOOGLE_GEMINI_API_KEY is required');
if (!process.env.GITHUB_REPO) throw new Error('GITHUB_REPO is required');
if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required');

const [githubOwner, githubRepo] = process.env.GITHUB_REPO.split('/');
if (!githubOwner || !githubRepo) throw new Error('GITHUB_REPO must be "owner/repo"');
const githubToken = process.env.GITHUB_TOKEN;
const githubBranch = process.env.GITHUB_BRANCH ?? 'main';
const githubBasePath = process.env.GITHUB_PATH ?? 'cards';

const allowedUsers =
  process.env.ALLOWED_USER_IDS?.split(',').map(Number).filter(Boolean) ?? [];
if (allowedUsers.length === 0) {
  console.warn('Warning: ALLOWED_USER_IDS is not set — bot is open to everyone');
}

interface LastImage {
  imageBuffer: ArrayBuffer;
  caption: string | undefined;
}
const lastImages = new Map<number, LastImage>(); // key: userId

function isAuthorized(userId: number): boolean {
  return allowedUsers.length === 0 || allowedUsers.includes(userId);
}

function splitCards(cards: string): string[] {
  return cards.split(/\n---\n/).map((c) => c.trim()).filter(Boolean);
}

async function sendGeneratedCards(chatId: number, source: Source, placeholder: { message_id: number }) {
  const classified = await classify(source);

  const topics = await Promise.all(
    classified.map(async ({ filePath: relPath, deckName }) => {
      const filePath = `${githubBasePath}/${relPath}`;
      const existingCards = await getFileContent(githubOwner, githubRepo, filePath, githubToken).catch(() => null);
      return { filePath: relPath, deckName, existingCards };
    }),
  );

  const groups = await generateCards(source, topics);

  await bot.api.deleteMessage(chatId, placeholder.message_id);

  const blocks: Array<{ path: string; cardMarkdown: string }> = [];
  for (const group of groups) {
    for (const card of splitCards(group.cards)) {
      blocks.push({ path: group.filePath, cardMarkdown: card });
    }
  }

  if (blocks.length === 0) {
    await bot.api.sendMessage(chatId, 'No cards generated.');
    return;
  }

  await appendToInputFile(githubOwner, githubRepo, githubBranch, githubToken, githubBasePath, blocks);
  await bot.api.sendMessage(chatId, `Added ${blocks.length} card${blocks.length === 1 ? '' : 's'} to input`);
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

  const source: Source = { type: 'image', imageBuffer, caption: ctx.message.caption };
  lastImages.set(userId, { imageBuffer, caption: ctx.message.caption });

  const placeholder = await ctx.reply('Generating cards...');
  try {
    await sendGeneratedCards(chatId, source, placeholder);
  } catch (err) {
    console.error(err);
    await ctx.api.editMessageText(chatId, placeholder.message_id, 'Something went wrong generating cards.');
  }
});

bot.command('more', async (ctx) => {
  if (!isAuthorized(ctx.from!.id)) return;
  const userId = ctx.from!.id;
  const chatId = ctx.chat.id;

  const last = lastImages.get(userId);
  if (!last) {
    await ctx.reply('No previous image. Send a photo first.');
    return;
  }

  const placeholder = await ctx.reply('Generating more cards...');
  try {
    await sendGeneratedCards(chatId, { type: 'image', imageBuffer: last.imageBuffer, caption: last.caption }, placeholder);
  } catch (err) {
    console.error(err);
    await ctx.api.editMessageText(chatId, placeholder.message_id, 'Something went wrong generating cards.');
  }
});

bot.on('message:text', async (ctx) => {
  if (!isAuthorized(ctx.from.id)) return;
  const chatId = ctx.chat.id;

  const placeholder = await ctx.reply('Generating cards...');
  try {
    await sendGeneratedCards(chatId, { type: 'text', prompt: ctx.message.text }, placeholder);
  } catch (err) {
    console.error(err);
    await ctx.api.editMessageText(chatId, placeholder.message_id, 'Something went wrong generating cards.');
  }
});

bot.start();
console.log('Bot started');
