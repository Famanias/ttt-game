import { describe, expect, test } from 'bun:test';
import { countdownRefreshDelay } from '../hooks/use-online-room';

describe('countdownRefreshDelay', () => {
  test('schedules refresh slightly after startAt with zero clock offset', () => {
    const now = Date.parse('2026-11-15T00:00:00.000Z');
    const startAt = '2026-11-15T00:00:03.000Z';
    expect(countdownRefreshDelay(startAt, 0, now)).toBe(3150);
  });

  test('adjusts remaining delay using server-client clock offset', () => {
    const now = Date.parse('2026-11-15T00:00:00.000Z');
    const startAt = '2026-11-15T00:00:03.000Z';
    expect(countdownRefreshDelay(startAt, 500, now)).toBe(2650);
    expect(countdownRefreshDelay(startAt, -400, now)).toBe(3550);
  });

  test('clamps expired or already-elapsed countdowns to minimum 50ms', () => {
    const now = Date.parse('2026-11-15T00:00:05.000Z');
    const startAt = '2026-11-15T00:00:03.000Z';
    expect(countdownRefreshDelay(startAt, 0, now)).toBe(50);
  });
});
