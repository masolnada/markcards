import { createHash } from 'crypto';

export interface InputCard {
  id: string;
  destPath: string;
  rawMarkdown: string;
}

function inputCardId(destPath: string, rawMarkdown: string): string {
  return createHash('sha256').update(`input:${destPath}:${rawMarkdown.trim()}`).digest('hex');
}

export function parseInputFile(content: string): InputCard[] {
  if (!content.trim()) return [];

  const segments = content.split('\n---\n');
  const cards: InputCard[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const pathMatch = trimmed.match(/^# path:\s*(.+)/);
    if (!pathMatch) continue;

    const destPath = pathMatch[1].trim();
    const rawMarkdown = trimmed.slice(pathMatch[0].length).trim();
    if (!rawMarkdown) continue;

    cards.push({
      id: inputCardId(destPath, rawMarkdown),
      destPath,
      rawMarkdown,
    });
  }

  return cards;
}

export function removeInputCard(content: string, cardId: string): string {
  const segments = content.split('\n---\n');
  const kept = segments.filter(segment => {
    const trimmed = segment.trim();
    if (!trimmed) return false;

    const pathMatch = trimmed.match(/^# path:\s*(.+)/);
    if (!pathMatch) return true; // keep non-card segments as-is

    const destPath = pathMatch[1].trim();
    const rawMarkdown = trimmed.slice(pathMatch[0].length).trim();
    return inputCardId(destPath, rawMarkdown) !== cardId;
  });

  return kept.join('\n---\n');
}
