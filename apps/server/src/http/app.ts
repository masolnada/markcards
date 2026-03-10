import express from 'express';
import { fileURLToPath } from 'url';
import { Database } from 'bun:sqlite';
import { config } from '../infrastructure/config.js';
import { initDb } from '../infrastructure/db/schema.js';
import { SqliteCardRepository } from '../infrastructure/db/sqlite-card-repository.js';
import { LocalDeckSource } from '../infrastructure/deck-source/local-deck-source.js';
import { GithubDeckSource } from '../infrastructure/deck-source/github-deck-source.js';
import { HtmlCardRenderer } from '../infrastructure/html-card-renderer.js';
import { JsonSettingsRepository } from '../infrastructure/json-settings-repository.js';
import { DeckService } from '../application/deck-service.js';
import { ReviewService } from '../application/review-service.js';
import { createDecksRouter } from './routes/decks.js';
import { createReviewRouter } from './routes/review.js';
import type { Express } from 'express';

export function createApp(
  deckService: DeckService,
  reviewService: ReviewService,
  decksDir: string = config.decksDir,
): Express {
  const app = express();
  app.use(express.json());

  app.use(createDecksRouter(deckService, reviewService));
  app.use(createReviewRouter(reviewService));

  app.use('/decks', express.static(decksDir));

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = new Database(config.dbPath);
  initDb(db);
  const cardRepo = new SqliteCardRepository(db);
  const settingsRepo = new JsonSettingsRepository(config.settingsPath);
  const renderer = new HtmlCardRenderer({ decksDir: config.decksDir, githubBranch: config.githubBranch });

  let deckSource: LocalDeckSource | GithubDeckSource;
  if (config.githubRepo) {
    const [owner, repo] = config.githubRepo.split('/');
    if (!owner || !repo) {
      console.error(`GITHUB_REPO must be in "owner/repo" format, got: ${config.githubRepo}`);
      process.exit(1);
    }
    deckSource = new GithubDeckSource(
      { owner, repo, branch: config.githubBranch, path: config.githubPath, token: config.githubToken },
      config.syncTtlMs,
      cardRepo,
    );
  } else {
    deckSource = new LocalDeckSource(config.decksDir, cardRepo);
  }

  const deckService = new DeckService(deckSource, cardRepo);
  const reviewService = new ReviewService(cardRepo, deckSource, settingsRepo, renderer);
  const app = createApp(deckService, reviewService);

  if (config.githubRepo) {
    deckSource.sync(true).then(() => {
      app.listen(config.port, () => {
        console.log(`Markcards running at http://localhost:${config.port}`);
        console.log(`GitHub repo: ${config.githubRepo}`);
        console.log(`Database: ${config.dbPath}`);
      });
    });
  } else {
    (deckSource as LocalDeckSource).sync(true).then(() => {
      app.listen(config.port, () => {
        console.log(`Markcards running at http://localhost:${config.port}`);
        console.log(`Decks directory: ${config.decksDir}`);
        console.log(`Database: ${config.dbPath}`);
      });
    });
  }
}
