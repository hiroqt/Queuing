import { expect, test } from "@playwright/test";

async function mockApi(page, initialRole = null, forcePasswordChange = false) {
  let role = initialRole;
  let mustChangePassword = false;
  const departments = [
    { id: "dept-xray", name: "X-ray", active: true },
    { id: "dept-ecg", name: "ECG", active: true },
  ];
  const users = [];
  const displays = [];
  const requests = [];
  let paired = false;
  const waiting = [{ id: "visit-2", visitCode: "Q-002", issuedAtUtc: "2026-10-20T00:00:00Z" }];
  const called = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    const body = request.postDataJSON?.() ?? {};
    requests.push({ path, method, headers: request.headers(), body });
    const json = (payload, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

    if (path === "/auth/csrf" && method === "GET") return json({ requestToken: "test-token" });
    if (path === "/auth/session" && method === "GET") return json(role
      ? { authenticated: true, userName: "clinic-user", role, departmentIds: role === "Staff" ? ["dept-xray"] : [], mustChangePassword }
      : { authenticated: false, userName: null, role: null, departmentIds: [], requestToken: "test-token" });
    if (path === "/auth/login" && method === "POST") { role = "Reception"; mustChangePassword = forcePasswordChange; return route.fulfill({ status: 204 }); }
    if (path === "/auth/logout" && method === "POST") { role = null; return route.fulfill({ status: 204 }); }
    if (path === "/auth/change-password" && method === "POST") { mustChangePassword = false; return route.fulfill({ status: 204 }); }
    if (path === "/departments" && method === "GET") return json(departments);
    if (path === "/admin/departments" && method === "GET") return json(departments);
    if (path === "/admin/departments" && method === "POST") {
      const created = { id: "dept-new", name: body.name, active: true };
      departments.push(created);
      return json(created, 201);
    }
    if (path.startsWith("/admin/departments/") && method === "PATCH") {
      const department = departments.find((item) => item.id === path.split("/").at(-1));
      Object.assign(department, body);
      return json(department);
    }
    if (path === "/admin/users" && method === "GET") return json(users);
    if (path === "/admin/users" && method === "POST") {
      const created = { id: "user-new", userName: body.userName, role: body.role, departmentIds: body.departmentIds, active: true };
      users.push(created);
      return json({ ...created, oneTimeCredential: "one-time-secret" }, 201);
    }
    if (path.startsWith("/admin/users/") && method === "PATCH") {
      const user = users.find((item) => item.id === path.split("/").at(-1));
      Object.assign(user, body);
      return json(user);
    }
    if (path === "/admin/displays" && method === "GET") return json(displays);
    if (path === "/admin/displays" && method === "POST") {
      const created = { id: "display-new", ...body, active: true };
      displays.push(created);
      return json(created, 201);
    }
    if (path.startsWith("/admin/displays/") && method === "PATCH") {
      const display = displays.find((item) => item.id === path.split("/").at(-1));
      Object.assign(display, body);
      return json(display);
    }
    if (path.endsWith("/pairing-code") && method === "POST") return json({ code: "PAIR-1234" });
    if (path === "/displays/activate" && method === "POST") { paired = true; return route.fulfill({ status: 204 }); }
    if (path === "/displays/me/snapshot" && method === "GET") return paired
      ? json({ departmentName: "X-ray", waiting: [{ visitCode: "Q-002", status: "Pending" }], called: [{ visitCode: "Q-001", status: "Called" }] })
      : route.fulfill({ status: 401, contentType: "application/problem+json", body: JSON.stringify({ title: "Unauthorized" }) });
    if (path === "/departments/dept-xray/queue" && method === "GET") return json({ waiting, called });
    if (path === "/departments/dept-xray/call-next" && method === "POST") {
      const next = waiting.shift();
      if (!next) return route.fulfill({ status: 409, contentType: "application/problem+json", body: JSON.stringify({ detail: "No eligible visits are waiting." }) });
      called.push(next);
      return json(next);
    }
    if (path.startsWith("/visits/") && path.endsWith("/return-to-pending") && method === "POST") {
      const id = path.split("/")[2];
      const index = called.findIndex((visit) => visit.id === id);
      if (index >= 0) waiting.unshift(called.splice(index, 1)[0]);
      return route.fulfill({ status: 204 });
    }
    if (path.startsWith("/visits/") && path.endsWith("/complete") && method === "POST") {
      const id = path.split("/")[2];
      const index = called.findIndex((visit) => visit.id === id);
      if (index >= 0) called.splice(index, 1);
      return route.fulfill({ status: 204 });
    }
    if (path === "/visits" && method === "POST") return json({ id: "visit-new", visitCode: "Q-003", departmentId: body.initialDepartmentId, appointmentAtUtc: null, issuedAtUtc: "2026-10-20T00:00:00Z" }, 201);
    if (path === "/visits/visit-new" && method === "GET") return json({ id: "visit-new", visitCode: "Q-003", departmentId: "dept-xray", issuedAtUtc: "2026-10-20T00:00:00Z" });
    return route.fulfill({ status: 404, contentType: "application/problem+json", body: JSON.stringify({ detail: `Unhandled mock route: ${method} ${path}` }) });
  });
  return { requests, departments };
}

