import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

export interface CardGroup {
  filePath: string;
  deckName: string;
  cards: string;
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

const MODEL = 'gemini-3.1-pro-preview';

const CLASSIFY_SYSTEM_PROMPT = `Given an image, identify all distinct subjects/topics covered. Output ONLY valid JSON array (no markdown fences):
[
  { "filePath": "subject/area/topic.md", "deckName": "Topic Name" }
]
Rules:
- Each distinct topic gets its own entry.
- filePath and deckName must be in English. Format is always subject/area/topic.md (exactly 3 levels, lowercase).`;

const CARD_SYSTEM_PROMPT = `You are a flashcard generator. Given an image and a list of topics with their existing cards, produce new atomic Q&A flashcards grouped by topic.

Output ONLY valid JSON array (no markdown fences):
[
  {
    "filePath": "subject/area/topic.md",
    "deckName": "Topic Name",
    "cards": "---\\n\\nQ: ...\\nA: ...\\n\\n---\\n\\nQ: ...\\nA: ..."
  }
]

Rules:
- Each card must be atomic: one concept per card.
- filePath and deckName must always be in English. Format is always subject/area/topic.md (exactly 3 levels, lowercase).
- Card content (Q/A) must be in the same language as the source material.
- Each card starts with "---" followed by a blank line, then "Q: " and "A: " on consecutive lines (no blank line between Q and A).
- Do NOT generate cards for concepts already covered in the existing cards provided.
- Pay special attention to any text written or highlighted in red — these mark concepts where the student struggled or needed help. Prioritize generating cards for those concepts.`;

function parseJsonArray<T>(raw: string): T[] {
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned) as T[];
}

export async function classifyImage(
  imageBuffer: ArrayBuffer,
  caption: string | undefined,
): Promise<Array<{ filePath: string; deckName: string }>> {
  const { text } = await generateText({
    model: google(MODEL),
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: new Uint8Array(imageBuffer), mimeType: 'image/jpeg' },
          { type: 'text', text: caption ?? 'Identify all topics in this image.' },
        ],
      },
    ],
  });
  return parseJsonArray(text);
}

export async function generateCards(
  imageBuffer: ArrayBuffer,
  caption: string | undefined,
  topics: Array<{ filePath: string; deckName: string; existingCards: string | null }>,
): Promise<CardGroup[]> {
  const context = topics
    .map(({ filePath, deckName, existingCards }) =>
      existingCards
        ? `Topic: ${deckName} (${filePath})\nExisting cards (do not repeat):\n${existingCards}`
        : `Topic: ${deckName} (${filePath})\nNo existing cards.`,
    )
    .join('\n\n---\n\n');

  const { text } = await generateText({
    model: google(MODEL),
    system: CARD_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: new Uint8Array(imageBuffer), mimeType: 'image/jpeg' },
          { type: 'text', text: `${caption ? caption + '\n\n' : ''}Topics to generate cards for:\n${context}` },
        ],
      },
    ],
  });

  return parseJsonArray<CardGroup>(text);
}
