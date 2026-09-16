import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, formatDate } from '../src/js/utils.js';

describe('utils', () => {
  describe('formatTime', () => {
    it('formats time with padded hours, minutes, and seconds', () => {
      // 09:05:07
      const date = new Date(2023, 0, 1, 9, 5, 7);
      assert.strictEqual(formatTime(date), '09:05:07');
    });

    it('formats double digit hours, minutes, and seconds', () => {
      // 14:30:45
      const date = new Date(2023, 0, 1, 14, 30, 45);
      assert.strictEqual(formatTime(date), '14:30:45');
    });

    it('formats midnight as 00:00:00', () => {
      const date = new Date(2023, 0, 1, 0, 0, 0);
      assert.strictEqual(formatTime(date), '00:00:00');
    });
  });

  describe('formatDate', () => {
    it('formats date and time properly', () => {
      const date = new Date(2023, 4, 15, 8, 30); // Month is 0-indexed (4 = May)
      // Expect: 2023-5-15 08:30
      assert.strictEqual(formatDate(date), '2023-5-15 08:30');
    });

    it('formats end of year date', () => {
      const date = new Date(2022, 11, 31, 23, 59); // 11 = December
      assert.strictEqual(formatDate(date), '2022-12-31 23:59');
    });
  });
});
