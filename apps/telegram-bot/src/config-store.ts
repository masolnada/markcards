import { readFileSync, writeFileSync, existsSync } from 'fs';

export interface BotConfig {
  reminderTimes: string[];
}

const DEFAULT_CONFIG: BotConfig = { reminderTimes: [] };

export class ConfigStore {
  constructor(private readonly path: string) {}

  load(): BotConfig {
    if (!existsSync(this.path)) return { ...DEFAULT_CONFIG };
    return JSON.parse(readFileSync(this.path, 'utf-8')) as BotConfig;
  }

  save(config: BotConfig): void {
    writeFileSync(this.path, JSON.stringify(config, null, 2));
  }
}
