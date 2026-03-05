import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';

export interface CardGenerationResult {
  cards: string;
  filePath: string;
  deckName: string;
}

export type ConversationMessage = CoreMessage;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

const MODEL = 'gemini-3.1-pro-preview';

const CARD_SYSTEM_PROMPT = `You are a flashcard generator. Given an image (and optional caption), produce atomic Q&A flashcards in hashcards format.

Output ONLY valid JSON (no markdown fences) with this structure:
{
  "filePath": "subject/area/topic.md",  // e.g. "physics/electromagnetism/electrostatics.md" — always in English
  "deckName": "Topic Name",             // e.g. "Electrostatics" — always in English
  "cards": "---\\n\\nQ: ...\\n\\nA: ...\\n\\n---\\n\\nQ: ...\\n\\nA: ..."
}

Rules:
- Each card must be atomic: one concept per card.
- filePath and deckName must always be in English regardless of source language. Format is always subject/area/topic.md (exactly 3 levels).
- Card content (Q/A) must be in the same language as the source material.
- Each card starts with "---" on its own line, followed by a blank line, then "Q: " and "A: " each separated by blank lines.
- No frontmatter in the cards field.
- filePath must be lowercase, use slashes for hierarchy, end in .md.
- Pay special attention to any text written or highlighted in red — these mark concepts where the student struggled or needed help. Prioritize generating cards for those concepts.`;

const CLASSIFY_SYSTEM_PROMPT = `Given an image, output ONLY valid JSON (no markdown fences):
{
  "filePath": "subject/area/topic.md",
  "deckName": "Topic Name"
}
filePath and deckName must be in English. Format is always subject/area/topic.md (exactly 3 levels, lowercase).`;

function parseJson(raw: string): CardGenerationResult {
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned) as CardGenerationResult;
}

export async function classifyImage(
  imageBuffer: ArrayBuffer,
  caption: string | undefined,
): Promise<{ filePath: string; deckName: string }> {
  const { text } = await generateText({
    model: google(MODEL),
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: new Uint8Array(imageBuffer), mimeType: 'image/jpeg' },
          { type: 'text', text: caption ?? 'Classify this image.' },
        ],
      },
    ],
  });
  const { filePath, deckName } = parseJson(text);
  return { filePath, deckName };
}

export async function generateCards(
  imageBuffer: ArrayBuffer,
  caption: string | undefined,
  existingCards: string | null,
): Promise<CardGenerationResult> {
  const contextNote = existingCards
    ? `\n\nExisting cards in this deck (do NOT repeat these concepts):\n${existingCards}`
    : '';

  const { text } = await generateText({
    model: google(MODEL),
    system: CARD_SYSTEM_PROMPT + contextNote,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: new Uint8Array(imageBuffer), mimeType: 'image/jpeg' },
          { type: 'text', text: caption ?? 'Generate flashcards from this image.' },
        ],
      },
    ],
  });

  return parseJson(text);
}
