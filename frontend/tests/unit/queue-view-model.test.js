import assert from "node:assert/strict";
import test from "node:test";

import { selectWaitingTickets } from "../../src/features/staff/queue-view-model.js";

test("selects waiting tickets without changing the snapshot order", () => {
  const first = { number: "042", status: "waiting" };
  const called = { number: "041", status: "called" };
  const last = { number: "043", status: "waiting" };

  assert.deepEqual(selectWaitingTickets([first, called, last]), [first, last]);
});

test("returns no rows for an empty queue snapshot", () => {
  assert.deepEqual(selectWaitingTickets([]), []);
});
