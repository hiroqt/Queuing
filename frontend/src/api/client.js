const API_ROOT = "/api/v1";
let requestToken = "";

export class ApiError extends Error {
  constructor(message, status, problem = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

async function decode(response) {
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.ok && body?.requestToken) requestToken = body.requestToken;
  if (!response.ok) {
    throw new ApiError(
      body?.detail || body?.title || "The clinic queue service could not complete the request.",
      response.status,
      body,
    );
  }
  return body;
}

export async function refreshRequestToken() {
  const response = await fetch(`${API_ROOT}/auth/csrf`, { credentials: "same-origin" });
  const body = await decode(response);
  requestToken = body?.requestToken ?? "";
  return requestToken;
}

export function clearRequestToken() {
  requestToken = "";
}

export async function api(path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const fetchOptions = { ...options };
  delete fetchOptions.csrf;
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;
  if (hasBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && options.csrf !== false) {
    if (!requestToken) await refreshRequestToken();
    headers.set("X-CSRF-TOKEN", requestToken);
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    ...fetchOptions,
    method,
    headers,
    credentials: "same-origin",
  });
  return decode(response);
}

export const authApi = {
  session: (signal) => api("/auth/session", { signal }),
  async login(credentials) {
    await refreshRequestToken();
    return api("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
  },
  async logout() {
    await api("/auth/logout", { method: "POST" });
    clearRequestToken();
  },
  changePassword: (credentials) => api("/auth/change-password", { method: "POST", body: JSON.stringify(credentials) }),
};

export const departmentApi = {
  list: (signal) => api("/departments", { signal }),
  adminList: (signal) => api("/admin/departments", { signal }),
  create: (department) => api("/admin/departments", { method: "POST", body: JSON.stringify(department) }),
  update: (id, changes) => api(`/admin/departments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }),
};

export const usersApi = {
  list: (signal) => api("/admin/users", { signal }),
  create: (user) => api("/admin/users", { method: "POST", body: JSON.stringify(user) }),
  update: (id, changes) => api(`/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }),
};

export const displaysApi = {
  list: (signal) => api("/admin/displays", { signal }),
  create: (display) => api("/admin/displays", { method: "POST", body: JSON.stringify(display) }),
  update: (id, changes) => api(`/admin/displays/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }),
  pairingCode: (id) => api(`/admin/displays/${encodeURIComponent(id)}/pairing-code`, { method: "POST" }),
  activate: (code) => api("/displays/activate", { method: "POST", body: JSON.stringify({ code }) }),
  async logout() {
    await api("/displays/logout", { method: "POST" });
    clearRequestToken();
  },
  snapshot: (signal) => api("/displays/me/snapshot", { signal }),
};

export const visitsApi = {
  issue: (visit, key) => api("/visits", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(visit),
  }),
  get: (id, signal) => api(`/visits/${encodeURIComponent(id)}`, { signal }),
};

export const queueApi = {
  get: (departmentId, signal) => api(`/departments/${encodeURIComponent(departmentId)}/queue`, { signal }),
  callNext: (departmentId, key) => api(`/departments/${encodeURIComponent(departmentId)}/call-next`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
  }),
  returnToPending: (visitId, idempotencyKey) => api(`/visits/${encodeURIComponent(visitId)}/return-to-pending`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  }),
  complete: (visitId, nextDepartmentId, nextDepartmentAppointmentAtLocal, idempotencyKey) => {
    const body = {};
    if (nextDepartmentId) body.nextDepartmentId = nextDepartmentId;
    if (nextDepartmentId && nextDepartmentAppointmentAtLocal) body.nextDepartmentAppointmentAtLocal = nextDepartmentAppointmentAtLocal;
    return api(`/visits/${encodeURIComponent(visitId)}/complete`, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
    });
  },
};
