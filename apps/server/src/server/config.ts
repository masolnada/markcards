import { resolve } from 'path';

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envOpt(key: string): string | undefined {
  return process.env[key] || undefined;
}

export const config = {
  decksDir: resolve(env('DECKS_DIR', './decks')),
  dbPath: resolve(env('DB_PATH', './markcards.db')),
  settingsPath: resolve(env('SETTINGS_PATH', './settings.json')),
  port: parseInt(env('PORT', '3000'), 10),

  // GitHub deck source (optional)
  githubRepo: envOpt('GITHUB_REPO'),       // "owner/repo"
  githubToken: envOpt('GITHUB_TOKEN'),     // personal access token
  githubBranch: env('GITHUB_BRANCH', 'main'),
  githubPath: env('GITHUB_PATH', ''),      // subdirectory within repo, e.g. "decks"
  syncTtlMs: parseInt(env('SYNC_TTL_MS', '60000'), 10),
};
