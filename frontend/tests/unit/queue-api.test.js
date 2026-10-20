import assert from "node:assert/strict";
import test from "node:test";

import { callNextTicket, getDisplaySnapshot, getServices, issueTicket } from "../../src/features/queue/api.js";

test("loads the service catalog and anonymous display snapshot from the API", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(url);
    return new Response(JSON.stringify(url.endsWith("services") ? [{ id: "consultation", name: "Consultation" }] : { waiting: [], calling: [], totalWaiting: 0 }), { status: 200 });
  };

  try {
    assert.deepEqual(await getServices(), [{ id: "consultation", name: "Consultation" }]);
    assert.deepEqual(await getDisplaySnapshot(), { waiting: [], calling: [], totalWaiting: 0 });
    assert.deepEqual(requested, ["/api/v1/services", "/api/v1/queue/display"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("issues a ticket with the selected service and idempotency key", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  const ticket = { id: "ticket-id", number: "001", serviceName: "Consultation" };
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify(ticket), { status: 201 });
  };

  try {
    assert.deepEqual(await issueTicket("consultation", "attempt-id"), ticket);
    assert.equal(request.url, "/api/v1/tickets");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers["Idempotency-Key"], "attempt-id");
    assert.deepEqual(JSON.parse(request.options.body), { serviceId: "consultation" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("calls the next ticket for the selected service with an idempotency key", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  const calledTicket = { ticketNumber: "001", department: "Consultation", counterName: "Counter 01", status: "Called" };
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify(calledTicket), { status: 200 });
  };

  try {
    assert.deepEqual(await callNextTicket("consultation", "Counter 01", "call-attempt-id"), calledTicket);
    assert.equal(request.url, "/api/v1/queue/call-next");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers["Idempotency-Key"], "call-attempt-id");
    assert.deepEqual(JSON.parse(request.options.body), { serviceId: "consultation", counterName: "Counter 01" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("surfaces the API Problem Details message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ title: "Conflict", detail: "Key belongs to another service." }), { status: 409 });

  try {
    await assert.rejects(issueTicket("laboratory", "attempt-id"), /Key belongs to another service\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
