import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Logbook from '../src/js/logbook.js';
import { MockIDBFactory } from './mocks/mock-indexeddb.js';

describe('Logbook', () => {
  beforeEach(() => {
    globalThis.window = {
      indexedDB: new MockIDBFactory()
    };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  it('initializes and saves a workout', async () => {
    const logbook = new Logbook();
    const workout = {
      date: new Date('2023-01-01T10:00:00Z'),
      distance: 2000,
      timeElapsed: 420.5
    };

    const saved = await logbook.saveWorkout(workout);
    assert.deepStrictEqual(saved, workout);
  });

  it('loads saved workouts', async () => {
    const logbook = new Logbook();
    const workout1 = { date: new Date('2023-01-01T10:00:00Z'), distance: 1000, timeElapsed: 210.0 };
    const workout2 = { date: new Date('2023-01-02T10:00:00Z'), distance: 2000, timeElapsed: 420.0 };

    await logbook.saveWorkout(workout1);
    await logbook.saveWorkout(workout2);

    const loaded = await logbook.loadWorkouts();
    assert.strictEqual(loaded.length, 2);
    assert.deepStrictEqual(loaded[0], workout1);
    assert.deepStrictEqual(loaded[1], workout2);
  });

  it('returns empty array when no workouts exist', async () => {
    const logbook = new Logbook();
    const loaded = await logbook.loadWorkouts();
    assert.deepStrictEqual(loaded, []);
  });

  it('reuses cached database instance if already set', async () => {
    const logbook = new Logbook();
    const mockDb = {
      transaction: () => ({
        objectStore: () => ({
          openCursor: () => ({
            onsuccess: (cb) => cb({ target: { result: null } })
          })
        })
      })
    };
    logbook.db = mockDb;

    const db = await logbook._getDatabase();
    assert.strictEqual(db, mockDb);
  });
});
