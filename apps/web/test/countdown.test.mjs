import { test } from "node:test";
import assert from "node:assert/strict";
import { countdownLabel } from "../src/shared/time/countdown.ts";
const now = Date.parse("2026-12-05T12:00:00Z");
test("countdown uses absolute instants across offsets", () => {
  assert.equal(countdownLabel("2026-12-06T10:30:00-03:00", now), "Faltam 1 dia e 1 hora");
  assert.equal(countdownLabel("2026-12-05T12:01:00Z", now), "Falta 1 min");
});
test("past or invalid dates never claim a draw was completed", () => {
  assert.equal(countdownLabel("2026-12-05T11:59:00Z", now), "Aguardando processamento");
  assert.equal(countdownLabel("invalid", now), null);
});
