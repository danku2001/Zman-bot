import assert from "node:assert/strict";
import test from "node:test";
import { formatIsraelLocalIso, israelWallClockDate } from "./time";

test("formats UTC instants as Israel wall-clock time", () => {
  const utcInstant = new Date(Date.UTC(2026, 5, 30, 13, 8, 0, 0));
  assert.equal(formatIsraelLocalIso(utcInstant), "2026-06-30T16:08:00");
});

test("creates Israel wall-clock dates from UTC server instants", () => {
  const utcInstant = new Date(Date.UTC(2026, 5, 30, 13, 8, 0, 0));
  const wallClock = israelWallClockDate(utcInstant);
  assert.equal(wallClock.getFullYear(), 2026);
  assert.equal(wallClock.getMonth(), 5);
  assert.equal(wallClock.getDate(), 30);
  assert.equal(wallClock.getHours(), 16);
  assert.equal(wallClock.getMinutes(), 8);
});
