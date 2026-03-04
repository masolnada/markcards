import { readFileSync, watch, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { parseDeck } from '../parser.js';
import type { Deck } from '../../domain/card.js';
import type { DeckSource } from '../../application/ports/deck-source.js';
import type { CardRepository } from '../../application/ports/card-repository.js';

export class LocalDeckSource implements DeckSource {
  private registry = new Map<string, Deck>();
  private watchStarted = false;

  constructor(
    private decksDir: string,
    private cards: CardRepository,
  ) {}

  getAll(): Deck[] {
    return Array.from(this.registry.values());
  }

  getById(id: string): Deck | undefined {
    return this.registry.get(id);
  }

  async sync(_force = false): Promise<void> {
    if (this.registry.size > 0 && !_force) return;
    this.loadAll();
  }

  private loadAll(): void {
    if (!existsSync(this.decksDir)) {
      mkdirSync(this.decksDir, { recursive: true });
      console.log(`Created decks directory: ${this.decksDir}`);
    }

    const files = readdirSync(this.decksDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      this.loadFile(join(this.decksDir, file));
    }

    if (!this.watchStarted) {
      this.watchStarted = true;
      watch(this.decksDir, { persistent: false }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.md')) return;
        const filePath = join(this.decksDir, filename);
        setTimeout(() => {
          if (existsSync(filePath)) {
            this.loadFile(filePath);
          } else {
            this.removeFile(resolve(filePath));
          }
        }, 100);
      });
    }
  }

  private loadFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf8');
      const deck = parseDeck(filePath, content);
      this.registry.set(deck.id, deck);

      const now = new Date();
      for (const card of deck.cards) {
        this.cards.ensure(card.id, deck.id, card.type, card.clozeIndex ?? null, now);
      }

      console.log(`Loaded deck: ${deck.name} (${deck.cards.length} cards)`);
    } catch (err) {
      console.error(`Failed to load deck ${filePath}:`, err);
    }
  }

  private removeFile(filePath: string): void {
    for (const [id, deck] of this.registry.entries()) {
      if (deck.filePath === filePath) {
        this.registry.delete(id);
        console.log(`Unloaded deck: ${deck.name}`);
        break;
      }
    }
  }
}
