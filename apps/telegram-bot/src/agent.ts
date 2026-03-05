import { google } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';

export interface CardGenerationResult {
  cards: string;
  filePath: string;
  deckName: string;
}

export type ConversationMessage = CoreMessage;

const MODEL = 'gemini-3.1-pro-preview';

const CARD_SYSTEM_PROMPT = `You are a flashcard generator. Given an image (and optional caption), produce atomic Q&A flashcards in hashcards format.

Output ONLY valid JSON (no markdown fences) with this structure:
{
  "filePath": "subject/topic.md",  // e.g. "physics/electrostatics.md"
  "deckName": "Topic Name",        // e.g. "Electrostatics"
  "cards": "---\n\nQ: ...\n\nA: ...\n\n---\n\nQ: ...\n\nA: ..."
}

Rules:
- Each card must be atomic: one concept per card.
- Use the same language as the source material.
- Each card starts with "---" on its own line, followed by a blank line, then "Q: " and "A: " each separated by blank lines.
- No frontmatter in the cards field.
- filePath must be lowercase, use slashes for hierarchy, end in .md.`;

function parseJson(raw: string): CardGenerationResult {
  // Strip ```json fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned) as CardGenerationResult;
}

export async function generateCards(
  imageBuffer: ArrayBuffer,
  caption: string | undefined,
  history: ConversationMessage[],
): Promise<{ result: CardGenerationResult; updatedHistory: ConversationMessage[] }> {
  const userContent: CoreMessage['content'] = [
    { type: 'image', image: new Uint8Array(imageBuffer), mimeType: 'image/jpeg' },
    { type: 'text', text: caption ?? 'Generate flashcards from this image.' },
  ];

  const messages: ConversationMessage[] = [
    ...history,
    { role: 'user', content: userContent },
  ];

  const { text } = await generateText({
    model: google(MODEL),
    system: CARD_SYSTEM_PROMPT,
    messages,
  });

  const result = parseJson(text);
  const updatedHistory: ConversationMessage[] = [
    ...messages,
    { role: 'assistant', content: text },
  ];

  return { result, updatedHistory };
}

export async function generateCardCorrection(
  correction: string,
  history: ConversationMessage[],
): Promise<{ result: CardGenerationResult; updatedHistory: ConversationMessage[] }> {
  const messages: ConversationMessage[] = [
    ...history,
    { role: 'user', content: correction },
  ];

  const { text } = await generateText({
    model: google(MODEL),
    system: CARD_SYSTEM_PROMPT,
    messages,
  });

  const result = parseJson(text);
  const updatedHistory: ConversationMessage[] = [
    ...messages,
    { role: 'assistant', content: text },
  ];

  return { result, updatedHistory };
}

export async function chat(
  text: string,
  history: ConversationMessage[],
): Promise<{ reply: string; updatedHistory: ConversationMessage[] }> {
  const messages: ConversationMessage[] = [
    ...history,
    { role: 'user', content: text },
  ];

  const { text: reply } = await generateText({
    model: google(MODEL),
    messages,
  });

  const updatedHistory: ConversationMessage[] = [
    ...messages,
    { role: 'assistant', content: reply },
  ];

  return { reply, updatedHistory };
}
