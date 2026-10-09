import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatClock,
  getElapsedSeconds,
  getRemainingSeconds,
  getRestRemainingSeconds,
} from '../src/utils/timer.js';

test('elapsed timer reconciles from server duration and delayed callbacks', () => {
  const session = { status: 'active', durationSeconds: 12 };
  assert.equal(getElapsedSeconds(session, 1000, 6500), 17);
  assert.equal(getElapsedSeconds(session, 1000, 12500), 23);
  assert.equal(getElapsedSeconds(session, 1000, 500), 12);
});

test('paused timers do not advance and remaining time respects the configured rule limit', () => {
  const session = {
    status: 'paused',
    durationSeconds: 37,
    ruleSnapshot: { timeLimit: 1 },
  };
  assert.equal(getElapsedSeconds(session, 1000, 6000), 37);
  assert.equal(getRemainingSeconds(session, 1000, 6000), 23);
  assert.equal(getRemainingSeconds({ ...session, durationSeconds: 70 }, 1000, 6000), 0);
});

test('timer formatting clamps negative time and formats hours, minutes, and seconds', () => {
  assert.equal(formatClock(-2), '00:00:00');
  assert.equal(formatClock(59), '00:00:59');
  assert.equal(formatClock(3661), '01:01:01');
});

test('rest countdown reconciles against persisted server end times and handles invalid dates', () => {
  const endAt = new Date(11000).toISOString();
  assert.equal(getRestRemainingSeconds(endAt, 1000), 10);
  assert.equal(getRestRemainingSeconds(endAt, 10500), 1);
  assert.equal(getRestRemainingSeconds(endAt, 12000), 0);
  assert.equal(getRestRemainingSeconds('invalid', 1000), 0);
});
