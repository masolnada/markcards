import { api, type DeckSummary } from '../api.js';

export async function renderDeckList(container: HTMLElement): Promise<void> {
  container.innerHTML = `<div class="flex justify-center py-10">
    <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
  </div>`;

  let decks: DeckSummary[];
  try {
    decks = await api.getDecks();
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-red-500">Failed to load decks: ${err}</div>`;
    return;
  }

  if (decks.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
        <div class="text-6xl mb-4">📚</div>
        <h2 class="text-xl font-semibold mb-2">No decks found</h2>
        <p class="text-sm text-center max-w-xs">
          Add <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">.md</code> files
          to your decks directory to get started.
        </p>
      </div>`;
    return;
  }

  const totalDue = decks.reduce((sum, d) => sum + d.stats.due, 0);

  container.innerHTML = `
    <div class="max-w-lg mx-auto px-4 py-6">
      <h1 class="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">All Decks</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
        ${totalDue} card${totalDue !== 1 ? 's' : ''} due today across ${decks.length} deck${decks.length !== 1 ? 's' : ''}
      </p>
      <div class="space-y-3" id="deck-list"></div>
    </div>`;

  const list = container.querySelector('#deck-list')!;

  for (const deck of decks) {
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm';
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <h2 class="font-semibold text-gray-900 dark:text-gray-100 truncate">${escHtml(deck.name)}</h2>
          <div class="flex gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>${deck.stats.total} total</span>
            <span class="${deck.stats.due > 0 ? 'text-orange-500 dark:text-orange-400 font-medium' : ''}">${deck.stats.due} due</span>
            <span>${deck.stats.newCards} new</span>
          </div>
        </div>
        ${deck.stats.due > 0
          ? `<a href="#/review?deck=${deck.id}" class="ml-3 flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              Review ${deck.stats.due}
            </a>`
          : `<span class="ml-3 flex-shrink-0 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-sm rounded-lg">Done</span>`
        }
      </div>`;
    list.appendChild(card);
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
