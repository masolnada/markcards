import { createHash } from 'crypto';

export type ParsedCardType = 'qa' | 'cloze';

export interface ParsedCard {
  id: string;
  type: ParsedCardType;
  // QA fields
  question?: string;
  answer?: string;
  // Cloze fields
  template?: string;
  clozeIndex?: number;
}

export interface ParsedDeck {
  id: string;
  name: string;
  filePath: string;
  cards: ParsedCard[];
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function qaCardId(q: string, a: string): string {
  return sha256(`qa:${q.trim()}\n${a.trim()}`);
}

function clozeCardId(template: string, idx: number): string {
  return sha256(`cloze:${template.trim()}\n${idx}`);
}

export function deckId(absPath: string): string {
  return sha256(absPath);
}

// Extract bracket groups from a cloze template, return their count
function countBrackets(template: string): number {
  const matches = template.match(/\[([^\]]+)\]/g);
  return matches ? matches.length : 0;
}

export function parseDeck(filePath: string, content: string): ParsedDeck {
  const id = deckId(filePath);
  let name = filePath.split('/').pop()?.replace(/\.md$/, '') ?? 'Unnamed Deck';
  let body = content;

  // Parse optional TOML frontmatter
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const frontmatter = content.slice(3, end);
      const nameMatch = frontmatter.match(/^name\s*=\s*"([^"]+)"/m);
      if (nameMatch) name = nameMatch[1];
      body = content.slice(end + 4); // skip past closing ---
    }
  }

  const cards: ParsedCard[] = [];
  // Split on blank lines or standalone --- separators
  // Normalize line endings
  const lines = body.replace(/\r\n/g, '\n').split('\n');

  // Build "blocks" separated by blank lines or --- lines
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed === '---') {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  for (const block of blocks) {
    // Join block lines; detect whether it's QA or cloze
    const blockText = block.join('\n');

    // Detect cloze: starts with C:
    const clozeMatch = blockText.match(/^C:\s*([\s\S]+)/);
    if (clozeMatch) {
      const template = clozeMatch[1].trim();
      const count = countBrackets(template);
      for (let i = 0; i < count; i++) {
        cards.push({
          id: clozeCardId(template, i),
          type: 'cloze',
          template,
          clozeIndex: i,
        });
      }
      continue;
    }

    // Detect QA: has Q: somewhere
    if (/^Q:/m.test(blockText)) {
      let question = '';
      let answer = '';
      let mode: 'q' | 'a' | null = null;

      for (const line of block) {
        const qMatch = line.match(/^Q:\s*(.*)/);
        const aMatch = line.match(/^A:\s*(.*)/);
        if (qMatch) {
          mode = 'q';
          question = qMatch[1];
        } else if (aMatch) {
          mode = 'a';
          answer = aMatch[1];
        } else {
          // Continuation line
          if (mode === 'q') question += '\n' + line;
          else if (mode === 'a') answer += '\n' + line;
        }
      }

      question = question.trim();
      answer = answer.trim();

      if (question) {
        cards.push({
          id: qaCardId(question, answer),
          type: 'qa',
          question,
          answer,
        });
      }
    }
  }

  return { id, name, filePath, cards };
}
