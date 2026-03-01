import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb } from './db.js';
import { loadDecks, syncIfStale, getDeck } from './decks.js';
import decksRouter from './routes/decks.js';
import reviewRouter from './routes/review.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// When bundled by esbuild to dist/server.mjs, __dirname = dist/
// When running via ts-node/tsx from src/server/, __dirname = src/server/
const isDist = __filename.endsWith('dist/server.mjs') || __dirname.endsWith('/dist');
const projectRoot = isDist ? join(__dirname, '..') : join(__dirname, '..', '..');
const staticDir = join(projectRoot, 'dist');
const htmlDir = join(projectRoot, 'public');

export function createApp() {
  const app = express();
  app.use(express.json());

  // API routes
  app.use(decksRouter);
  app.use(reviewRouter);

  // Serve deck assets (images, etc.) relative to deck file directory
  app.get('/deck-assets/:deckId/*', (req, res) => {
    const deck = getDeck(req.params.deckId);
    if (!deck) {
      res.status(404).json({ error: 'Deck not found' });
      return;
    }
    const deckDir = dirname(deck.filePath);
    const assetPath = (req.params as Record<string, string>)['0'];
    res.sendFile(join(deckDir, assetPath));
  });

  // Static files (client.js, client.css)
  app.use(express.static(staticDir));
  // Public HTML
  app.use(express.static(htmlDir));

  // SPA fallback — serve index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(join(htmlDir, 'index.html'));
  });

  return app;
}

// Only boot when this module is the entry point (not when imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initDb(config.dbPath);

  if (config.githubRepo) {
    const app = createApp();
    syncIfStale(true).then(() => {
      app.listen(config.port, () => {
        console.log(`Markcards running at http://localhost:${config.port}`);
        console.log(`GitHub repo: ${config.githubRepo}`);
        console.log(`Database: ${config.dbPath}`);
      });
    });
  } else {
    loadDecks(config.decksDir);
    const app = createApp();
    app.listen(config.port, () => {
      console.log(`Markcards running at http://localhost:${config.port}`);
      console.log(`Decks directory: ${config.decksDir}`);
      console.log(`Database: ${config.dbPath}`);
    });
  }
}
