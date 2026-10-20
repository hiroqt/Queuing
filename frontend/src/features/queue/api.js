async function request(path, options = {}) {
  const response = await fetch(path, options);
  const body = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.detail || body?.title || "The queue service could not complete the request.");
  }

  return body;
}

export function getServices(signal) {
  return request("/api/v1/services", { signal });
}

export function getDisplaySnapshot(signal) {
  return request("/api/v1/queue/display", { signal });
}

export function issueTicket(serviceId, idempotencyKey) {
  return request("/api/v1/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ serviceId }),
  });
}

export function callNextTicket(serviceId, counterName, idempotencyKey) {
  return request("/api/v1/queue/call-next", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ serviceId, counterName }),
  });
}
