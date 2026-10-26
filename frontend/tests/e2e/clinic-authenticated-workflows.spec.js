import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

async function mockApi(page, initialRole = null, forcePasswordChange = false, options = {}) {
  let role = initialRole;
  let mustChangePassword = false;
  const departments = [
    { id: "dept-xray", name: "X-ray", active: true },
    { id: "dept-ecg", name: "ECG", active: true },
  ];
  const availableServices = options.availableServices ?? [
    { id: "service-xray", name: "Imaging", departmentId: "dept-xray", departmentName: "X-ray", active: true },
    { id: "service-ecg", name: "ECG test", departmentId: "dept-ecg", departmentName: "ECG", active: true },
  ];
  const users = [];
  const displays = [];
  const services = [];
  const stations = [];
  const videos = options.videos ?? [];
  const requests = [];
  let paired = false;
  let displayType = options.displayType ?? "Department";
  const waiting = [{ id: "visit-2", visitCode: "Q-002", ticketNumber: "002", serviceId: "service-xray", serviceName: "Imaging", issuedAtUtc: "2026-10-20T00:00:00Z" }];
  const called = [];
  const completedReceiptSearches = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    let body = {};
    try { body = request.postDataJSON?.() ?? {}; } catch { /* multipart uploads have no JSON body */ }
    requests.push({ path, query: url.search, method, headers: request.headers(), body });
    const json = (payload, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

    if (path === "/auth/csrf" && method === "GET") return json({ requestToken: "test-token" });
    if (path === "/auth/session" && method === "GET") return json(role
      ? { authenticated: true, userName: "clinic-user", role, departmentIds: role === "Staff" ? ["dept-xray"] : [], serviceIds: role === "Staff" ? ["service-xray"] : [], mustChangePassword }
      : { authenticated: false, userName: null, role: null, departmentIds: [], requestToken: "test-token" });
    if (path === "/auth/login" && method === "POST") { role = "Reception"; mustChangePassword = forcePasswordChange; return route.fulfill({ status: 204 }); }
    if (path === "/auth/logout" && method === "POST") { role = null; return route.fulfill({ status: 204 }); }
    if (path === "/auth/change-password" && method === "POST") { mustChangePassword = false; return route.fulfill({ status: 204 }); }
    if (path === "/departments" && method === "GET") return json(departments);
    if (path === "/services/available" && method === "GET") {
      if (options.serviceLoadError) return route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ detail: "Service choices are temporarily unavailable." }) });
      return json(availableServices);
    }
    if (path === "/admin/departments" && method === "GET") return json(departments);
    if (path === "/admin/dashboard" && method === "GET") {
      if (options.dashboardDelayMs) await new Promise((resolve) => setTimeout(resolve, options.dashboardDelayMs));
      const dashboard = {
        updatedAtUtc: "2026-10-27T00:00:00Z",
        displays: { total: displays.length, active: displays.filter((item) => item.active).length, inactive: displays.filter((item) => !item.active).length },
        queue: {
          waitingCount: waiting.length,
          calledCount: called.length,
          departments: departments.map((item, index) => ({ departmentId: item.id, departmentName: item.name, waitingCount: index === 0 ? waiting.length : 0, calledCount: index === 0 ? called.length : 0 })),
        },
      };
      if (url.searchParams.get("includeConfiguration") !== "false") {
        Object.assign(dashboard, {
          configurationUpdatedAtUtc: "2026-10-27T00:00:00Z",
          departments: { total: departments.length, active: departments.filter((item) => item.active).length, inactive: departments.filter((item) => !item.active).length },
          services: { total: services.length, active: services.filter((item) => item.active).length, inactive: services.filter((item) => !item.active).length },
          stations: { total: stations.length, active: stations.filter((item) => item.active).length, inactive: stations.filter((item) => !item.active).length },
          users: { total: users.length, active: users.filter((item) => item.active).length, inactive: users.filter((item) => !item.active).length },
          kiosks: { total: 0, active: 0, inactive: 0 },
          setupChecks: { departmentsWithoutActiveServices: 0, stationsWithoutActiveStaff: 0 },
        });
      }
      return json(dashboard);
    }
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
      const serviceIds = body.serviceIds ?? [];
      const departmentIds = [...new Set(serviceIds.map((id) => services.find((service) => service.id === id)?.departmentId).filter(Boolean))];
      const created = { id: "user-new", userName: body.userName, role: body.role, departmentIds, serviceIds, active: true };
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
    if (path.startsWith("/admin/users/") && method === "DELETE") {
      if (options.deleteUserError) return route.fulfill({ status: 409, contentType: "application/problem+json", body: JSON.stringify({ title: "This account has visit history.", detail: "Deactivate it to keep those records." }) });
      users.splice(users.findIndex((item) => item.id === path.split("/").at(-1)), 1);
      return route.fulfill({ status: 204 });
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
      const created = { id: "display-new", ...body, type: body.departmentId ? "Department" : "Lobby", active: true };
      displays.push(created);
      return json(created, 201);
    }
    if (path.startsWith("/admin/displays/") && method === "PATCH") {
      const display = displays.find((item) => item.id === path.split("/").at(-1));
      Object.assign(display, body);
      return json(display);
    }
    if (path.endsWith("/pairing-code") && method === "POST") return json({ code: "PAIR-1234" });
    if (path === "/displays/activate" && method === "POST") { paired = true; return json({ paired: true, displayType }); }
    if (path === "/admin/display-videos" && method === "GET") return json(videos);
    if (path === "/admin/display-videos/urls" && method === "POST") {
      const video = { id: `video-${videos.length + 1}`, name: new URL(body.url).pathname.split("/").at(-1), url: body.url, contentType: "video/mp4" };
      videos.push(video);
      return json(video, 201);
    }
    if (path === "/admin/display-videos/upload" && method === "POST") {
      const video = { id: `video-${videos.length + 1}`, name: "clinic-info.webm", url: null, contentType: "video/webm" };
      videos.push(video);
      return json(video, 201);
    }
    if (path.startsWith("/admin/display-videos/") && method === "DELETE") {
      videos.splice(videos.findIndex((video) => path.endsWith(video.id)), 1);
      return route.fulfill({ status: 204 });
    }
    if (path === "/displays/me/lobby-snapshot" && method === "GET") return paired && displayType === "Lobby"
      ? json([
        { departmentName: "ECG", called: "001", waiting: ["002", "003"] },
        { departmentName: "X-ray", called: null, waiting: ["008", "009", "010"] },
      ])
      : route.fulfill({ status: 403, contentType: "application/problem+json", body: JSON.stringify({ title: "Forbidden" }) });
    if (path === "/displays/me/videos" && method === "GET") return paired && displayType === "Lobby"
      ? json(videos.map((video) => ({ id: video.id, url: video.url ?? "/api/v1/displays/me/videos/video-1/content" })))
      : route.fulfill({ status: 403, contentType: "application/problem+json", body: JSON.stringify({ title: "Forbidden" }) });
    if (path === "/displays/me/snapshot" && method === "GET") return paired
      ? json({ departmentName: "X-ray", waiting: [{ visitCode: "Q-002", ticketNumber: "002", status: "Pending" }], called: [{ visitCode: "Q-001", ticketNumber: "001", status: "Called" }] })
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
      return json({ id, visitCode: "Q-002", completed: false, nextDepartmentId: "dept-ecg", nextServiceId: body.nextServiceId, nextDepartmentTicketNumber: 3 });
    }
    if (path === "/visits" && method === "POST") {
      const service = availableServices.find((item) => item.id === body.initialServiceId);
      return json({ id: "visit-new", visitCode: "003", ticketNumber: "001", departmentTicketNumber: 1, clinicDate: "2026-10-21", serviceId: service.id, serviceName: service.name, departmentId: service.departmentId, departmentName: service.departmentName, appointmentAtUtc: null, issuedAtUtc: "2026-10-20T00:00:00Z" }, 201);
    }
    if (path === "/reception/visits/receipt-search" && method === "POST") {
      if (body.lookupValue === options.delayedSearchValue) await options.delayedSearchGate;
      completedReceiptSearches.push(body.lookupValue);
      const matches = options.receiptMatchesByValue?.[body.lookupValue]
        ?? options.receiptMatches
        ?? [{ id: "visit-found", visitCode: body.lookupValue, ticketNumber: "001", departmentTicketNumber: 1, clinicDate: body.clinicDate, serviceName: "Imaging", departmentName: "X-ray", issuedAtUtc: "2026-10-20T00:00:00Z" }];
      return json({ matches, truncated: options.receiptSearchTruncated ?? false });
    }
    if (/^\/reception\/visits\/[^/]+\/receipt$/.test(path) && method === "GET") {
      const id = path.split("/")[3];
      const match = options.receiptMatches?.find((item) => item.id === id);
      return json({ id, visitCode: match?.visitCode ?? "003", ticketNumber: match?.ticketNumber ?? "001", departmentTicketNumber: match?.departmentTicketNumber ?? 1, clinicDate: match?.clinicDate ?? "2026-10-21", serviceId: "service-xray", serviceName: match?.serviceName ?? "Imaging", departmentId: "dept-xray", departmentName: match?.departmentName ?? "X-ray", issuedAtUtc: match?.issuedAtUtc ?? "2026-10-20T00:00:00Z", isReprint: true });
    }
    return route.fulfill({ status: 404, contentType: "application/problem+json", body: JSON.stringify({ detail: `Unhandled mock route: ${method} ${path}` }) });
  });
  return { requests, departments, completedReceiptSearches };
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
  await page.getByRole("textbox", { name: "Temporary password" }).fill("temporary-password");
  await page.getByRole("button", { name: "Show entered characters" }).first().click();
  await expect(page.getByRole("textbox", { name: "Temporary password" })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide entered characters" }).first().click();
  await page.getByLabel("New password", { exact: true }).fill("short");
  await expect(page.getByRole("list", { name: "Password requirements" })).toContainText("At least 12 characters");
  await expect(page.getByRole("button", { name: "Change password" })).toBeDisabled();
  await page.getByLabel("New password", { exact: true }).fill("Private-password1");
  await page.getByLabel("Confirm new password").fill("Private-password1");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/reception$/);
  expect(requests.find((entry) => entry.path === "/auth/change-password").body).toEqual({ currentPassword: "temporary-password", newPassword: "Private-password1" });
});

