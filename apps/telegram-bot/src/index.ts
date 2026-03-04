import { Bot } from "grammy";
import { runAgent } from "./agent.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedUsers =
  process.env.ALLOWED_USER_IDS?.split(",").map(Number).filter(Boolean) ?? [];

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

if (allowedUsers.length === 0) {
  console.warn("Warning: ALLOWED_USER_IDS is not set — bot is open to everyone");
}

const bot = new Bot(token);

function isAuthorized(userId: number): boolean {
  return allowedUsers.length === 0 || allowedUsers.includes(userId);
}

bot.on("message:photo", async (ctx) => {
  if (!isAuthorized(ctx.from.id)) return;

  const photo = ctx.message.photo.at(-1)!;
  const file = await ctx.api.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

  const imageBuffer = await fetch(fileUrl).then((r) => r.arrayBuffer());
  const text = ctx.message.caption;

  try {
    const reply = await runAgent({ imageBuffer, text });
    await ctx.reply(reply);
  } catch (err) {
    console.error(err);
    await ctx.reply("Something went wrong analyzing the image.");
  }
});

bot.on("message:text", async (ctx) => {
  if (!isAuthorized(ctx.from.id)) return;

  try {
    const reply = await runAgent({ text: ctx.message.text });
    await ctx.reply(reply);
  } catch (err) {
    console.error(err);
    await ctx.reply("Something went wrong.");
  }
});

bot.start();
console.log("Bot started");
