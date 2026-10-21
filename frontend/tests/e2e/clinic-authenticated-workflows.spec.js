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
  const services = [];
  const stations = [];
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
      if (!user.active || user.role !== "Staff") {
        for (const station of stations) station.staffUserIds = station.staffUserIds.filter((id) => id !== user.id);
      }
      return json(user);
    }
    if (path === "/admin/services" && method === "GET") return json(services);
    if (path === "/admin/services" && method === "POST") {
      const created = { id: "service-new", ...body, active: true };
      services.push(created);
      return json(created, 201);
    }
    if (path.startsWith("/admin/services/") && method === "PATCH") {
      const service = services.find((item) => item.id === path.split("/").at(-1));
      Object.assign(service, body);
      return json(service);
    }
    if (path === "/admin/stations" && method === "GET") return json(stations);
    if (path === "/admin/stations" && method === "POST") {
      const created = { id: "station-new", serviceIds: [], staffUserIds: [], ...body, active: true };
      stations.push(created);
      return json(created, 201);
    }
    if (path.startsWith("/admin/stations/") && method === "PATCH") {
      const station = stations.find((item) => item.id === path.split("/").at(-1));
      Object.assign(station, body);
      return json(station);
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

test("admin can configure each section through the sidebar and sees only the selected section", async ({ page }) => {
  await mockApi(page, "Admin");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/departments$/);
  await expect(page.getByRole("heading", { name: "Clinic configuration" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Departments" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Services" })).toHaveCount(0);
  const adminMenu = page.getByRole("button", { name: /Administration/ });
  await expect(adminMenu).toHaveAttribute("aria-expanded", "true");
  await adminMenu.click();
  await expect(adminMenu).toHaveAttribute("aria-expanded", "false");
  await adminMenu.click();
  await page.getByRole("button", { name: "Add department" }).click();
  await page.getByLabel("Department name").fill("Ultrasound");
  await page.getByRole("button", { name: "Save department" }).click();
  await expect(page.getByRole("region", { name: "Departments" }).getByText("Ultrasound", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /^Services\b/ }).click();
  await expect(page).toHaveURL(/\/admin\/services$/);
  await expect(page.getByRole("region", { name: "Departments" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add service" }).click();
  await page.getByLabel("Service name").fill("X-ray Imaging");
  await page.getByLabel("Service department").selectOption("dept-xray");
  await page.getByRole("button", { name: "Save service" }).click();
  await expect(page.getByRole("region", { name: "Services" }).getByText("X-ray Imaging", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Users & access" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("region", { name: "Services" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add user" }).click();
  await page.getByLabel("Username", { exact: true }).fill("new-staff");
  await page.getByLabel("Role", { exact: true }).last().selectOption("Staff");
  await page.getByLabel("Departments for staff").selectOption(["dept-xray"]);
  await page.getByRole("button", { name: "Provision user" }).click();
  await expect(page.getByText("one-time-secret")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);

  await page.getByRole("link", { name: "Stations" }).click();
  await expect(page).toHaveURL(/\/admin\/stations$/);
  await page.getByRole("button", { name: "Add station" }).click();
  await page.getByLabel("Station name").fill("Window 1");
  await page.getByLabel("Station department").selectOption("dept-xray");
  await page.getByLabel("Services handled").selectOption("service-new");
  await page.getByLabel("Assigned staff").selectOption("user-new");
  await page.getByRole("button", { name: "Save station" }).click();
  const stationRegion = page.getByRole("region", { name: "Stations" });
  await expect(stationRegion.getByText("Window 1", { exact: true })).toBeVisible();
  await expect(stationRegion.getByText("X-ray Imaging", { exact: true })).toBeVisible();
  await expect(stationRegion.getByText("new-staff", { exact: true })).toBeVisible();
  const savedStationForm = stationRegion.locator(".admin-record form");
  await stationRegion.getByRole("button", { name: "Edit station" }).click();
  await savedStationForm.getByLabel("Station name").fill("Window 1 Front Desk");
  await savedStationForm.getByRole("button", { name: "Save station" }).click();
  await expect(stationRegion.getByText("Window 1 Front Desk", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Users & access" }).click();
  const savedUserRecord = page.getByRole("region", { name: "Users & access" }).locator(".admin-record").filter({ hasText: "new-staff" });
  await savedUserRecord.getByRole("button", { name: "Edit access" }).click();
  const savedUserForm = savedUserRecord.locator("form");
  await savedUserForm.getByLabel("Active").uncheck();
  await savedUserForm.getByRole("button", { name: "Save user access" }).click();
  await expect(page.getByText("one-time-secret")).toBeVisible();

  await page.getByRole("link", { name: "Stations" }).click();
  const refreshedStationRegion = page.getByRole("region", { name: "Stations" });
  await expect(refreshedStationRegion.getByText("No staff assigned")).toBeVisible();

  await page.getByRole("link", { name: "Displays" }).click();
  await expect(page).toHaveURL(/\/admin\/displays$/);
  await page.getByRole("button", { name: "Add monitor" }).click();
  await page.getByLabel("Monitor name").fill("X-ray Waiting Room");
  await page.getByLabel("Assigned department", { exact: true }).selectOption("dept-xray");
  await page.getByRole("button", { name: "Save monitor" }).click();
  await expect(page.getByText("X-ray Waiting Room", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create pairing code" }).click();
  await expect(page.getByText("PAIR-1234")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open pairing page in a new tab" })).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("link", { name: "Open pairing page in a new tab" })).toHaveAttribute("href", "/display/pair");
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/stations$/);
  await expect(page.getByRole("region", { name: "Stations" })).toBeVisible();
  await page.goto("/admin/services");
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/services$/);
  await expect(page.getByRole("region", { name: "Services" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Stations" })).toHaveCount(0);
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
