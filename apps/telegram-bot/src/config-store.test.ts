import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { ConfigStore } from './config-store.js';

const TEST_PATH = '/tmp/markcards-bot-config-test.json';

function cleanup() {
  if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
}

describe('ConfigStore', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('returns empty reminder times when file does not exist', () => {
    const store = new ConfigStore(TEST_PATH);
    expect(store.load()).toEqual({ reminderTimes: [] });
  });

  it('saves and loads reminder times', () => {
    const store = new ConfigStore(TEST_PATH);
    store.save({ reminderTimes: ['09:00', '21:00'] });
    expect(store.load()).toEqual({ reminderTimes: ['09:00', '21:00'] });
  });

  it('persists data to disk', () => {
    const store = new ConfigStore(TEST_PATH);
    store.save({ reminderTimes: ['08:30'] });

    const raw = JSON.parse(readFileSync(TEST_PATH, 'utf-8'));
    expect(raw).toEqual({ reminderTimes: ['08:30'] });
  });

  it('a second instance reads what the first wrote', () => {
    new ConfigStore(TEST_PATH).save({ reminderTimes: ['12:00'] });
    expect(new ConfigStore(TEST_PATH).load()).toEqual({ reminderTimes: ['12:00'] });
  });
});
