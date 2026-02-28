import { api, type RenderedCard } from '../api.js';

type ReviewState = 'loading' | 'front' | 'back' | 'done';

interface SessionStats {
  reviewed: number;
  passed: number;
  failed: number;
}

export async function renderReviewPage(container: HTMLElement, deckId?: string): Promise<void> {
  let state: ReviewState = 'loading';
  let cards: RenderedCard[] = [];
  let current = 0;
  const stats: SessionStats = { reviewed: 0, passed: 0, failed: 0 };

  function setLoading() {
    container.innerHTML = `
      <div class="flex justify-center py-10">
        <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>`;
  }

  function setDone() {
    state = 'done';
    container.innerHTML = `
      <div class="max-w-lg mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div class="text-5xl mb-4">✓</div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">All done for today!</h1>
        <p class="text-gray-500 dark:text-gray-400 mb-8 text-sm">Great session. Keep it up!</p>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 w-full mb-6">
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-3xl font-bold text-gray-900 dark:text-gray-100">${stats.reviewed}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Reviewed</div>
            </div>
            <div>
              <div class="text-3xl font-bold text-green-600 dark:text-green-400">${stats.passed}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Passed</div>
            </div>
            <div>
              <div class="text-3xl font-bold text-red-500 dark:text-red-400">${stats.failed}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Failed</div>
            </div>
          </div>
        </div>
        <a href="#/decks" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors">
          Browse Decks
        </a>
      </div>`;
    cleanup();
  }

  function renderFront(card: RenderedCard) {
    state = 'front';
    const remaining = cards.length - current;
    const total = cards.length + stats.reviewed;
    const progress = total > 0 ? (stats.reviewed / total) * 100 : 0;

    container.innerHTML = `
      <div class="max-w-lg mx-auto px-4 py-4 flex flex-col min-h-[calc(100vh-4rem)]">
        <!-- Progress -->
        <div class="mb-4">
          <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <span>${remaining} remaining</span>
            <span class="text-xs">${escHtml(card.deckName)}</span>
          </div>
          <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 rounded-full transition-all duration-300" style="width:${progress}%"></div>
          </div>
        </div>

        <!-- Card -->
        <div class="flex-1 flex items-center justify-center">
          <div class="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 md:p-8">
            <div class="card-content text-lg text-gray-900 dark:text-gray-100 leading-relaxed">${card.promptHtml}</div>
          </div>
        </div>

        <!-- Action -->
        <div class="mt-4 pb-4">
          <button
            id="btn-show"
            class="w-full h-14 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold text-base rounded-xl hover:opacity-90 transition-opacity"
          >
            Show Answer <span class="text-xs opacity-60 ml-1">[Space]</span>
          </button>
        </div>
      </div>`;

    document.getElementById('btn-show')?.addEventListener('click', () => renderBack(card));
  }

  function renderBack(card: RenderedCard) {
    state = 'back';
    const remaining = cards.length - current;
    const total = cards.length + stats.reviewed;
    const progress = total > 0 ? (stats.reviewed / total) * 100 : 0;

    container.innerHTML = `
      <div class="max-w-lg mx-auto px-4 py-4 flex flex-col min-h-[calc(100vh-4rem)]">
        <!-- Progress -->
        <div class="mb-4">
          <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <span>${remaining} remaining</span>
            <span class="text-xs">${escHtml(card.deckName)}</span>
          </div>
          <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 rounded-full transition-all duration-300" style="width:${progress}%"></div>
          </div>
        </div>

        <!-- Card (revealed) -->
        <div class="flex-1 flex items-center justify-center">
          <div class="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 md:p-8">
            <div class="card-content text-lg text-gray-900 dark:text-gray-100 leading-relaxed">${card.revealHtml}</div>
          </div>
        </div>

        <!-- Rating buttons -->
        <div class="mt-4 pb-4 grid grid-cols-2 gap-3">
          <button
            id="btn-fail"
            class="h-14 bg-red-500 hover:bg-red-600 text-white font-semibold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>✗ Fail</span><span class="text-xs opacity-60">[←]</span>
          </button>
          <button
            id="btn-pass"
            class="h-14 bg-green-600 hover:bg-green-700 text-white font-semibold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>✓ Pass</span><span class="text-xs opacity-60">[→]</span>
          </button>
        </div>
      </div>`;

    document.getElementById('btn-fail')?.addEventListener('click', () => submitRating(card, false));
    document.getElementById('btn-pass')?.addEventListener('click', () => submitRating(card, true));
  }

  async function submitRating(card: RenderedCard, pass: boolean) {
    // Optimistically advance
    stats.reviewed++;
    if (pass) stats.passed++;
    else stats.failed++;

    current++;

    // Fire & forget the API call — don't block the UX
    api.submitReview(card.cardId, pass).catch(err => {
      console.error('Failed to submit review:', err);
    });

    if (current >= cards.length) {
      setDone();
    } else {
      renderFront(cards[current]);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (state === 'front' && e.key === ' ') {
      e.preventDefault();
      const card = cards[current];
      if (card) renderBack(card);
    } else if (state === 'back') {
      if (e.key === 'ArrowLeft') {
        const card = cards[current];
        if (card) submitRating(card, false);
      } else if (e.key === 'ArrowRight') {
        const card = cards[current];
        if (card) submitRating(card, true);
      }
    }
  }

  function cleanup() {
    document.removeEventListener('keydown', onKeyDown);
  }

  document.addEventListener('keydown', onKeyDown);

  // Load queue
  setLoading();
  try {
    const queue = await api.getReviewQueue();
    cards = queue.cards;
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-red-500">Failed to load review queue: ${err}</div>`;
    cleanup();
    return;
  }

  if (cards.length === 0) {
    setDone();
  } else {
    renderFront(cards[0]);
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
