import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";
import { expect, request, test } from "@playwright/test";

const apiBaseUrl = process.env.QUEUING_E2E_API_URL ?? "http://127.0.0.1:5271";
const frontendBaseUrl = process.env.QUEUING_E2E_FRONTEND_URL ?? "http://127.0.0.1:4173";

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

async function provisionUser(admin, userName, role, serviceIds) {
  const response = await mutate(admin, "/api/v1/admin/users", "POST", { userName, role, serviceIds });
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

  const localSetup = await request.newContext({ baseURL: apiBaseUrl });
  const anonymousSession = await localSetup.get("/api/v1/auth/session");
  expect((await anonymousSession.json()).authenticated).toBe(false);
  expect((await localSetup.get("/api/v1/admin/services")).status()).toBe(200);
  expect((await localSetup.get("/api/v1/services/available")).status()).toBe(401);
  const localDepartment = await mutate(localSetup, "/api/v1/admin/departments", "POST", {
    name: `Local setup ${randomUUID().slice(0, 8)}`,
  });
  expect(localDepartment.status()).toBe(201);
  expect((await localSetup.get(`/api/v1/departments/${randomUUID()}/queue`)).status()).toBe(401);
  await localSetup.dispose();

  const admin = await request.newContext({ baseURL: apiBaseUrl });
  let reception;
  let staff;
  let otherStaff;
  let serviceStaff;
    const users = [];
  let displayId;
  let lobbyDisplayId;
  let lobbyVideoId;
  let browserDisplayId;
  let stationId;
  const serviceIds = [];
  let device;
  let lobbyDevice;
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

    const createService = async (name, departmentId) => {
      const response = await mutate(admin, "/api/v1/admin/services", "POST", { name, departmentId });
      expect(response.status()).toBe(201);
      return response.json();
    };
    const xrayService = await createService(`X-ray imaging ${suffix}`, xray.id);
    const ecgService = await createService(`ECG test ${suffix}`, ecg.id);
    serviceIds.push(xrayService.id, ecgService.id);
    const inactiveService = await createService(`Inactive imaging ${suffix}`, xray.id);
    serviceIds.push(inactiveService.id);
    expect((await mutate(admin, `/api/v1/admin/services/${inactiveService.id}`, "PATCH", { active: false })).status()).toBe(200);
    expect((await mutate(admin, "/api/v1/admin/services", "POST", {
      name: `X-ray imaging ${suffix}`,
      departmentId: xray.id,
    })).status()).toBe(409);
    const concurrentServiceAttempts = await Promise.all([1, 2].map(() => mutate(admin, "/api/v1/admin/services", "POST", {
      name: `Concurrent service ${suffix}`,
      departmentId: xray.id,
    })));
    const concurrentServiceResults = await Promise.all(concurrentServiceAttempts.map(async (response) => ({ status: response.status(), body: await response.text() })));
    expect(concurrentServiceResults.map((result) => result.status).sort()).toEqual([201, 409]);
    const concurrentXrayService = JSON.parse(concurrentServiceResults.find((result) => result.status === 201).body);
    serviceIds.push(concurrentXrayService.id);

    const receptionUser = await provisionUser(admin, `reception-${suffix}`, "Reception", []);
    const staffUser = await provisionUser(admin, `staff-${suffix}`, "Staff", [xrayService.id, ecgService.id]);
    const ecgOnlyUser = await provisionUser(admin, `ecg-staff-${suffix}`, "Staff", [ecgService.id]);
    const stationOnlyStaff = await provisionUser(admin, `station-staff-${suffix}`, "Staff", [xrayService.id]);
    const serviceOnlyUser = await provisionUser(admin, `service-staff-${suffix}`, "Staff", [concurrentXrayService.id]);
    users.push(
      { ...receptionUser, role: "Reception", serviceIds: [] },
      { ...staffUser, role: "Staff", serviceIds: [xrayService.id, ecgService.id] },
      { ...ecgOnlyUser, role: "Staff", serviceIds: [ecgService.id] },
      { ...stationOnlyStaff, role: "Staff", serviceIds: [xrayService.id] },
      { ...serviceOnlyUser, role: "Staff", serviceIds: [concurrentXrayService.id] },
    );

    const stationResponse = await mutate(admin, "/api/v1/admin/stations", "POST", {
      name: `X-ray Window ${suffix}`,
      departmentId: xray.id,
      serviceIds: [xrayService.id],
      staffUserIds: [staffUser.id, stationOnlyStaff.id],
    });
    const stationBody = await stationResponse.text();
    expect(stationResponse.status(), `Create station returned ${stationResponse.status()}: ${stationBody}`).toBe(201);
    const station = JSON.parse(stationBody);
    stationId = station.id;
    expect(station.serviceIds).toEqual([xrayService.id]);
    expect(station.staffUserIds).toEqual(expect.arrayContaining([staffUser.id, stationOnlyStaff.id]));
    expect((await mutate(admin, `/api/v1/admin/stations/${stationId}`, "PATCH", {
      serviceIds: [ecgService.id],
    })).status()).toBe(400);
    expect((await mutate(admin, `/api/v1/admin/stations/${stationId}`, "PATCH", {
      staffUserIds: [ecgOnlyUser.id],
    })).status()).toBe(400);
    expect((await mutate(admin, `/api/v1/admin/stations/${stationId}`, "PATCH", {
      serviceIds: [xrayService.id, xrayService.id],
    })).status()).toBe(400);
    const concurrentStationAttempts = await Promise.all([1, 2].map(() => mutate(admin, "/api/v1/admin/stations", "POST", {
      name: `Concurrent station ${suffix}`,
      departmentId: xray.id,
      serviceIds: [xrayService.id],
      staffUserIds: [],
    })));
    const concurrentStationResults = await Promise.all(concurrentStationAttempts.map(async (response) => ({ status: response.status(), body: await response.text() })));
    expect(concurrentStationResults.map((result) => result.status).sort()).toEqual([201, 409]);
    const concurrentStation = JSON.parse(concurrentStationResults.find((result) => result.status === 201).body);
    await mutate(admin, `/api/v1/admin/stations/${concurrentStation.id}`, "PATCH", { active: false });

    const deactivateStationStaff = await mutate(admin, `/api/v1/admin/users/${stationOnlyStaff.id}`, "PATCH", {
      role: "Staff",
      serviceIds: [xrayService.id],
      active: false,
    });
    expect(deactivateStationStaff.status()).toBe(200);
    const persistedStations = await admin.get("/api/v1/admin/stations");
    const persistedStationsBody = await persistedStations.text();
    expect(persistedStations.status(), `List stations returned ${persistedStations.status()}: ${persistedStationsBody}`).toBe(200);
    const persistedStation = JSON.parse(persistedStationsBody).find((row) => row.id === stationId);
    expect(persistedStation.serviceIds).toEqual([xrayService.id]);
    expect(persistedStation.staffUserIds).toEqual([staffUser.id]);

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

    const lobbyResponse = await mutate(admin, "/api/v1/admin/displays", "POST", { name: `Main lobby ${suffix}`, type: "Lobby", departmentId: null });
    expect(lobbyResponse.status()).toBe(201);
    lobbyDisplayId = (await lobbyResponse.json()).id;
    const lobbyCodeResponse = await mutate(admin, `/api/v1/admin/displays/${lobbyDisplayId}/pairing-code`, "POST");
    expect(lobbyCodeResponse.status()).toBe(200);
    lobbyDevice = await request.newContext({ baseURL: apiBaseUrl });
    const lobbyActivation = await mutate(lobbyDevice, "/api/v1/displays/activate", "POST", { code: (await lobbyCodeResponse.json()).code });
    expect(lobbyActivation.status()).toBe(200);
    expect((await lobbyActivation.json()).displayType).toBe("Lobby");
    expect((await device.get("/api/v1/displays/me/lobby-snapshot")).status()).toBe(403);
    expect((await lobbyDevice.get("/api/v1/displays/me/snapshot")).status()).toBe(403);
    expect((await lobbyDevice.get("/api/v1/displays/me/videos")).status()).toBe(200);
    const lobbyUrlVideo = await mutate(admin, "/api/v1/admin/display-videos/urls", "POST", { url: "https://media.example.org/welcome.mp4" });
    expect(lobbyUrlVideo.status()).toBe(201);
    expect((await lobbyDevice.get("/api/v1/displays/me/videos")).status()).toBe(200);
    expect((await lobbyDevice.get("/api/v1/admin/display-videos", { headers: { Host: "clinic.invalid" } })).status()).toBe(401);
    const uploadedVideo = await admin.post("/api/v1/admin/display-videos/upload", {
      headers: { "X-CSRF-TOKEN": await csrf(admin) },
      multipart: { file: { name: "test-video.webm", mimeType: "video/webm", buffer: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x93]) } },
    });
    expect(uploadedVideo.status()).toBe(201);
    lobbyVideoId = (await uploadedVideo.json()).id;
    const lobbyVideos = await (await lobbyDevice.get("/api/v1/displays/me/videos")).json();
    const localMediaUrl = lobbyVideos.find((video) => video.id === lobbyVideoId).url;
    expect((await lobbyDevice.get(localMediaUrl)).status()).toBe(200);
    expect((await device.get(localMediaUrl)).status()).toBe(403);

    const receptionSession = await signInAndChangePassword(receptionUser.userName, receptionUser.oneTimeCredential);
    const staffSession = await signInAndChangePassword(staffUser.userName, staffUser.oneTimeCredential);
    const otherStaffSession = await signInAndChangePassword(ecgOnlyUser.userName, ecgOnlyUser.oneTimeCredential);
    const serviceStaffSession = await signInAndChangePassword(serviceOnlyUser.userName, serviceOnlyUser.oneTimeCredential);
    reception = receptionSession.context;
    staff = staffSession.context;
    otherStaff = otherStaffSession.context;
    serviceStaff = serviceStaffSession.context;
    expect((await otherStaff.get(`/api/v1/departments/${xray.id}/queue`)).status()).toBe(403);
    expect((await otherStaff.get("/api/v1/admin/services")).status()).toBe(403);
    expect((await otherStaff.get("/api/v1/admin/stations")).status()).toBe(403);
    const staffServiceChoices = await otherStaff.get("/api/v1/services/available");
    expect(staffServiceChoices.status()).toBe(200);
    const staffServiceIds = (await staffServiceChoices.json()).map((service) => service.id);
    expect(staffServiceIds).toEqual(expect.arrayContaining([xrayService.id, ecgService.id]));
    expect(staffServiceIds).not.toContain(inactiveService.id);
    const issue = async (serviceId, appointmentAtLocal, key = randomUUID()) => {
      const response = await mutate(reception, "/api/v1/visits", "POST", {
        initialServiceId: serviceId,
        appointmentAtLocal,
      }, { "Idempotency-Key": key });
      return { response, key };
    };
    const inactiveIssue = await issue(inactiveService.id, null);
    expect(inactiveIssue.response.status()).toBe(400);
    const futureKey = randomUUID();
    const futureAppointment = clinicLocalDateTime(30);
    const future = await issue(xrayService.id, futureAppointment, futureKey);
    expect(future.response.status()).toBe(201);
    const futureVisit = await future.response.json();
    expect(futureVisit.departmentTicketNumber).toBe(1);
    const firstEcgTicket = await issue(ecgService.id, futureAppointment);
    expect(firstEcgTicket.response.status()).toBe(201);
    const firstEcgVisit = await firstEcgTicket.response.json();
    expect(firstEcgVisit.departmentTicketNumber).toBe(1);
    const sameDepartmentIssues = await Promise.all([
      issue(xrayService.id, futureAppointment),
      issue(xrayService.id, futureAppointment),
    ]);
    expect(sameDepartmentIssues.map(({ response }) => response.status())).toEqual([201, 201]);
    const sameDepartmentNumbers = await Promise.all(sameDepartmentIssues.map(async ({ response }) => (await response.json()).departmentTicketNumber));
    expect([...sameDepartmentNumbers].sort((left, right) => left - right)).toEqual([2, 3]);
    const isolatedServiceIssue = await issue(concurrentXrayService.id, clinicLocalDateTime(-10));
    expect(isolatedServiceIssue.response.status()).toBe(201);
    const isolatedServiceVisit = await isolatedServiceIssue.response.json();
    const staffQueueBeforeCall = await (await staff.get(`/api/v1/departments/${xray.id}/queue`)).json();
    expect(staffQueueBeforeCall.waiting.some((visit) => visit.id === isolatedServiceVisit.id)).toBe(false);
    expect(staffQueueBeforeCall.waiting.find((visit) => visit.id === futureVisit.id).serviceId).toBe(xrayService.id);
    expect(futureVisit).toMatchObject({ serviceId: xrayService.id, departmentId: xray.id });
    const replay = await issue(xrayService.id, futureAppointment, futureKey);
    expect(replay.response.status()).toBe(200);
    expect((await replay.response.json()).id).toBe(futureVisit.id);
    expect((await mutate(admin, `/api/v1/admin/services/${xrayService.id}`, "PATCH", { active: false })).status()).toBe(200);
    const replayAfterDeactivation = await issue(xrayService.id, futureAppointment, futureKey);
    expect(replayAfterDeactivation.response.status()).toBe(200);
    expect((await replayAfterDeactivation.response.json()).id).toBe(futureVisit.id);
    expect((await mutate(admin, `/api/v1/admin/services/${xrayService.id}`, "PATCH", { active: true })).status()).toBe(200);
    const keyConflict = await issue(ecgService.id, futureAppointment, futureKey);
    expect(keyConflict.response.status()).toBe(409);
    const concurrentKey = randomUUID();
    const concurrentIssues = await Promise.all([
      issue(xrayService.id, futureAppointment, concurrentKey),
      issue(xrayService.id, futureAppointment, concurrentKey),
    ]);
    const concurrentIssueResults = await Promise.all(concurrentIssues.map(async ({ response }) => ({
      status: response.status(),
      body: await response.text(),
    })));
    expect(concurrentIssueResults.map(({ status }) => status).sort((left, right) => left - right), JSON.stringify(concurrentIssueResults)).toEqual([200, 201]);
    const concurrentIssueBodies = concurrentIssueResults.map(({ body }) => JSON.parse(body));
    expect(concurrentIssueBodies[0].id).toBe(concurrentIssueBodies[1].id);
    expect(concurrentIssueBodies[0].departmentTicketNumber).toBe(concurrentIssueBodies[1].departmentTicketNumber);
    const due = await issue(xrayService.id, clinicLocalDateTime(-5));
    expect(due.response.status()).toBe(201);
    const dueVisit = await due.response.json();
    const walkIn = await issue(xrayService.id, null);
    expect(walkIn.response.status()).toBe(201);
    const walkInVisit = await walkIn.response.json();
    const laterWalkIn = await issue(xrayService.id, null);
    expect(laterWalkIn.response.status()).toBe(201);
    const laterWalkInVisit = await laterWalkIn.response.json();

    const calledDue = await mutate(staff, `/api/v1/departments/${xray.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() });
    expect(calledDue.status()).toBe(200);
    expect((await calledDue.json()).id).toBe(dueVisit.id);

    const isolatedQueue = await (await serviceStaff.get(`/api/v1/departments/${xray.id}/queue`)).json();
    expect(isolatedQueue.waiting.map((visit) => visit.id)).toContain(isolatedServiceVisit.id);
    expect(isolatedQueue.waiting.some((visit) => visit.id === futureVisit.id)).toBe(false);
    const isolatedCall = await mutate(serviceStaff, `/api/v1/departments/${xray.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() });
    expect(isolatedCall.status()).toBe(200);
    expect((await isolatedCall.json()).id).toBe(isolatedServiceVisit.id);
    expect((await mutate(staff, `/api/v1/visits/${isolatedServiceVisit.id}/return-to-pending`, "POST", undefined, { "Idempotency-Key": randomUUID() })).status()).toBe(403);
    expect((await mutate(staff, `/api/v1/visits/${isolatedServiceVisit.id}/complete`, "POST", {}, { "Idempotency-Key": randomUUID() })).status()).toBe(403);
    expect((await mutate(serviceStaff, `/api/v1/visits/${isolatedServiceVisit.id}/complete`, "POST", {}, { "Idempotency-Key": randomUUID() })).status()).toBe(200);

    const noShowKey = randomUUID();
    const returned = await mutate(staff, `/api/v1/visits/${dueVisit.id}/return-to-pending`, "POST", undefined, { "Idempotency-Key": noShowKey });
    expect(returned.status()).toBe(200);
    expect((await mutate(staff, `/api/v1/visits/${dueVisit.id}/return-to-pending`, "POST", undefined, { "Idempotency-Key": noShowKey })).status()).toBe(200);
    const recalled = await mutate(staff, `/api/v1/departments/${xray.id}/call-next`, "POST", undefined, { "Idempotency-Key": randomUUID() });
    expect(recalled.status()).toBe(200);
    expect((await recalled.json()).visitCode).toBe(dueVisit.visitCode);

    const inactiveForward = await mutate(staff, `/api/v1/visits/${dueVisit.id}/complete`, "POST", {
      nextServiceId: inactiveService.id,
    }, { "Idempotency-Key": randomUUID() });
    expect(inactiveForward.status()).toBe(400);

    const forward = await mutate(staff, `/api/v1/visits/${dueVisit.id}/complete`, "POST", {
      nextServiceId: ecgService.id,
      nextDepartmentAppointmentAtLocal: clinicLocalDateTime(-5),
    }, { "Idempotency-Key": randomUUID() });
    expect(forward.status()).toBe(200);
    expect(await forward.json()).toMatchObject({ visitCode: dueVisit.visitCode, nextDepartmentId: ecg.id, nextServiceId: ecgService.id, nextDepartmentTicketNumber: 2 });
    const originalReceipt = await reception.get(`/api/v1/reception/visits/receipt?visitCode=${dueVisit.visitCode}&clinicDate=${dueVisit.clinicDate}`);
    expect(originalReceipt.status()).toBe(200);
    expect(await originalReceipt.json()).toMatchObject({
      id: dueVisit.id,
      visitCode: dueVisit.visitCode,
      clinicDate: dueVisit.clinicDate,
      serviceId: xrayService.id,
      departmentId: xray.id,
      departmentTicketNumber: dueVisit.departmentTicketNumber,
    });
    const malformedReceipt = await reception.get(`/api/v1/reception/visits/receipt?visitCode=not-a-code&clinicDate=${dueVisit.clinicDate}`);
    expect(malformedReceipt.status()).toBe(400);
    const missingReceipt = await reception.get(`/api/v1/reception/visits/receipt?visitCode=99999&clinicDate=${dueVisit.clinicDate}`);
    expect(missingReceipt.status()).toBe(404);
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
    expect(displaySnapshot.waiting.find((visit) => visit.visitCode === futureVisit.visitCode).ticketNumber).toBe("001");
    expect(JSON.stringify(displaySnapshot)).not.toMatch(/appointmentAt|patient|userName/i);
    const lobbySnapshot = await lobbyDevice.get("/api/v1/displays/me/lobby-snapshot");
    expect(lobbySnapshot.status()).toBe(200);
    const lobbyQueues = await lobbySnapshot.json();
    expect(lobbyQueues.map((row) => row.departmentName)).toContain(xray.name);
    expect(lobbyQueues.map((row) => row.departmentName)).toContain(ecg.name);
    expect(lobbyQueues.find((row) => row.departmentName === xray.name).waiting).toHaveLength(3);
    expect(JSON.stringify(lobbyQueues)).not.toMatch(/appointmentAt|patient|userName/i);

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
    await page.getByLabel("First service", { exact: true }).selectOption(xrayService.id);
    await page.getByRole("button", { name: "Issue visit" }).click();
    const browserTicketNumber = await page.locator(".receipt-number").textContent();
    expect(browserTicketNumber).toMatch(/^\d{3}$/);
    const browserVisitCode = (await page.locator(".receipt-reference").textContent()).replace("Visit code: ", "");
    expect(browserVisitCode).toMatch(/^\d{3,}$/);
    const browserClinicDate = await page.getByLabel("Clinic date").inputValue();
    await page.reload();
    await page.getByRole("textbox", { name: "Visit code" }).fill(browserVisitCode);
    await page.getByLabel("Clinic date").fill(browserClinicDate);
    await page.getByRole("button", { name: "Find visit" }).click();
    await expect(page.locator(".receipt-number")).toHaveText(browserTicketNumber);

    const browserDisplayResponse = await mutate(admin, "/api/v1/admin/displays", "POST", {
      name: `Browser monitor ${suffix}`,
      departmentId: xray.id,
    });
    expect(browserDisplayResponse.status()).toBe(201);
    browserDisplayId = (await browserDisplayResponse.json()).id;
    const browserPairingResponse = await mutate(admin, `/api/v1/admin/displays/${browserDisplayId}/pairing-code`, "POST");
    expect(browserPairingResponse.status()).toBe(200);
    displayBrowserContext = await browser.newContext({ baseURL: frontendBaseUrl });
    const displayPage = await displayBrowserContext.newPage();
    await displayPage.goto("/display/pair");
    await displayPage.getByLabel("Pairing code").fill((await browserPairingResponse.json()).code);
    await displayPage.getByRole("button", { name: "Activate display" }).click();
    await expect(displayPage).toHaveURL(/\/display$/);
    await expect(displayPage.getByRole("heading", { name: xray.name })).toBeVisible();
    await expect(displayPage.getByText(browserTicketNumber, { exact: true })).toBeVisible();
    await expect(displayPage.getByText("Connection: connected")).toBeVisible();

    browserStaffContext = await browser.newContext({ baseURL: frontendBaseUrl });
    const staffPage = await browserStaffContext.newPage();
    await staffPage.goto("/login");
    await staffPage.getByLabel("Username").fill(staffUser.userName);
    await staffPage.getByLabel("Password").fill(staffSession.password);
    await staffPage.getByRole("button", { name: "Sign in" }).click();
    await expect(staffPage).toHaveURL(/\/department$/);
    await staffPage.getByLabel("Your department").selectOption(xray.id);
    await expect(staffPage.getByRole("row", { name: new RegExp(browserTicketNumber) })).toBeVisible();
    await staffPage.getByRole("button", { name: "Call next" }).click();
    await expect(staffPage.getByRole("status").filter({ hasText: `Now calling ${browserTicketNumber}` })).toBeVisible();
    await expect(displayPage.getByRole("heading", { name: browserTicketNumber })).toBeVisible();

    const browserDisplayRevoke = await mutate(admin, `/api/v1/admin/displays/${browserDisplayId}`, "PATCH", { active: false });
    expect(browserDisplayRevoke.status()).toBe(200);
    await expect(displayPage.getByRole("alert")).toContainText("This monitor is not paired or its access was revoked.");

    const revoke = await mutate(admin, `/api/v1/admin/displays/${displayId}`, "PATCH", { active: false });
    expect(revoke.status()).toBe(200);
    expect([401, 403]).toContain((await device.get("/api/v1/displays/me/snapshot")).status());
    const lobbyRevoke = await mutate(admin, `/api/v1/admin/displays/${lobbyDisplayId}`, "PATCH", { active: false });
    expect(lobbyRevoke.status()).toBe(200);
    expect([401, 403]).toContain((await lobbyDevice.get("/api/v1/displays/me/lobby-snapshot")).status());
    expect([401, 403]).toContain((await lobbyDevice.get(localMediaUrl)).status());
  } finally {
    if (stationId) await mutate(admin, `/api/v1/admin/stations/${stationId}`, "PATCH", { active: false }).catch(() => {});
    for (const serviceId of serviceIds) await mutate(admin, `/api/v1/admin/services/${serviceId}`, "PATCH", { active: false }).catch(() => {});
    if (displayId) await mutate(admin, `/api/v1/admin/displays/${displayId}`, "PATCH", { active: false }).catch(() => {});
    if (lobbyDisplayId) await mutate(admin, `/api/v1/admin/displays/${lobbyDisplayId}`, "PATCH", { active: false }).catch(() => {});
    if (browserDisplayId) await mutate(admin, `/api/v1/admin/displays/${browserDisplayId}`, "PATCH", { active: false }).catch(() => {});
    if (lobbyVideoId) await mutate(admin, `/api/v1/admin/display-videos/${lobbyVideoId}`, "DELETE", undefined).catch(() => {});
    for (const user of users) {
      await mutate(admin, `/api/v1/admin/users/${user.id}`, "PATCH", {
        role: user.role,
        serviceIds: user.serviceIds,
        active: false,
      }).catch(() => {});
    }
    await Promise.all([admin, reception, staff, otherStaff, serviceStaff, device, lobbyDevice].filter(Boolean).map((context) => context.dispose()));
    await Promise.all([browserStaffContext, displayBrowserContext].filter(Boolean).map((context) => context.close()));
  }
});
