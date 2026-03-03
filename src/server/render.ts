import { marked } from 'marked';
import katex from 'katex';

// Pre-process inline and block math before passing to marked
function renderMath(text: string): string {
  // Block math: $$...$$ — must come before inline to avoid double-match
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="math-error">$$${expr}$$</span>`;
    }
  });

  // Inline math: $...$
  text = text.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="math-error">$${expr}$</span>`;
    }
  });

  return text;
}

export function renderMarkdown(raw: string, imageBaseUrl: string): string {
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

// Cloze: render with bracket[idx] as blank, others shown
export function renderClozePrompt(template: string, idx: number, imageBaseUrl: string): string {
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

// Cloze: render with bracket[idx] revealed, others shown
export function renderClozeReveal(template: string, idx: number, imageBaseUrl: string): string {
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
