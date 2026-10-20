import { randomUUID } from "node:crypto";
import process from "node:process";
import { expect, request, test } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:5271";

function clinicLocalDateTime(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const fields = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

async function csrf(context) {
  const response = await context.get("/api/v1/auth/csrf");
  const body = await response.text();
  expect(response.ok(), `CSRF endpoint returned ${response.status()}: ${body}`).toBeTruthy();
  return JSON.parse(body).requestToken;
}

async function mutate(context, path, method, data, headers = {}) {
  return context.fetch(path, {
    method,
    data,
    headers: { "X-CSRF-TOKEN": await csrf(context), ...headers },
  });
}

async function signIn(context, userName, password) {
  const response = await mutate(context, "/api/v1/auth/login", "POST", { userName, password });
  expect(response.status()).toBe(200);
  return response.json();
}

async function provisionUser(admin, userName, role, departmentIds) {
  const response = await mutate(admin, "/api/v1/admin/users", "POST", { userName, role, departmentIds });
  const body = await response.text();
  expect(response.status(), `Provision user returned ${response.status()}: ${body}`).toBe(201);
  return JSON.parse(body);
}

async function signInAndChangePassword(userName, oneTimeCredential) {
  const context = await request.newContext({ baseURL: apiBaseUrl });
  const newPassword = `Clinic-Test-${randomUUID()}!A1`;
  const session = await signIn(context, userName, oneTimeCredential);
  expect(session.mustChangePassword).toBe(true);
  const changed = await mutate(context, "/api/v1/auth/change-password", "POST", {
    currentPassword: oneTimeCredential,
    newPassword,
  });
  expect(changed.status()).toBe(200);
  expect((await changed.json()).mustChangePassword).toBe(false);
  return { context, password: newPassword };
}

test("MySQL API and browser preserve visit flow, authorization, and login-free display scope", async ({ browser, page }) => {
  test.skip(process.env.QUEUING_MYSQL_E2E !== "1", "set QUEUING_MYSQL_E2E=1 to run against an isolated MySQL test database");
  const connectionString = process.env.ConnectionStrings__Queueing ?? "";
  const databaseName = /(?:database|initial catalog)\s*=\s*([^;]+)/i.exec(connectionString)?.[1]?.trim();
  expect(databaseName?.toLowerCase().endsWith("_test")).toBe(true);
  expect(process.env.QUEUING_E2E_ADMIN_USERNAME).toBeTruthy();
  expect(process.env.QUEUING_E2E_ADMIN_PASSWORD).toBeTruthy();

  const admin = await request.newContext({ baseURL: apiBaseUrl });
  let reception;
  let staff;
  let otherStaff;
  const users = [];
  let displayId;
  let browserDisplayId;
  let device;
  let browserStaffContext;
  let displayBrowserContext;
  try {
    await signIn(admin, process.env.QUEUING_E2E_ADMIN_USERNAME, process.env.QUEUING_E2E_ADMIN_PASSWORD);
    const departmentsResponse = await admin.get("/api/v1/admin/departments");
    expect(departmentsResponse.status()).toBe(200);
    const suffix = randomUUID().slice(0, 8);
    for (const name of ["X-ray", "ECG"]) {
      const response = await mutate(admin, "/api/v1/admin/departments", "POST", { name: `${name} test ${suffix}` });
      expect(response.status()).toBe(201);
    }
    const testDepartmentsResponse = await admin.get("/api/v1/admin/departments");
    const testDepartments = await testDepartmentsResponse.json();
    const xray = testDepartments.find((department) => department.name === `X-ray test ${suffix}`);
    const ecg = testDepartments.find((department) => department.name === `ECG test ${suffix}`);
    expect(xray?.active).toBe(true);
    expect(ecg?.active).toBe(true);

    const receptionUser = await provisionUser(admin, `reception-${suffix}`, "Reception", []);
    const staffUser = await provisionUser(admin, `staff-${suffix}`, "Staff", [xray.id, ecg.id]);
    const ecgOnlyUser = await provisionUser(admin, `ecg-staff-${suffix}`, "Staff", [ecg.id]);
    users.push(
      { ...receptionUser, role: "Reception", departmentIds: [] },
      { ...staffUser, role: "Staff", departmentIds: [xray.id, ecg.id] },
      { ...ecgOnlyUser, role: "Staff", departmentIds: [ecg.id] },
    );

    const monitorResponse = await mutate(admin, "/api/v1/admin/displays", "POST", {
      name: `X-ray test monitor ${suffix}`,
      departmentId: xray.id,
    });
    expect(monitorResponse.status()).toBe(201);
    displayId = (await monitorResponse.json()).id;
    const pairingResponse = await mutate(admin, `/api/v1/admin/displays/${displayId}/pairing-code`, "POST");
    expect(pairingResponse.status()).toBe(200);

    device = await request.newContext({ baseURL: apiBaseUrl });
    const activation = await mutate(device, "/api/v1/displays/activate", "POST", { code: (await pairingResponse.json()).code });
    expect(activation.status()).toBe(200);
    expect((await device.get("/api/v1/displays/me/snapshot")).status()).toBe(200);

    const receptionSession = await signInAndChangePassword(receptionUser.userName, receptionUser.oneTimeCredential);
    const staffSession = await signInAndChangePassword(staffUser.userName, staffUser.oneTimeCredential);
    const otherStaffSession = await signInAndChangePassword(ecgOnlyUser.userName, ecgOnlyUser.oneTimeCredential);
    reception = receptionSession.context;
    staff = staffSession.context;
    otherStaff = otherStaffSession.context;
    expect((await otherStaff.get(`/api/v1/departments/${xray.id}/queue`)).status()).toBe(403);

    const issue = async (departmentId, appointmentAtLocal, key = randomUUID()) => {
      const response = await mutate(reception, "/api/v1/visits", "POST", {
        initialDepartmentId: departmentId,
        appointmentAtLocal,
      }, { "Idempotency-Key": key });
      return { response, key };
    };
    const futureKey = randomUUID();
    const futureAppointment = clinicLocalDateTime(30);
    const future = await issue(xray.id, futureAppointment, futureKey);
    expect(future.response.status()).toBe(201);
    const futureVisit = await future.response.json();
    const replay = await issue(xray.id, futureAppointment, futureKey);
    expect(replay.response.status()).toBe(200);
    expect((await replay.response.json()).id).toBe(futureVisit.id);
    const keyConflict = await issue(ecg.id, futureAppointment, futureKey);
    expect(keyConflict.response.status()).toBe(409);
    const due = await issue(xray.id, clinicLocalDateTime(-5));
    expect(due.response.status()).toBe(201);
    const dueVisit = await due.response.json();
    const walkIn = await issue(xray.id, null);
    expect(walkIn.response.status()).toBe(201);
    const walkInVisit = await walkIn.response.json();
    const laterWalkIn = await issue(xray.id, null);
    expect(laterWalkIn.response.status()).toBe(201);
    const laterWalkInVisit = await laterWalkIn.response.json();

    const calledDue = await mutate(staff, `/api/v1/departments/${xray.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() });
    expect(calledDue.status()).toBe(200);
    expect((await calledDue.json()).id).toBe(dueVisit.id);

    const noShowKey = randomUUID();
    const returned = await mutate(staff, `/api/v1/visits/${dueVisit.id}/return-to-pending`, "POST", undefined, { "Idempotency-Key": noShowKey });
    expect(returned.status()).toBe(200);
    expect((await mutate(staff, `/api/v1/visits/${dueVisit.id}/return-to-pending`, "POST", undefined, { "Idempotency-Key": noShowKey })).status()).toBe(200);
    const recalled = await mutate(staff, `/api/v1/departments/${xray.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() });
    expect(recalled.status()).toBe(200);
    expect((await recalled.json()).visitCode).toBe(dueVisit.visitCode);

    const forward = await mutate(staff, `/api/v1/visits/${dueVisit.id}/complete`, "POST", {
      nextDepartmentId: ecg.id,
      nextDepartmentAppointmentAtLocal: clinicLocalDateTime(-5),
    }, { "Idempotency-Key": randomUUID() });
    expect(forward.status()).toBe(200);
    expect((await forward.json()).visitCode).toBe(dueVisit.visitCode);
    const ecgCall = await mutate(staff, `/api/v1/departments/${ecg.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() });
    expect(ecgCall.status()).toBe(200);
    expect((await ecgCall.json()).visitCode).toBe(dueVisit.visitCode);
    expect((await mutate(staff, `/api/v1/visits/${dueVisit.id}/complete`, "POST", {}, { "Idempotency-Key": randomUUID() })).status()).toBe(200);

    const queueResponse = await staff.get(`/api/v1/departments/${xray.id}/queue`);
    const queue = await queueResponse.json();
    expect(queue.waiting.find((visit) => visit.id === futureVisit.id)).toMatchObject({ isEligible: false, visitCode: futureVisit.visitCode });
    const displaySnapshot = await (await device.get("/api/v1/displays/me/snapshot")).json();
    expect(displaySnapshot.departmentName).toBe(xray.name);
    expect(displaySnapshot.waiting.map((visit) => visit.visitCode)).toContain(futureVisit.visitCode);
    expect(JSON.stringify(displaySnapshot)).not.toMatch(/appointmentAt|patient|userName/i);

    const firstWalkInCall = await mutate(staff, `/api/v1/departments/${xray.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() });
    expect(firstWalkInCall.status()).toBe(200);
    expect((await firstWalkInCall.json()).id).toBe(walkInVisit.id);
    const concurrentCalls = await Promise.all([
      mutate(staff, `/api/v1/departments/${xray.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() }),
      mutate(staff, `/api/v1/departments/${xray.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() }),
    ]);
    expect(concurrentCalls.map((response) => response.status()).sort()).toEqual([200, 409]);
    const successfulCall = concurrentCalls.find((response) => response.status() === 200);
    expect((await successfulCall.json()).id).toBe(laterWalkInVisit.id);
    expect((await mutate(staff, `/api/v1/visits/${walkInVisit.id}/complete`, "POST", {}, { "Idempotency-Key": randomUUID() })).status()).toBe(200);
    expect((await mutate(staff, `/api/v1/visits/${laterWalkInVisit.id}/complete`, "POST", {}, { "Idempotency-Key": randomUUID() })).status()).toBe(200);
    expect((await mutate(staff, `/api/v1/departments/${xray.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() })).status()).toBe(409);

    await page.goto("/login");
    await page.getByLabel("Username").fill(receptionUser.userName);
    await page.getByLabel("Password").fill(receptionSession.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/reception$/);
    await page.getByLabel("First department").selectOption(xray.id);
    await page.getByRole("button", { name: "Issue visit" }).click();
    const browserVisitCode = await page.locator(".receipt-number").textContent();
    expect(browserVisitCode).toMatch(/^\d{3,}$/);

    const browserDisplayResponse = await mutate(admin, "/api/v1/admin/displays", "POST", {
      name: `Browser monitor ${suffix}`,
      departmentId: xray.id,
    });
    expect(browserDisplayResponse.status()).toBe(201);
    browserDisplayId = (await browserDisplayResponse.json()).id;
    const browserPairingResponse = await mutate(admin, `/api/v1/admin/displays/${browserDisplayId}/pairing-code`, "POST");
    expect(browserPairingResponse.status()).toBe(200);
    displayBrowserContext = await browser.newContext({ baseURL: "http://127.0.0.1:4173" });
    const displayPage = await displayBrowserContext.newPage();
    await displayPage.goto("/display/pair");
    await displayPage.getByLabel("Pairing code").fill((await browserPairingResponse.json()).code);
    await displayPage.getByRole("button", { name: "Activate display" }).click();
    await expect(displayPage).toHaveURL(/\/display$/);
    await expect(displayPage.getByRole("heading", { name: xray.name })).toBeVisible();
    await expect(displayPage.getByText(browserVisitCode, { exact: true })).toBeVisible();
    await expect(displayPage.getByText("Connection: connected")).toBeVisible();

    browserStaffContext = await browser.newContext({ baseURL: "http://127.0.0.1:4173" });
    const staffPage = await browserStaffContext.newPage();
    await staffPage.goto("/login");
    await staffPage.getByLabel("Username").fill(staffUser.userName);
    await staffPage.getByLabel("Password").fill(staffSession.password);
    await staffPage.getByRole("button", { name: "Sign in" }).click();
    await expect(staffPage).toHaveURL(/\/department$/);
    await expect(staffPage.getByRole("row", { name: new RegExp(browserVisitCode) })).toBeVisible();
    await staffPage.getByRole("button", { name: "Call next" }).click();
    await expect(staffPage.getByRole("status").filter({ hasText: `Now calling ${browserVisitCode}` })).toBeVisible();
    await expect(displayPage.getByRole("heading", { name: browserVisitCode })).toBeVisible();

    const browserDisplayRevoke = await mutate(admin, `/api/v1/admin/displays/${browserDisplayId}`, "PATCH", { active: false });
    expect(browserDisplayRevoke.status()).toBe(200);
    await expect(displayPage.getByRole("alert")).toContainText("This monitor is not paired or its access was revoked.");

    const revoke = await mutate(admin, `/api/v1/admin/displays/${displayId}`, "PATCH", { active: false });
    expect(revoke.status()).toBe(200);
    expect([401, 403]).toContain((await device.get("/api/v1/displays/me/snapshot")).status());
  } finally {
    if (displayId) await mutate(admin, `/api/v1/admin/displays/${displayId}`, "PATCH", { active: false }).catch(() => {});
    if (browserDisplayId) await mutate(admin, `/api/v1/admin/displays/${browserDisplayId}`, "PATCH", { active: false }).catch(() => {});
    for (const user of users) {
      await mutate(admin, `/api/v1/admin/users/${user.id}`, "PATCH", {
        role: user.role,
        departmentIds: user.departmentIds,
        active: false,
      }).catch(() => {});
    }
    await Promise.all([admin, reception, staff, otherStaff, device].filter(Boolean).map((context) => context.dispose()));
    await Promise.all([browserStaffContext, displayBrowserContext].filter(Boolean).map((context) => context.close()));
  }
});
