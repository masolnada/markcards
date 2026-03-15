import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type ImagePart, type TextPart } from 'ai';

export interface CardGroup {
  filePath: string;
  deckName: string;
  cards: string;
}

export type Source =
  | { type: 'image'; imageBuffer: ArrayBuffer; caption?: string }
  | { type: 'text'; prompt: string };

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

const MODEL = 'gemini-2.5-pro-preview-05-06';

const CLASSIFY_SYSTEM_PROMPT = `Identify all distinct subjects/topics covered in the input. Output ONLY valid JSON array (no markdown fences):
[
  { "filePath": "subject/area/topic.md", "deckName": "Topic Name" }
]
Rules:
- Each distinct topic gets its own entry.
- filePath and deckName must be in English. Format is always subject/area/topic.md (exactly 3 levels, lowercase).`;

const CARD_SYSTEM_PROMPT = `You are a flashcard generator. Given input and a list of topics with their existing cards, produce new atomic Q&A flashcards grouped by topic.

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

function sourceToContent(source: Source, extraText?: string): Array<ImagePart | TextPart> {
  const text = [
    source.type === 'image' ? source.caption : source.prompt,
    extraText,
  ].filter(Boolean).join('\n\n');

  if (source.type === 'image') {
    return [
      { type: 'image', image: new Uint8Array(source.imageBuffer), mediaType: 'image/jpeg' },
      { type: 'text', text: text || 'Process this image.' },
    ];
  }
  return [{ type: 'text', text }];
}

export async function classify(
  source: Source,
): Promise<Array<{ filePath: string; deckName: string }>> {
  const { text } = await generateText({
    model: google(MODEL),
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: sourceToContent(source) }],
  });
  return parseJsonArray(text);
}

const ANALYZE_IMAGE_SYSTEM_PROMPT = `Classify the image. If it contains a plant, identify it. Output ONLY valid JSON (no markdown fences):
- If plant: { "type": "plant", "latinName": "Genus species", "catalanName": "nom comú en català or null" }
- Otherwise: { "type": "other" }
Rules:
- latinName: full scientific binomial name (e.g. "Rosa canina"). Required when type is "plant".
- catalanName: common name in Catalan. Use null if no established Catalan name exists.`;

export type ImageAnalysis =
  | { type: 'plant'; latinName: string; catalanName: string | null }
  | { type: 'other' };

export async function analyzeImage(
  imageBuffer: ArrayBuffer,
  caption?: string,
): Promise<ImageAnalysis> {
  const { text } = await generateText({
    model: google(MODEL),
    system: ANALYZE_IMAGE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: new Uint8Array(imageBuffer), mediaType: 'image/jpeg' },
          { type: 'text', text: caption ?? 'Classify this image.' },
        ],
      },
    ],
  });
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned) as ImageAnalysis;
}

export async function generateCards(
  source: Source,
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
    messages: [{ role: 'user', content: sourceToContent(source, `Topics to generate cards for:\n${context}`) }],
  });

  return parseJsonArray<CardGroup>(text);
}
