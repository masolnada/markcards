import { renderReviewPage } from './pages/review.js';
import { renderDeckList } from './pages/deck-list.js';

function getContainer(): HTMLElement {
  const el = document.getElementById('app');
  if (!el) throw new Error('Missing #app element');
  return el;
}

function parseHash(): { path: string; params: URLSearchParams } {
  const hash = window.location.hash.slice(1) || '/';
  const [path, query] = hash.split('?');
  return { path: path || '/', params: new URLSearchParams(query ?? '') };
}

function route() {
  const container = getContainer();
  const { path, params } = parseHash();

  // Remove any previously registered keydown handlers by replacing the container
  // (done by each page's cleanup logic)

  if (path === '/decks') {
    renderDeckList(container);
  } else {
    // Default: review page (handles no-cards case with done screen)
    const deckId = params.get('deck') ?? undefined;
    renderReviewPage(container, deckId);
  }
}

declare const __APP_VERSION__: string;

function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  nav.innerHTML = `
    <div class="max-w-lg mx-auto px-4 flex items-center justify-between h-14">
      <a href="#/" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        <span class="font-bold text-lg text-gray-900 dark:text-gray-100 block leading-tight">Markcards</span>
        <span class="text-[10px] text-gray-400 dark:text-gray-500 leading-none">v${__APP_VERSION__}</span>
      </a>
      <a href="#/decks" class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
        Decks
      </a>
    </div>`;
}

window.addEventListener('hashchange', route);
window.addEventListener('load', () => {
  renderNav();
  route();
});
