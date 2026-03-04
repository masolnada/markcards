import { parseDeck } from '../parser.js';
import type { Deck } from '../../domain/card.js';
import type { DeckSource } from '../../application/ports/deck-source.js';
import type { CardRepository } from '../../application/ports/card-repository.js';

interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  token?: string;
}

interface GitHubFile {
  virtualPath: string;
  content: string;
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'markcards',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchGitHubDecks(cfg: GitHubConfig): Promise<GitHubFile[]> {
  const { owner, repo, branch, path: pathPrefix, token } = cfg;
  const headers = buildHeaders(token);

  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) {
    const body = await treeRes.text();
    throw new Error(`GitHub tree API error ${treeRes.status}: ${body}`);
  }
  const tree = await treeRes.json() as { tree: Array<{ path: string; type: string }> };

  const mdFiles = tree.tree.filter(item => {
    if (item.type !== 'blob') return false;
    if (!item.path.endsWith('.md')) return false;
    if (pathPrefix && !item.path.startsWith(pathPrefix + '/') && item.path !== pathPrefix) return false;
    return true;
  });

  if (mdFiles.length === 0) return [];

  const results: GitHubFile[] = [];
  for (const file of mdFiles) {
    const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`;
    const contentRes = await fetch(contentsUrl, { headers });
    if (!contentRes.ok) {
      console.warn(`GitHub: failed to fetch ${file.path} (${contentRes.status}), skipping`);
      continue;
    }
    const data = await contentRes.json() as { content?: string; encoding?: string };
    if (data.encoding !== 'base64' || !data.content) {
      console.warn(`GitHub: unexpected encoding for ${file.path}, skipping`);
      continue;
    }
    const raw = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
    results.push({
      virtualPath: `github:${owner}/${repo}/${file.path}`,
      content: raw,
    });
  }

  return results;
}

export class GithubDeckSource implements DeckSource {
  private registry = new Map<string, Deck>();
  private lastSyncAt = 0;

  constructor(
    private cfg: GitHubConfig,
    private syncTtlMs: number,
    private cards: CardRepository,
  ) {}

  getAll(): Deck[] {
    return Array.from(this.registry.values());
  }

  getById(id: string): Deck | undefined {
    return this.registry.get(id);
  }

  async sync(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastSyncAt <= this.syncTtlMs) return;

    try {
      console.log(`Syncing decks from GitHub: ${this.cfg.owner}/${this.cfg.repo}`);
      const files = await fetchGitHubDecks(this.cfg);
      const syncTime = new Date();

      for (const { virtualPath, content } of files) {
        const deck = parseDeck(virtualPath, content);
        this.registry.set(deck.id, deck);
        for (const card of deck.cards) {
          this.cards.ensure(card.id, deck.id, card.type, card.clozeIndex ?? null, syncTime);
        }
      }

      this.lastSyncAt = Date.now();
      console.log(`GitHub sync complete: ${files.length} deck(s) loaded`);
    } catch (err) {
      console.error('GitHub sync failed:', err);
    }
  }
}