test("admin can configure each section through the sidebar and sees only the selected section", async ({ page }) => {
  const behavior = { deleteUserError: true };
  const { requests } = await mockApi(page, "Admin", false, behavior);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your clinic" })).toBeVisible();
  const adminSections = page.getByRole("group", { name: "Admin sections" });
  await expect(adminSections.getByRole("region", { name: "Overview" })).toBeVisible();
  await adminSections.getByRole("link", { name: /^Departments/ }).click();
  await expect(page).toHaveURL(/\/admin\/departments$/);
  await expect(page.getByRole("region", { name: "Departments" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Services" })).toHaveCount(0);
  await expect(adminSections.getByRole("region", { name: "Clinic setup" })).toBeVisible();
  await expect(adminSections.getByRole("region", { name: "Access" })).toBeVisible();
  await expect(adminSections.getByRole("region", { name: "Devices" })).toBeVisible();
  await page.getByRole("button", { name: "Add department" }).click();
  await page.getByLabel("Department name").fill("Ultrasound");
  await page.getByRole("dialog", { name: "Add department" }).getByRole("button", { name: "Save department" }).click();
  await expect(page.getByRole("region", { name: "Departments" }).getByText("Ultrasound", { exact: true })).toBeVisible();

  const ecgDepartment = page.locator(".admin-department-list li").filter({ hasText: "ECG" });
  await ecgDepartment.getByText("Actions").click();
  await ecgDepartment.getByRole("button", { name: "Deactivate" }).click();
  await expect(ecgDepartment.locator(".admin-status-badge")).toHaveText("Inactive");
  await ecgDepartment.getByText("Actions").click();
  await ecgDepartment.getByRole("button", { name: "Reactivate" }).click();
  await expect(ecgDepartment.locator(".admin-status-badge")).toHaveText("Active");
  await expect(page.getByText("ECG reactivated.")).toBeVisible();
  expect(requests.filter((entry) => entry.path === "/admin/departments/dept-ecg" && entry.method === "PATCH").at(-1).body).toEqual({ active: true });

  await page.getByRole("link", { name: /^Services\b/ }).click();
  await expect(page).toHaveURL(/\/admin\/services$/);
  await expect(page.getByRole("region", { name: "Departments" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add service" }).click();
  const addServiceDialog = page.getByRole("dialog", { name: "Add service" });
  await addServiceDialog.getByLabel("Service name").fill("X-ray Imaging");
  await addServiceDialog.getByLabel("Department").selectOption("dept-xray");
  await addServiceDialog.getByRole("button", { name: "Save service" }).click();
  await expect(page.getByRole("region", { name: "Services" }).getByText("X-ray Imaging", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Users & access" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("region", { name: "Services" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add user" }).click();
  const addUserDialog = page.getByRole("dialog", { name: "Add user" });
  await addUserDialog.getByLabel("Username", { exact: true }).fill("new-staff");
  await addUserDialog.getByLabel("Role", { exact: true }).selectOption("Staff");
  await addUserDialog.getByRole("checkbox", { name: "X-ray · X-ray Imaging" }).check();
  await addUserDialog.getByRole("button", { name: "Provision user" }).click();
  const credentialDialog = page.getByRole("dialog", { name: "Temporary password generated" });
  await expect(credentialDialog).toContainText("Username: new-staff");
  const temporaryPassword = credentialDialog.getByRole("textbox", { name: "Temporary password" });
  await expect(temporaryPassword).toHaveValue("one-time-secret");
  await credentialDialog.getByRole("button", { name: "Hide temporary password" }).click();
  await expect(temporaryPassword).toHaveAttribute("type", "password");
  await credentialDialog.getByRole("button", { name: "Show temporary password" }).click();
  await credentialDialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Password")).toHaveCount(0);
  expect(requests.find((entry) => entry.path === "/admin/users" && entry.method === "POST").body)
    .toMatchObject({ role: "Staff", serviceIds: ["service-new"] });

  await page.getByRole("link", { name: "Stations" }).click();
  await expect(page).toHaveURL(/\/admin\/stations$/);
  await page.getByRole("button", { name: "Add station" }).click();
  const addStationDialog = page.getByRole("dialog", { name: "Add station" });
  await addStationDialog.getByLabel("Station name").fill("Window 1");
  await addStationDialog.getByLabel("Department").selectOption("dept-xray");
  await addStationDialog.getByRole("checkbox", { name: "X-ray Imaging" }).check();
  await addStationDialog.getByRole("checkbox", { name: "new-staff" }).check();
  await addStationDialog.getByRole("button", { name: "Save station" }).click();
  const stationRegion = page.getByRole("region", { name: "Stations" });
  await expect(stationRegion.getByText("Window 1", { exact: true })).toBeVisible();
  await expect(stationRegion.locator(".admin-record-details")).toContainText("X-ray Imaging");
  await expect(stationRegion.locator(".admin-record-details")).toContainText("new-staff");
  const savedStationRecord = stationRegion.locator(".admin-record").filter({ hasText: "Window 1" });
  await savedStationRecord.getByText("Actions").click();
  await savedStationRecord.getByRole("button", { name: "Edit station" }).click();
  const editStationDialog = page.getByRole("dialog", { name: "Edit station" });
  await editStationDialog.getByLabel("Station name").fill("Window 1 Front Desk");
  await editStationDialog.getByRole("button", { name: "Save station" }).click();
  await expect(stationRegion.getByText("Window 1 Front Desk", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Users & access" }).click();
  const savedUserRecord = page.getByRole("region", { name: "Users & access" }).locator(".admin-record").filter({ hasText: "new-staff" });
  await expect(savedUserRecord.locator(".admin-record-details")).toContainText("X-ray · X-ray Imaging");
  await savedUserRecord.getByText("Actions").click();
  await savedUserRecord.getByRole("button", { name: "Deactivate" }).click();
  await expect(savedUserRecord.locator(".admin-status-badge")).toHaveText("Inactive");

  await savedUserRecord.getByText("Actions").click();
  await savedUserRecord.getByRole("button", { name: "Edit access" }).click();
  const roleChangeForm = page.getByRole("dialog", { name: "Edit user access" });
  await roleChangeForm.getByLabel("Role").selectOption("Reception");
  await roleChangeForm.getByRole("button", { name: "Save user access" }).click();
  const roleChangeRequest = requests.filter((entry) => entry.path === "/admin/users/user-new" && entry.method === "PATCH").at(-1);
  expect(roleChangeRequest.body).toMatchObject({ role: "Reception", serviceIds: [] });

  await page.getByRole("link", { name: "Stations" }).click();
  const refreshedStationRegion = page.getByRole("region", { name: "Stations" });
  await expect(refreshedStationRegion).toContainText("Staff: None assigned");
  await page.getByRole("link", { name: "Users & access" }).click();
  const deleteRecord = page.getByRole("region", { name: "Users & access" }).locator(".admin-record").filter({ hasText: "new-staff" });
  await deleteRecord.getByText("Actions").click();
  await deleteRecord.getByRole("button", { name: "Delete user" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("permanently removes this account");
  await expect(page.getByRole("alertdialog").getByRole("button", { name: "Cancel" })).toHaveCSS("color", "rgb(32, 50, 49)");
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await deleteRecord.getByText("Actions").click();
  await deleteRecord.getByRole("button", { name: "Delete user" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete user" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Deactivate it to keep those records.");
  behavior.deleteUserError = false;
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete user" }).click();
  await expect(deleteRecord).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(requests.some((entry) => entry.path === "/admin/users/user-new" && entry.method === "DELETE")).toBe(true);

  await page.getByRole("link", { name: "Stations" }).click();
  await page.getByRole("link", { name: "Displays" }).click();
  await expect(page).toHaveURL(/\/admin\/displays$/);
  await page.getByRole("button", { name: "Add display" }).click();
  const addDisplayDialog = page.getByRole("dialog", { name: "Register display" });
  await addDisplayDialog.getByLabel("Display name").fill("X-ray Waiting Room");
  await addDisplayDialog.getByLabel("Assigned department", { exact: true }).selectOption("dept-xray");
  await addDisplayDialog.getByRole("button", { name: "Save display" }).click();
  await expect(page.getByText("X-ray Waiting Room", { exact: true })).toBeVisible();
  const displayRecord = page.locator(".admin-record").filter({ hasText: "X-ray Waiting Room" });
  await displayRecord.getByText("Actions").click();
  await displayRecord.getByRole("button", { name: "Create pairing code" }).click();
  const pairingDialog = page.getByRole("dialog", { name: "Monitor pairing code" });
  await expect(pairingDialog.getByLabel("One-time pairing code")).toHaveValue("PAIR-1234");
  await expect(pairingDialog.getByRole("link", { name: "Open monitor pairing page in a new tab" })).toHaveAttribute("target", "_blank");
  await expect(pairingDialog.getByRole("link", { name: "Open monitor pairing page in a new tab" })).toHaveAttribute("href", "/display/pair");
  await pairingDialog.getByRole("button", { name: "Close" }).click();
  await displayRecord.getByText("Actions").click();
  await displayRecord.getByRole("button", { name: "Revoke display" }).click();
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

test("dashboard initial load recovers from StrictMode's aborted first request", async ({ page }) => {
  const { requests } = await mockApi(page, "Admin", false, { dashboardDelayMs: 500 });
  const startedAt = Date.now();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Your clinic" })).toBeVisible();
  await expect.poll(() => requests.filter((entry) => entry.path === "/admin/dashboard").length).toBeGreaterThan(0);
  await page.waitForTimeout(750);
  expect(
    requests.filter((entry) => entry.path === "/admin/dashboard").length,
    "StrictMode remount should start a replacement dashboard request after aborting the first",
  ).toBeGreaterThan(1);
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 5_000 });
  expect(Date.now() - startedAt).toBeLessThan(5_000);
  expect(requests.filter((entry) => entry.path === "/admin/dashboard").length).toBeGreaterThan(0);
  await expect.poll(() => requests.some((entry) => entry.path === "/admin/dashboard" && entry.query.includes("includeConfiguration=false")), { timeout: 20_000 }).toBe(true);
  await expect(page.getByRole("button", { name: "Refresh overview" })).toBeEnabled();
  await page.getByRole("button", { name: "Refresh overview" }).click();
  await expect.poll(() => requests.some((entry) => entry.path === "/admin/dashboard" && entry.query.includes("refreshConfiguration=true"))).toBe(true);
});

test("dashboard replaces an endless initial loader with a timeout and retry action", async ({ page }) => {
  const { requests } = await mockApi(page, "Admin", false, { dashboardDelayMs: 15_000 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Your clinic" })).toBeVisible();
  await expect.poll(() => requests.filter((entry) => entry.path === "/admin/dashboard").length).toBeGreaterThan(1);

  await expect(page.getByRole("alert")).toContainText("took too long to load", { timeout: 12_000 });
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("reception issues a service-linked appointment and manually reprints by explicit visit-code search", async ({ page }) => {
  const { requests } = await mockApi(page, "Reception");
  await page.addInitScript(() => { window.print = () => { window.printRequested = true; }; });
  await page.goto("/reception");
  await expect(page.getByRole("heading", { name: "Issue a visit" })).toBeVisible();
  await expect(page.getByLabel("Auto-print")).toHaveCount(0);
  await expect(page.getByRole("option", { name: "80 mm" })).toHaveCount(0);
  await page.getByLabel("Appointment time Optional").fill("2026-10-20T09:30");
  await page.getByLabel("Non-identifying reference Optional").fill("REF-A7");
  await page.getByRole("button", { name: "Issue visit" }).click();
  await expect(page.locator(".receipt-number")).toHaveText("001");
  await expect(page.locator(".receipt-reference")).toContainText("003");
  await expect(page.locator(".ticket-receipt")).not.toContainText("REF-A7");
  expect(await page.evaluate(() => window.printRequested)).toBeUndefined();
  await expect(page.locator(".reception-toast")).toBeVisible();
  await expect(page.locator(".reception-toast-message")).toHaveText("Ticket 001 issued for X-ray.");
  await page.getByRole("button", { name: "Close notification" }).click();
  await expect(page.locator(".reception-toast")).toHaveCount(0);
  const issued = requests.find((entry) => entry.path === "/visits" && entry.method === "POST");
  expect(issued.body).toEqual({ initialServiceId: "service-xray", appointmentAtLocal: "2026-10-20T09:30", referenceId: "REF-A7" });
  expect(issued.headers["idempotency-key"]).toBeTruthy();
  await page.getByRole("button", { name: "Print / reprint" }).click();
  await expect.poll(() => page.evaluate(() => window.printRequested)).toBe(true);
  await page.getByLabel("Search by").selectOption("visitCode");
  await page.getByLabel("Visit code", { exact: true }).fill("003");
  await page.getByLabel("Clinic date").fill("2026-10-21");
  await page.getByRole("button", { name: "Find visit" }).click();
  await page.getByRole("button", { name: /001 · X-ray/ }).click();
  await expect(page.locator(".receipt-number")).toHaveText("001");
  await expect(page.locator(".receipt-reference")).toContainText("003");
  await expect(page.locator(".receipt-reprint-banner")).toBeVisible();
  await expect(page.locator(".reception-reprint-tag")).toHaveText("Reprint");
  const receiptSearch = requests.find((entry) => entry.path === "/reception/visits/receipt-search");
  expect(receiptSearch).toMatchObject({ path: "/reception/visits/receipt-search", query: "", method: "POST", body: { lookupType: "visitCode", lookupValue: "003", clinicDate: "2026-10-21" } });
  expect(requests.find((entry) => entry.path === "/reception/visits/visit-found/receipt").method).toBe("GET");
});

test("reception shows duplicate non-identifying-reference matches and lets the user choose", async ({ page }) => {
  const { requests } = await mockApi(page, "Reception", false, { receiptMatches: [
    { id: "visit-earlier", visitCode: "014", ticketNumber: "004", departmentTicketNumber: 4, clinicDate: "2026-10-21", serviceName: "Imaging", departmentName: "X-ray", issuedAtUtc: "2026-10-20T00:00:00Z" },
    { id: "visit-later", visitCode: "015", ticketNumber: "002", departmentTicketNumber: 2, clinicDate: "2026-10-21", serviceName: "ECG", departmentName: "ECG", issuedAtUtc: "2026-10-20T01:00:00Z" },
  ] });
  await page.goto("/reception");
  await page.getByLabel("Search by").selectOption("referenceId");
  await page.getByLabel("Non-identifying reference", { exact: true }).fill("REF-A7");
  await page.getByLabel("Clinic date").fill("2026-10-21");
  await page.getByRole("button", { name: "Find visit" }).click();
  await expect(page.getByRole("button", { name: /004 · X-ray/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /002 · ECG/ })).toBeVisible();
  await page.getByLabel("Non-identifying reference", { exact: true }).fill("REF-B8");
  await expect(page.getByRole("button", { name: /004 · X-ray/ })).toHaveCount(0);
  await page.getByLabel("Non-identifying reference", { exact: true }).fill("REF-A7");
  await page.getByLabel("Clinic date").fill("2026-10-22");
  await expect(page.getByRole("button", { name: /002 · ECG/ })).toHaveCount(0);
  await page.getByLabel("Clinic date").fill("2026-10-21");
  await page.getByRole("button", { name: "Find visit" }).click();
  await expect(page.getByRole("button", { name: /004 · X-ray/ })).toBeVisible();
  await page.getByRole("button", { name: /002 · ECG/ }).click();
  await expect(page.locator(".receipt-reference")).toContainText("015");
  await expect(page.locator(".ticket-receipt")).not.toContainText("REF-A7");
  expect(requests.find((entry) => entry.path === "/reception/visits/receipt-search")).toMatchObject({
    method: "POST",
    query: "",
    body: { lookupType: "referenceId", lookupValue: "REF-A7", clinicDate: "2026-10-21" },
  });
  expect(requests.find((entry) => entry.path === "/reception/visits/visit-later/receipt")).toBeTruthy();
});

test("a slower earlier receipt search cannot replace matches for the current criteria", async ({ page }) => {
  let releaseOlderSearch;
  const delayedSearchGate = new Promise((resolve) => { releaseOlderSearch = resolve; });
  const { completedReceiptSearches } = await mockApi(page, "Reception", false, {
    delayedSearchValue: "REF-A7",
    delayedSearchGate,
    receiptMatchesByValue: {
      "REF-A7": [{ id: "visit-stale", visitCode: "011", ticketNumber: "011", departmentName: "X-ray", serviceName: "Imaging", clinicDate: "2026-10-21", issuedAtUtc: "2026-10-20T00:00:00Z" }],
      "REF-B8": [{ id: "visit-current", visitCode: "012", ticketNumber: "012", departmentName: "ECG", serviceName: "ECG", clinicDate: "2026-10-21", issuedAtUtc: "2026-10-20T00:00:00Z" }],
    },
  });
  await page.goto("/reception");
  await page.getByLabel("Search by").selectOption("referenceId");
  await page.getByLabel("Non-identifying reference", { exact: true }).fill("REF-A7");
  await page.getByLabel("Clinic date").fill("2026-10-21");
  await page.getByRole("button", { name: "Find visit" }).click();
  await page.getByLabel("Non-identifying reference", { exact: true }).fill("REF-B8");
  await page.getByRole("button", { name: "Find visit" }).click();
  await expect(page.getByRole("button", { name: /012 · ECG/ })).toBeVisible();
  releaseOlderSearch();
  await expect.poll(() => completedReceiptSearches).toContain("REF-A7");
  await expect(page.getByRole("button", { name: /012 · ECG/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /011 · X-ray/ })).toHaveCount(0);
});

test("reception explains when no active services are configured", async ({ page }) => {
  await mockApi(page, "Reception", false, { availableServices: [] });
  await page.goto("/reception");
  await expect(page.getByText("No active services are available.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Issue visit" })).toBeDisabled();
});

test("reception reports service-choice loading failures", async ({ page }) => {
  await mockApi(page, "Reception", false, { serviceLoadError: true });
  await page.goto("/reception");
  await expect(page.getByRole("alert")).toContainText("Service choices are temporarily unavailable.");
  await expect(page.getByRole("button", { name: "Issue visit" })).toBeDisabled();
});

test("assigned staff can call, return a no-show, and complete a visit", async ({ page }) => {
  const { requests } = await mockApi(page, "Staff");
  await page.goto("/department");
  await expect(page.getByRole("heading", { name: "Department queue" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Imaging", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Call next" }).click();
  await expect(page.locator(".action-message[role='status']")).toContainText("Now calling 002");
  await page.getByRole("button", { name: "Return no-show to pending" }).first().click();
  await expect(page.getByText("002 returned to pending.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Call next" }).click();
  await page.getByLabel("Forward to service").selectOption("service-ecg");
  await page.getByRole("button", { name: "Complete / forward" }).first().click();
  await expect(page.getByText("Forwarded with destination ticket 003.", { exact: true })).toBeVisible();
  expect(requests.find((entry) => entry.path === "/visits/visit-2/complete").body).toEqual({ nextServiceId: "service-ecg" });
});

test("paired display uses its device session without requiring staff sign-in", async ({ page }) => {
  const { requests } = await mockApi(page);
  await page.route("**/hubs/displays/negotiate**", (route) => route.fulfill({ status: 404, body: "Hub not running in UI mock" }));
  await page.goto("/display/pair");
  await page.getByLabel("Pairing code").fill("PAIR-1234");
  await page.getByRole("button", { name: "Activate display" }).click();
  await expect(page).toHaveURL(/\/display$/);
  await expect(page.getByRole("heading", { name: "X-ray" })).toBeVisible();
  await expect(page.getByText("001", { exact: true })).toBeVisible();
  expect(requests.some((entry) => entry.path === "/auth/session")).toBe(false);
  expect(requests.some((entry) => entry.path === "/displays/me/snapshot")).toBe(true);
  expect(requests.find((entry) => entry.path === "/displays/activate").headers["x-csrf-token"]).toBe("test-token");
});

test("admin registers a lobby display and manages URL and uploaded playlist videos", async ({ page }) => {
  const { requests } = await mockApi(page, "Admin");
  await page.goto("/admin/displays");
  await page.getByRole("button", { name: "Add display" }).click();
  const createDialog = page.getByRole("dialog", { name: "Register display" });
  await createDialog.getByLabel("Display name").fill("Main Lobby");
  await createDialog.getByLabel("Display type").selectOption("Lobby");
  await createDialog.getByRole("button", { name: "Save display" }).click();
  await expect(page.getByText("Main Lobby", { exact: true })).toBeVisible();
  await expect(page.locator(".admin-record").filter({ hasText: "Main Lobby" })).toContainText("All active departments");

  await page.getByRole("button", { name: /Lobby video playlist/ }).click();
  await page.getByRole("button", { name: "Add video" }).click();
  const urlDialog = page.getByRole("dialog", { name: "Add lobby video" });
  await urlDialog.getByLabel("Direct HTTPS video URL (.mp4 or .webm)").fill("https://media.example.org/welcome.mp4");
  await urlDialog.getByRole("button", { name: "Add video", exact: true }).click();
  await expect(page.getByText("welcome.mp4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add video" }).click();
  const uploadDialog = page.getByRole("dialog", { name: "Add lobby video" });
  await uploadDialog.getByLabel("Video source").selectOption("upload");
  await uploadDialog.getByLabel("Video file (MP4 or WebM, up to 250 MiB)").setInputFiles({
    name: "clinic-info.webm",
    mimeType: "video/webm",
    buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x93]),
  });
  await uploadDialog.getByRole("button", { name: "Upload video" }).click();
  await expect(page.getByText("clinic-info.webm", { exact: true })).toBeVisible();
  expect(requests.find((entry) => entry.path === "/admin/display-videos/upload").headers["content-type"]).toContain("multipart/form-data; boundary=");
  const videoRow = page.locator(".admin-video-list li").filter({ hasText: "clinic-info.webm" });
  await videoRow.getByText("Actions").click();
  await videoRow.getByRole("button", { name: "Remove video" }).click();
  await expect(page.getByText("clinic-info.webm", { exact: true })).toHaveCount(0);
});

test("paired lobby display shows active department calls, three waiting codes, and video start", async ({ page }) => {
  const { requests } = await mockApi(page, null, false, {
    displayType: "Lobby",
    videos: [{ id: "video-1", name: "welcome.mp4", url: "https://media.example.org/info.mp4", contentType: "video/mp4" }],
  });
  await page.route("**/hubs/displays/negotiate**", (route) => route.fulfill({ status: 404, body: "Hub not running in UI mock" }));
  await page.route("https://media.example.org/info.mp4", (route) => route.fulfill({ status: 200, contentType: "video/mp4", body: "" }));
  await page.goto("/display/pair");
  await page.getByLabel("Pairing code").fill("PAIR-1234");
  await page.getByRole("button", { name: "Activate display" }).click();
  await expect(page).toHaveURL(/\/display\/lobby$/);
  await expect(page.getByRole("heading", { name: "Now serving" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "ECG" })).toContainText("001");
  await expect(page.getByRole("article").filter({ hasText: "X-ray" })).toContainText("010");
  await expect(page.getByRole("button", { name: /Enable video sound|Play video with sound/ })).toBeVisible();
  await expect(page.locator("video")).toHaveAttribute("autoplay", "");
  await expect(page.locator("video")).toHaveJSProperty("muted", true);
  expect(requests.some((entry) => entry.path === "/displays/me/lobby-snapshot")).toBe(true);
  expect(requests.some((entry) => entry.path === "/displays/me/videos")).toBe(true);
  expect(requests.some((entry) => entry.path === "/auth/session")).toBe(false);
});
