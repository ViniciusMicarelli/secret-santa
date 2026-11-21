import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCalendarDate, formatSaoPaulo, saoPauloToISOString } from '../src/shared/time/saoPaulo.ts';

test('date-only values do not shift by timezone', () => {
  assert.equal(formatCalendarDate('2026-11-22'), '22/11/2026');
});
test('scheduled time is interpreted in São Paulo across date boundaries', () => {
  const timestamp = saoPauloToISOString('2026-11-22T00:15');
  assert.equal(timestamp, '2026-11-22T03:15:00.000Z');
  assert.equal(formatSaoPaulo(timestamp), '22/11/2026, 00:15');
  assert.equal(saoPauloToISOString('2026-11-22T23:30'), '2026-11-23T02:30:00.000Z');
});
test('rejects invalid and non-existent historical local times', () => {
  assert.throws(() => saoPauloToISOString('2026-02-31T10:00'));
  assert.throws(() => saoPauloToISOString('2018-11-04T00:30'));
});
