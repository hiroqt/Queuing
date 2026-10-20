import assert from "node:assert/strict";
import test from "node:test";
import { api, authApi, clearRequestToken, displaysApi, queueApi, refreshRequestToken } from "../../src/api/client.js";

test("cookie-authenticated mutations obtain and send the antiforgery token", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    requests.push({ url: String(input), options });
    return requests.length === 1
      ? new Response(JSON.stringify({ requestToken: "csrf-test" }), { status: 200 })
      : new Response(JSON.stringify({ id: "department-1" }), { status: 201 });
  };
  clearRequestToken();

  try {
    await api("/admin/departments", { method: "POST", body: JSON.stringify({ name: "X-ray" }) });
    assert.equal(requests[0].url, "/api/v1/auth/csrf");
    assert.equal(requests[1].options.credentials, "same-origin");
    assert.equal(requests[1].options.headers.get("X-CSRF-TOKEN"), "csrf-test");
    assert.equal(requests[1].options.headers.get("Content-Type"), "application/json");
  } finally {
    globalThis.fetch = originalFetch;
    clearRequestToken();
  }
});

test("CSRF token endpoint sets a request token in memory", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ requestToken: "session-token" }), { status: 200 });
  try {
    assert.equal(await refreshRequestToken(), "session-token");
  } finally {
    globalThis.fetch = originalFetch;
    clearRequestToken();
  }
});

test("login response replaces the anonymous CSRF token before authenticated mutations", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    requests.push({ url: String(input), options });
    if (requests.length === 1) return new Response(JSON.stringify({ requestToken: "anonymous-token" }), { status: 200 });
    if (requests.length === 2) return new Response(JSON.stringify({ authenticated: true, requestToken: "signed-in-token" }), { status: 200 });
    return new Response(JSON.stringify({ id: "department-1" }), { status: 201 });
  };
  clearRequestToken();

  try {
    await authApi.login({ userName: "reception", password: "test-password" });
    await api("/admin/departments", { method: "POST", body: JSON.stringify({ name: "X-ray" }) });
    assert.equal(requests[1].options.headers.get("X-CSRF-TOKEN"), "anonymous-token");
    assert.equal(requests[2].options.headers.get("X-CSRF-TOKEN"), "signed-in-token");
  } finally {
    globalThis.fetch = originalFetch;
    clearRequestToken();
  }
});

test("anonymous display pairing obtains an antiforgery token without a staff session", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    requests.push({ url: String(input), options });
    return requests.length === 1
      ? new Response(JSON.stringify({ requestToken: "display-csrf" }), { status: 200 })
      : new Response(JSON.stringify({ paired: true }), { status: 200 });
  };
  clearRequestToken();

  try {
    await displaysApi.activate("PAIR-123456");
    assert.equal(requests[0].url, "/api/v1/auth/csrf");
    assert.equal(requests[1].url, "/api/v1/displays/activate");
    assert.equal(requests[1].options.headers.get("X-CSRF-TOKEN"), "display-csrf");
    assert.equal(requests[1].options.credentials, "same-origin");
  } finally {
    globalThis.fetch = originalFetch;
    clearRequestToken();
  }
});

test("queue transitions carry idempotency keys and only forward a supplied local appointment", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options) => {
    requests.push({ url: String(input), options });
    if (requests.length === 1) return new Response(JSON.stringify({ requestToken: "csrf-test" }), { status: 200 });
    return new Response(null, { status: 204 });
  };
  clearRequestToken();

  try {
    await queueApi.returnToPending("visit-1", "retry-key-1");
    await queueApi.complete("visit-2", "dept-next", "2026-10-20T09:30", "retry-key-2");
    await queueApi.complete("visit-3", null, null, "retry-key-3");

    assert.equal(requests[1].options.headers.get("Idempotency-Key"), "retry-key-1");
    assert.equal(requests[2].options.headers.get("Idempotency-Key"), "retry-key-2");
    assert.deepEqual(JSON.parse(requests[2].options.body), {
      nextDepartmentId: "dept-next",
      nextDepartmentAppointmentAtLocal: "2026-10-20T09:30",
    });
    assert.equal(requests[3].options.headers.get("Idempotency-Key"), "retry-key-3");
    assert.deepEqual(JSON.parse(requests[3].options.body), {});
  } finally {
    globalThis.fetch = originalFetch;
    clearRequestToken();
  }
});
