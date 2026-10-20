import assert from "node:assert/strict";
import test from "node:test";

import { fetchDisplayQueue } from "../../src/services/queueHub.js";

test("fetchDisplayQueue requests a department-scoped display snapshot", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  const mockItems = [
    { ticketNumber: "001", counterName: "Counter 01", department: "Consultation", status: "Called" },
  ];

  globalThis.fetch = async (url) => {
    requested.push(url);
    return new Response(JSON.stringify(mockItems), { status: 200 });
  };

  try {
    assert.deepEqual(await fetchDisplayQueue("Consultation"), mockItems);
    assert.deepEqual(requested, ["/api/queue/display?department=Consultation"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
