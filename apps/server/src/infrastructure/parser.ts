import { createHash } from 'crypto';
import type { Card, Deck, CardType } from '../domain/card.js';

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

function countBrackets(template: string): number {
  const matches = template.match(/\[([^\]]+)\]/g);
  return matches ? matches.length : 0;
}

export function parseDeck(filePath: string, content: string): Deck {
  const id = deckId(filePath);
  let name = filePath.split('/').pop()?.replace(/\.md$/, '') ?? 'Unnamed Deck';
  let maxNewPerDay: number | undefined;
  let body = content;

  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const frontmatter = content.slice(3, end);
      const nameMatch = frontmatter.match(/^name\s*=\s*"([^"]+)"/m);
      if (nameMatch) name = nameMatch[1];
      const maxNewMatch = frontmatter.match(/^max_new\s*=\s*(\d+)/m);
      if (maxNewMatch) maxNewPerDay = parseInt(maxNewMatch[1], 10);
      body = content.slice(end + 4);
    }
  }

  const cards: Card[] = [];
  const lines = body.replace(/\r\n/g, '\n').split('\n');

  const blocks: string[][] = [];
  let current: string[] = [];
  let inQBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '---') {
      if (current.length > 0) blocks.push(current);
      current = [];
      inQBlock = false;
    } else if (trimmed === '') {
      if (inQBlock) {
        current.push(line);
      } else {
        if (current.length > 0) blocks.push(current);
        current = [];
      }
    } else {
      if (/^Q:/i.test(trimmed)) inQBlock = true;
      if (/^A:/i.test(trimmed)) inQBlock = false;
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  for (const block of blocks) {
    const blockText = block.join('\n');

    const clozeMatch = blockText.match(/^C:\s*([\s\S]+)/);
    if (clozeMatch) {
      const template = clozeMatch[1].trim();
      const count = countBrackets(template);
      for (let i = 0; i < count; i++) {
        cards.push({
          id: clozeCardId(template, i),
          type: 'cloze' as CardType,
          template,
          clozeIndex: i,
        });
      }
      continue;
    }

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
          if (mode === 'q') question += '\n' + line;
          else if (mode === 'a') answer += '\n' + line;
        }
      }

      question = question.trim();
      answer = answer.trim();

      if (question) {
        cards.push({
          id: qaCardId(question, answer),
          type: 'qa' as CardType,
          question,
          answer,
        });
      }
    }
  }

  return { id, name, filePath, cards, ...(maxNewPerDay !== undefined ? { maxNewPerDay } : {}) };
}
