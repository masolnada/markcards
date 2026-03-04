import { readFileSync, watch, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { parseDeck, type ParsedDeck } from './parser.js';
import { ensureCard } from './db.js';
import { config } from './config.js';
import { fetchGitHubDecks, type GitHubConfig } from './github.js';

const registry = new Map<string, ParsedDeck>();

let lastSyncAt = 0;

export function clearDecks(): void {
  registry.clear();
  lastSyncAt = 0;
}

export function getDeck(id: string): ParsedDeck | undefined {
  return registry.get(id);
}

export function getAllDecks(): ParsedDeck[] {
  return Array.from(registry.values());
}

function loadFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf8');
    const deck = parseDeck(filePath, content);
    registry.set(deck.id, deck);

    // Ensure all cards exist in DB (new cards get default state)
    const now = new Date();
    for (const card of deck.cards) {
      ensureCard(card.id, deck.id, card.type, card.clozeIndex ?? null, now);
    }

    console.log(`Loaded deck: ${deck.name} (${deck.cards.length} cards)`);
  } catch (err) {
    console.error(`Failed to load deck ${filePath}:`, err);
  }
}

function removeFile(filePath: string): void {
  // Find and remove deck by filePath
  for (const [id, deck] of registry.entries()) {
    if (deck.filePath === filePath) {
      registry.delete(id);
      console.log(`Unloaded deck: ${deck.name}`);
      break;
    }
  }
}

export function loadDecks(decksDir: string): void {
  if (!existsSync(decksDir)) {
    mkdirSync(decksDir, { recursive: true });
    console.log(`Created decks directory: ${decksDir}`);
  }

  const files = readdirSync(decksDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    loadFile(join(decksDir, file));
  }

  // Watch for changes
  watch(decksDir, { persistent: false }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.md')) return;
    const filePath = join(decksDir, filename);

    // Small debounce delay to avoid double-fire
    setTimeout(() => {
      if (existsSync(filePath)) {
        loadFile(filePath);
      } else {
        removeFile(resolve(filePath));
      }
    }, 100);
  });
}

export async function syncIfStale(force = false): Promise<void> {
  if (!config.githubRepo) return;

  const now = Date.now();
  if (!force && now - lastSyncAt <= config.syncTtlMs) return;

  const [owner, repo] = config.githubRepo.split('/');
  if (!owner || !repo) {
    console.error(`GITHUB_REPO must be in "owner/repo" format, got: ${config.githubRepo}`);
    return;
  }

  const ghConfig: GitHubConfig = {
    owner,
    repo,
    branch: config.githubBranch,
    path: config.githubPath,
    token: config.githubToken,
  };

  try {
    console.log(`Syncing decks from GitHub: ${config.githubRepo}`);
    const files = await fetchGitHubDecks(ghConfig);
    const syncTime = new Date();

    for (const { virtualPath, content } of files) {
      const deck = parseDeck(virtualPath, content);
      registry.set(deck.id, deck);
      for (const card of deck.cards) {
        ensureCard(card.id, deck.id, card.type, card.clozeIndex ?? null, syncTime);
      }
    }

    lastSyncAt = Date.now();
    console.log(`GitHub sync complete: ${files.length} deck(s) loaded`);
  } catch (err) {
    console.error('GitHub sync failed:', err);
    // Don't update lastSyncAt so next request retries sooner
  }
}
