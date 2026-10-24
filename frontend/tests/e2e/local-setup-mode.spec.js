import { expect, test } from "@playwright/test";
import process from "node:process";

test("local setup opens the Admin workspace without requesting a login", async ({ page }) => {
  test.skip(process.env.QUEUING_LOCAL_SETUP_E2E !== "1", "set QUEUING_LOCAL_SETUP_E2E=1 to verify the local setup route");
  const apiRequests = [];
  let identity = { authenticated: true, userName: "Admin", role: "Admin" };

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    apiRequests.push(url.pathname);
    if (url.pathname === "/api/v1/auth/session") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(identity) });
    if (url.pathname === "/api/v1/auth/logout") { identity = { authenticated: false }; return route.fulfill({ status: 204 }); }
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

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(apiRequests).toContain("/api/v1/auth/session");
  expect(apiRequests).toContain("/api/v1/auth/logout");
});

test("local setup keeps Reception and Staff behind real role logins", async ({ page }) => {
  test.skip(process.env.QUEUING_LOCAL_SETUP_E2E !== "1", "set QUEUING_LOCAL_SETUP_E2E=1 to verify local role access");
  let identity = null;
  const apiRequests = [];

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    apiRequests.push(path);
    if (path === "/api/v1/auth/csrf") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ requestToken: "setup-test-token" }) });
    if (path === "/api/v1/auth/session") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(identity ?? { authenticated: false }) });
    if (path === "/api/v1/auth/login") {
      const credentials = route.request().postDataJSON();
      identity = {
        authenticated: true,
        userName: credentials.userName,
        role: credentials.userName === "receptionist" ? "Reception" : "Staff",
        departmentIds: credentials.userName === "receptionist" ? [] : ["department-1"],
        serviceIds: ["service-1"],
        mustChangePassword: false,
        requestToken: "setup-test-token",
      };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(identity) });
    }
    if (path === "/api/v1/auth/logout") {
      identity = null;
      return route.fulfill({ status: 204 });
    }
    if (path === "/api/v1/services/available") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    if (path === "/api/v1/departments") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "department-1", name: "Radiology", active: true }]) });
    if (path === "/api/v1/departments/department-1/queue") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ departmentName: "Radiology", waiting: [], called: [] }) });
    return route.fulfill({ status: 404, contentType: "application/problem+json", body: JSON.stringify({ detail: `Unhandled ${route.request().method()} ${path}` }) });
  });

  await page.goto("/reception");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Username").fill("receptionist");
  await page.getByLabel("Password").fill("temporary-code");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/reception$/);
  await expect(page.getByRole("heading", { name: "Issue a visit" })).toBeVisible();

  await page.goto("/department");
  await expect(page).toHaveURL(/\/reception$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/department");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Username").fill("staff-user");
  await page.getByLabel("Password").fill("temporary-code");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/department$/);
  await expect(page.getByRole("heading", { name: "Department queue" })).toBeVisible();
  expect(apiRequests).toContain("/api/v1/auth/login");
});
