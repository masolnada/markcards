import { readFileSync, existsSync } from 'fs';
import type { ReviewPolicy } from '../domain/review-policy.js';
import { DEFAULT_POLICY } from '../domain/review-policy.js';
import type { SettingsRepository } from '../application/ports/settings-repository.js';

export class JsonSettingsRepository implements SettingsRepository {
  constructor(private filePath: string) {}

  get(): ReviewPolicy {
    if (!existsSync(this.filePath)) return { ...DEFAULT_POLICY };
    try {
      return { ...DEFAULT_POLICY, ...JSON.parse(readFileSync(this.filePath, 'utf-8')) };
    } catch {
      return { ...DEFAULT_POLICY };
    }
  }
}
