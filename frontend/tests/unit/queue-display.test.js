import assert from "node:assert/strict";
import test from "node:test";

import { callTicket, fetchDisplayQueue, recallTicket } from "../../src/services/queueHub.js";

test("fetchDisplayQueue loads display items from /api/queue/display", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  const mockItems = [
    { ticketNumber: "A-101", counterName: "Counter 01", department: "Admissions", status: "Called" },
  ];

  globalThis.fetch = async (url) => {
    requested.push(url);
    return new Response(JSON.stringify(mockItems), { status: 200 });
  };

  try {
    const items = await fetchDisplayQueue("billing");
    assert.deepEqual(items, mockItems);
    assert.deepEqual(requested, ["/api/queue/display?department=billing"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("callTicket posts to /api/queue/display/call", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  const mockResult = { ticketNumber: "B-042", counterName: "Counter 03", status: "Called" };

  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify(mockResult), { status: 200 });
  };

  try {
    const res = await callTicket("Billing", "Counter 03");
    assert.deepEqual(res, mockResult);
    assert.equal(request.url, "/api/queue/display/call");
    assert.equal(request.options.method, "POST");
    assert.deepEqual(JSON.parse(request.options.body), { department: "Billing", counterName: "Counter 03" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recallTicket posts to /api/queue/display/recall", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  const mockResult = { ticketNumber: "C-104", counterName: "Window 2", status: "Recalled" };

  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify(mockResult), { status: 200 });
  };

  try {
    const res = await recallTicket("C-104", "Window 2");
    assert.deepEqual(res, mockResult);
    assert.equal(request.url, "/api/queue/display/recall");
    assert.equal(request.options.method, "POST");
    assert.deepEqual(JSON.parse(request.options.body), { ticketNumber: "C-104", counterName: "Window 2" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
