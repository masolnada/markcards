import { readFileSync, existsSync } from 'fs';
import { config } from './config.js';

export interface Settings {
  maxNewPerDay: number;
  learningSteps: number[];   // minutes; e.g. [1, 10, 10080, 43200]
  relearningSteps: number[]; // minutes; e.g. [10]
}

const DEFAULTS: Settings = { maxNewPerDay: 20, learningSteps: [1, 10], relearningSteps: [10] };

let settingsFilePath = config.settingsPath;

export function initSettings(path: string): void {
  settingsFilePath = path;
}

export function getSettings(): Settings {
  if (!existsSync(settingsFilePath)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(settingsFilePath, 'utf-8')) };
  } catch {
    return { ...DEFAULTS };
  }
}
