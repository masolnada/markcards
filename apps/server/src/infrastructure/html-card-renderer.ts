import { relative, dirname } from 'path';
import { marked } from 'marked';
import katex from 'katex';
import type { Card, Deck } from '../domain/card.js';
import type { CardRenderer, RenderedCard } from '../application/ports/card-renderer.js';

interface RendererConfig {
  decksDir: string;
  githubBranch: string;
}

function renderMath(text: string): string {
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="math-error">$$${expr}$$</span>`;
    }
  });

  text = text.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="math-error">$${expr}$</span>`;
    }
  });

  return text;
}

function renderMarkdown(raw: string, imageBaseUrl: string): string {
  const withMath = renderMath(raw);
  const renderer = new marked.Renderer();
  renderer.image = (href: string, title: string | null, text: string) => {
    const src = href && !href.startsWith('http') && !href.startsWith('/')
      ? `${imageBaseUrl}/${href}`
      : href;
    const titleAttr = title ? ` title="${title}"` : '';
    return `<img src="${src}" alt="${text}"${titleAttr}>`;
  };
  return marked.parse(withMath, { async: false, renderer }) as string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderClozePrompt(template: string, idx: number, imageBaseUrl: string): string {
  let i = 0;
  const result = template.replace(/\[([^\]]+)\]/g, (_, word: string) => {
    const isTarget = i === idx;
    i++;
    return isTarget
      ? `<span class="cloze-blank">_____</span>`
      : `<span class="cloze-shown">${escapeHtml(word)}</span>`;
  });
  return renderMarkdown(result, imageBaseUrl);
}

function renderClozeReveal(template: string, idx: number, imageBaseUrl: string): string {
  let i = 0;
  const result = template.replace(/\[([^\]]+)\]/g, (_, word: string) => {
    const isTarget = i === idx;
    i++;
    return isTarget
      ? `<span class="cloze-answer">${escapeHtml(word)}</span>`
      : `<span class="cloze-shown">${escapeHtml(word)}</span>`;
  });
  return renderMarkdown(result, imageBaseUrl);
}

export class HtmlCardRenderer implements CardRenderer {
  constructor(private config: RendererConfig) {}

  render(card: Card, deck: Deck): RenderedCard {
    const imageBaseUrl = this.imageBaseUrl(deck);

    if (card.type === 'qa') {
      const questionHtml = renderMarkdown(card.question ?? '', imageBaseUrl);
      const answerHtml = renderMarkdown(card.answer ?? '', imageBaseUrl);
      return {
        cardId: card.id,
        deckId: deck.id,
        deckName: deck.name,
        type: 'qa',
        promptHtml: questionHtml,
        revealHtml: answerHtml,
        questionHtml,
      };
    } else {
      const template = card.template ?? '';
      const idx = card.clozeIndex ?? 0;
      return {
        cardId: card.id,
        deckId: deck.id,
        deckName: deck.name,
        type: 'cloze',
        promptHtml: renderClozePrompt(template, idx, imageBaseUrl),
        revealHtml: renderClozeReveal(template, idx, imageBaseUrl),
      };
    }
  }

  private imageBaseUrl(deck: Deck): string {
    if (deck.filePath.startsWith('github:')) {
      const withoutPrefix = deck.filePath.slice('github:'.length);
      const [owner, repo, ...parts] = withoutPrefix.split('/');
      const deckDir = parts.slice(0, -1).join('/');
      const base = `https://raw.githubusercontent.com/${owner}/${repo}/${this.config.githubBranch}`;
      return deckDir ? `${base}/${deckDir}` : base;
    } else {
      const rel = relative(this.config.decksDir, dirname(deck.filePath));
      return rel ? `/decks/${rel}` : '/decks';
    }
  }
}
