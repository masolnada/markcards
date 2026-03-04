import type { ReviewPolicy } from '../../domain/review-policy.js';

export interface SettingsRepository {
  get(): ReviewPolicy;
}
