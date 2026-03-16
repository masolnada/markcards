import { Bot, InlineKeyboard } from 'grammy';
import { classify, generateCards, analyzeImage, type Source, type ImageAnalysis } from './agent.js';
import { getFileContent, appendToInputFile, uploadFile } from './github.js';
import { identifyPlant, type PlantResult } from './plantnet.js';

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

const plantnetApiKey = process.env.PLANTNET_API_KEY ?? null;

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

interface PendingPlant {
  imageBuffer: ArrayBuffer;
  results: PlantResult[];
}
const pendingPlants = new Map<number, PendingPlant>(); // key: userId

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

async function savePlantAndCreateCards(
  chatId: number,
  imageBuffer: ArrayBuffer,
  result: PlantResult,
  placeholder: { message_id: number },
): Promise<void> {
  const filename = result.latinName.toLowerCase().replace(/\s+/g, '-') + '.jpg';
  const imagePath = `${githubBasePath}/plants/images/${filename}`;
  await uploadFile(githubOwner, githubRepo, githubBranch, githubToken, imagePath, imageBuffer);

  const imgRef = `![](images/${filename})`;
  const blocks: Array<{ path: string; cardMarkdown: string }> = [];

  if (result.commonName) {
    const commonName = result.commonName.charAt(0).toUpperCase() + result.commonName.slice(1);
    blocks.push({
      path: 'plants/plant-recognition.md',
      cardMarkdown: `Q: Nom en **Català**?\n\n${imgRef}\nA: ${commonName}.`,
    });
  }

  blocks.push({
    path: 'plants/plant-recognition.md',
    cardMarkdown: `Q: Nom en **Llatí**?\n\n${imgRef}\nA: *${result.latinName}*.`,
  });

  await appendToInputFile(githubOwner, githubRepo, githubBranch, githubToken, githubBasePath, blocks);
  await bot.api.deleteMessage(chatId, placeholder.message_id);
  await bot.api.sendMessage(chatId, `Added ${blocks.length} plant card${blocks.length === 1 ? '' : 's'} to input`);
}

async function sendPlantCards(
  chatId: number,
  imageBuffer: ArrayBuffer,
  plant: Extract<ImageAnalysis, { type: 'plant' }>,
  placeholder: { message_id: number },
): Promise<void> {
  await savePlantAndCreateCards(
    chatId,
    imageBuffer,
    { latinName: plant.latinName, commonName: plant.catalanName, score: 1 },
    placeholder,
  );
}

async function findCatalanWikipediaUrl(latinName: string): Promise<string | null> {
  const url = `https://ca.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(latinName)}&format=json&redirects=1`;
  const data = await fetch(url).then((r) => r.json()) as { query: { pages: Record<string, { missing?: string }> } };
  const pages = data.query.pages;
  const page = Object.values(pages)[0];
  if (!page || 'missing' in page) return null;
  return `https://ca.wikipedia.org/wiki/${encodeURIComponent(latinName.replace(/ /g, '_'))}`;
}

async function plantInfoUrl(latinName: string): Promise<string> {
  const wiki = await findCatalanWikipediaUrl(latinName);
  if (wiki) return wiki;
  return `https://search.brave.com/images?q=${encodeURIComponent(latinName)}`;
}

async function sendPlantOptions(chatId: number, results: PlantResult[]): Promise<void> {
  const lines = await Promise.all(results.map(async (r, i) => {
    const pct = Math.round(r.score * 100);
    const infoUrl = await plantInfoUrl(r.latinName);
    const isWiki = infoUrl.includes('wikipedia');
    const linkLabel = isWiki ? 'Wikipedia' : 'Brave Imatges';
    return `${i + 1}\\. *${r.latinName.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')}* \\(${pct}%\\) · [${linkLabel}](${infoUrl})`;
  }));

  const text = `🌿 Quina planta és?\n\n${lines.join('\n')}`;

  const keyboard = new InlineKeyboard();
  for (let i = 0; i < results.length; i++) {
    keyboard.text(results[i].latinName, `plant:${i}`).row();
  }

  await bot.api.sendMessage(chatId, text, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard,
  });
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

  const caption = ctx.message.caption;
  const source: Source = { type: 'image', imageBuffer, caption };
  lastImages.set(userId, { imageBuffer, caption });

  const placeholder = await ctx.reply('Generating cards...');
  try {
    const analysis = await analyzeImage(imageBuffer, caption);
    if (analysis.type === 'plant') {
      if (plantnetApiKey) {
        const results = await identifyPlant(imageBuffer, plantnetApiKey);
        if (results.length > 0) {
          pendingPlants.set(userId, { imageBuffer, results });
          await bot.api.deleteMessage(chatId, placeholder.message_id);
          await sendPlantOptions(chatId, results);
          return;
        }
      }
      await sendPlantCards(chatId, imageBuffer, analysis, placeholder);
    } else {
      await sendGeneratedCards(chatId, source, placeholder);
    }
  } catch (err) {
    console.error(err);
    await ctx.api.editMessageText(chatId, placeholder.message_id, 'Something went wrong generating cards.');
  }
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('plant:')) return;
  const idx = parseInt(data.split(':')[1], 10);
  const userId = ctx.from.id;
  const pending = pendingPlants.get(userId);
  if (!pending) {
    await ctx.answerCallbackQuery('Session expired.');
    return;
  }

  const selected = pending.results[idx];
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`✅ *${selected.latinName}* seleccionat\\.`, { parse_mode: 'MarkdownV2' });

  const placeholder = await ctx.reply('Desant planta...');
  try {
    await savePlantAndCreateCards(ctx.chat!.id, pending.imageBuffer, selected, placeholder);
  } catch (err) {
    console.error(err);
    await bot.api.editMessageText(ctx.chat!.id, placeholder.message_id, 'Something went wrong.');
  } finally {
    pendingPlants.delete(userId);
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