test("sign-in and route guards keep the Reception workspace role scoped", async ({ page }) => {
  const { requests } = await mockApi(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Username").fill("receptionist");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/reception$/);
  await expect(page.getByRole("heading", { name: "Issue a visit" })).toBeVisible();
  expect(requests.find((entry) => entry.path === "/auth/login").headers["x-csrf-token"]).toBe("test-token");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/reception$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("first sign-in requires a password change before entering a protected workspace", async ({ page }) => {
  const { requests } = await mockApi(page, null, true);
  await page.goto("/login");
  await page.getByLabel("Username").fill("new-staff");
  await page.getByLabel("Password").fill("temporary-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/change-password$/);
  await page.goto("/reception");
  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByLabel("Temporary password").fill("temporary-password");
  await page.getByLabel("New password", { exact: true }).fill("private-password");
  await page.getByLabel("Confirm new password").fill("private-password");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/reception$/);
  expect(requests.find((entry) => entry.path === "/auth/change-password").body).toEqual({ currentPassword: "temporary-password", newPassword: "private-password" });
});

test("admin can add a department and provision a user without exposing a password field", async ({ page }) => {
  await mockApi(page, "Admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Clinic configuration" })).toBeVisible();
  await page.getByLabel("Add department").fill("Ultrasound");
  await page.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByRole("region", { name: "Departments" }).getByText("Ultrasound", { exact: true })).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("new-staff");
  await page.getByLabel("Role", { exact: true }).last().selectOption("Staff");
  await page.getByLabel("Departments for staff").selectOption(["dept-xray"]);
  await page.getByRole("button", { name: "Provision user" }).click();
  await expect(page.getByText("one-time-secret")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await page.getByLabel("Monitor name").fill("X-ray Waiting Room");
  await page.getByLabel("Assigned department", { exact: true }).selectOption("dept-xray");
  await page.getByRole("button", { name: "Create monitor" }).click();
  await expect(page.getByText("X-ray Waiting Room", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create pairing code" }).click();
  await expect(page.getByText("PAIR-1234")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open pairing page in a new tab" })).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("link", { name: "Open pairing page in a new tab" })).toHaveAttribute("href", "/display/pair");
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
});

test("reception issues an Asia/Manila appointment, prints its stable code, and can look it up", async ({ page }) => {
  const { requests } = await mockApi(page, "Reception");
  await page.addInitScript(() => { window.print = () => { window.printRequested = true; }; });
  await page.goto("/reception");
  await expect(page.getByRole("heading", { name: "Issue a visit" })).toBeVisible();
  await page.getByLabel("Appointment time Optional").fill("2026-10-20T09:30");
  await page.getByRole("button", { name: "Issue visit" }).click();
  await expect(page.getByText("Q-003", { exact: true })).toBeVisible();
  const issued = requests.find((entry) => entry.path === "/visits" && entry.method === "POST");
  expect(issued.body).toEqual({ initialDepartmentId: "dept-xray", appointmentAtLocal: "2026-10-20T09:30" });
  expect(issued.headers["idempotency-key"]).toBeTruthy();
  await page.getByRole("button", { name: "Print / reprint" }).click();
  await expect.poll(() => page.evaluate(() => window.printRequested)).toBe(true);
  await page.getByLabel("Reprint an existing visit by ID").fill("visit-new");
  await page.getByRole("button", { name: "Find visit" }).click();
  await expect(page.getByText("Q-003", { exact: true })).toBeVisible();
});

test("assigned staff can call, return a no-show, and complete a visit", async ({ page }) => {
  await mockApi(page, "Staff");
  await page.goto("/department");
  await expect(page.getByRole("heading", { name: "Department queue" })).toBeVisible();
  await page.getByRole("button", { name: "Call next" }).click();
  await expect(page.getByRole("status")).toContainText("Now calling Q-002");
  await page.getByRole("button", { name: "Return no-show to pending" }).first().click();
  await expect(page.getByText("Q-002 returned to pending.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Call next" }).click();
  await page.getByLabel("Forward to department").selectOption("dept-ecg");
  await page.getByRole("button", { name: "Complete / forward" }).first().click();
  await expect(page.getByText("Q-002 forwarded", { exact: false })).toBeVisible();
});

test("paired display uses its device session without requiring staff sign-in", async ({ page }) => {
  const { requests } = await mockApi(page);
  await page.route("**/hubs/displays/negotiate**", (route) => route.fulfill({ status: 404, body: "Hub not running in UI mock" }));
  await page.goto("/display/pair");
  await page.getByLabel("Pairing code").fill("PAIR-1234");
  await page.getByRole("button", { name: "Activate display" }).click();
  await expect(page).toHaveURL(/\/display$/);
  await expect(page.getByRole("heading", { name: "X-ray" })).toBeVisible();
  await expect(page.getByText("Q-001", { exact: true })).toBeVisible();
  expect(requests.some((entry) => entry.path === "/auth/session")).toBe(false);
  expect(requests.some((entry) => entry.path === "/displays/me/snapshot")).toBe(true);
  expect(requests.find((entry) => entry.path === "/displays/activate").headers["x-csrf-token"]).toBe("test-token");
});
