import { expect, test } from "@playwright/test";

test("dashboard issues tickets and shows the first three waiting before calling", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => { window.printRequested = true; };
  });
  const apiRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/")) apiRequests.push(request.url());
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Queue dashboard" })).toBeVisible();
  await expect(page.getByText("No tickets are waiting.")).toBeVisible();

  const waitingRows = page.locator(".dashboard-board .board-waiting").first().locator("li");
  const expectedServices = ["Consultation", "Laboratory", "Follow-up", "Consultation"];
  const serviceIds = ["consultation", "laboratory", "follow-up", "consultation"];

  for (let index = 0; index < expectedServices.length; index += 1) {
    await page.getByLabel("Service").selectOption(serviceIds[index]);
    await page.getByRole("button", { name: "Issue ticket" }).click();

    const ticketNumber = String(index + 1).padStart(3, "0");
    await expect(page.locator(".ticket-receipt .receipt-number")).toHaveText(ticketNumber);
    await expect(page.locator(".ticket-receipt .receipt-service")).toHaveText(expectedServices[index]);
    await expect(page.getByRole("button", { name: "Print ticket" })).toBeVisible();
  }

  await page.getByRole("button", { name: "Print ticket" }).click();
  await expect.poll(() => page.evaluate(() => window.printRequested)).toBe(true);

  await expect(waitingRows).toHaveCount(3);
  await expect(waitingRows.nth(0)).toContainText("001");
  await expect(waitingRows.nth(1)).toContainText("002");
  await expect(waitingRows.nth(2)).toContainText("003");
  await expect(page.locator(".dashboard-board")).toContainText("4 waiting");
  await expect(page.locator(".dashboard-board .board-waiting").first()).not.toContainText("004");
  await expect(page.getByRole("heading", { name: "Calling tickets" })).toBeVisible();
  await expect(page.getByText("No tickets are being called.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Call next/ })).toHaveCount(0);
  expect(apiRequests.some((url) => url.includes("/api/v1/tickets"))).toBe(true);
  expect(apiRequests.some((url) => url.includes("/api/v1/queue/display"))).toBe(true);

  const displayResponse = await page.request.get("http://127.0.0.1:4173/api/v1/queue/display");
  const displaySnapshot = await displayResponse.json();
  expect(Object.keys(displaySnapshot.waiting[0])).toEqual(["number", "serviceName", "status"]);

  const baseUrl = "http://127.0.0.1:4173/api/v1/tickets";
  const retryKey = "00000000-0000-0000-0000-000000000001";
  const unknownService = await page.request.post(baseUrl, {
    data: { serviceId: "unknown" },
    headers: { "Idempotency-Key": "00000000-0000-0000-0000-000000000002" },
  });
  expect(unknownService.status()).toBe(400);

  const original = await page.request.post(baseUrl, {
    data: { serviceId: "consultation" },
    headers: { "Idempotency-Key": retryKey },
  });
  const repeated = await page.request.post(baseUrl, {
    data: { serviceId: "consultation" },
    headers: { "Idempotency-Key": retryKey },
  });
  const conflict = await page.request.post(baseUrl, {
    data: { serviceId: "laboratory" },
    headers: { "Idempotency-Key": retryKey },
  });
  expect(original.status()).toBe(201);
  expect(repeated.status()).toBe(200);
  expect((await repeated.json()).id).toBe((await original.json()).id);
  expect(conflict.status()).toBe(409);
});

test("dashboard remains keyboard accessible and fits narrow viewports", async ({ page }) => {
  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Queue CLINIC WORKSPACE" })).toBeFocused();

  for (const width of [320, 390, 768, 1120, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow, `dashboard should not overflow at ${width}px`).toBe(false);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await page.getByRole("button", { name: "Issue ticket" }).evaluate((button) =>
    Number.parseFloat(getComputedStyle(button).transitionDuration),
  );
  expect(duration).toBeLessThanOrEqual(0.001);

  await page.getByRole("link", { name: /Admin setup/ }).click();
  await expect(page.getByRole("heading", { name: "Admin setup" })).toBeVisible();
});

test("public queue display renders standalone TV view with live headers, now serving, and active counters", async ({ page }) => {
  await page.goto("/display");

  // Verify standalone layout isolation: NO app-frame or workspace sidebar
  await expect(page.locator(".app-frame")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toHaveCount(0);

  // Verify header elements
  await expect(page.getByRole("heading", { name: "St. Jude Clinic & Wellness Center" })).toBeVisible();
  await expect(page.getByText(/NOW SERVING/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active Counters" })).toBeVisible();
  await expect(page.getByText(/Priority lane available for Senior Citizens/)).toBeVisible();

  // Test query parameter filtering
  await page.goto("/display?theme=light&department=billing");
  await expect(page.getByRole("heading", { name: "St. Jude Clinic & Wellness Center" })).toBeVisible();

  // Verify REST fallback endpoint /api/queue/display
  const displayResponse = await page.request.get("http://127.0.0.1:4173/api/queue/display");
  expect(displayResponse.status()).toBe(200);
  const items = await displayResponse.json();
  expect(Array.isArray(items)).toBe(true);
  expect(items.length).toBeGreaterThan(0);
  expect(items[0]).toHaveProperty("ticketNumber");
  expect(items[0]).toHaveProperty("counterName");
});

