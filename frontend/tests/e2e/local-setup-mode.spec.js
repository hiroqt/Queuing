import { expect, test } from "@playwright/test";
import process from "node:process";

test("local setup opens the Admin workspace without requesting a login", async ({ page }) => {
  test.skip(process.env.QUEUING_LOCAL_SETUP_E2E !== "1", "set QUEUING_LOCAL_SETUP_E2E=1 to verify the local setup route");
  const apiRequests = [];

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    apiRequests.push(url.pathname);
    const payload = url.pathname === "/api/v1/auth/csrf" ? { requestToken: "local-setup-test-token" } : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.goto("/");

  await expect(page).toHaveURL(/\/admin\/departments$/);
  await expect(page.getByRole("heading", { name: "Clinic configuration" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Local setup mode" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in" })).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);
  expect(apiRequests).not.toContain("/api/v1/auth/session");
  expect(apiRequests).not.toContain("/api/v1/auth/login");
});
