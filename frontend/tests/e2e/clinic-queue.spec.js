import { expect, test } from "@playwright/test";

test("staff can navigate the four demo surfaces without sending backend commands", async ({ page }) => {
  const backendRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (["fetch", "xhr"].includes(request.resourceType()) || /^\/(api|hubs)\//.test(url.pathname)) {
      backendRequests.push(request.url());
    }
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole("heading", { name: "Staff desk" })).toBeVisible();
  await expect(page.getByLabel("Demo notice")).toContainText("actions are not saved or sent to a server");

  await page.getByRole("button", { name: "Call next" }).click();
  await expect(page.getByRole("status")).toContainText("No queue command was sent");

  for (const action of ["Complete", "Skip", "Review call"]) {
    await page.getByRole("button", { name: action }).click();
    await expect(page.getByRole("status")).toContainText("No queue command was sent");
  }

  await page.getByRole("link", { name: /Admin setup/ }).click();
  await expect(page.getByRole("heading", { name: "Admin setup" })).toBeVisible();
  await page.getByRole("button", { name: "Preview save" }).click();
  await expect(page.getByRole("status")).toContainText("No configuration was saved");

  await page.getByRole("link", { name: /Issue ticket/ }).click();
  await expect(page.getByRole("heading", { name: "Issue a ticket" })).toBeVisible();
  await page.getByRole("button", { name: "Preview ticket" }).click();
  await expect(page.getByRole("status")).toContainText("No ticket was issued");
  await expect(page.getByText("Ticket number assigned after server confirmation")).toBeVisible();

  await page.getByRole("link", { name: /Public display/ }).click();
  await expect(page.getByRole("heading", { name: "Waiting room display" })).toBeVisible();
  await expect(page.getByText("Not connected to a live queue")).toBeVisible();
  await expect(page.getByLabel("Sample public queue board")).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test("all destinations remain available without page overflow on desktop or mobile", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/staff");

    for (const [label, heading] of [
      [/Staff desk/, "Staff desk"],
      [/Issue ticket/, "Issue a ticket"],
      [/Admin setup/, "Admin setup"],
      [/Public display/, "Waiting room display"],
    ]) {
      const destination = page.getByRole("link", { name: label });
      await expect(destination).toBeVisible();
      await destination.click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(hasHorizontalOverflow, `${heading} should not overflow at ${viewport.width}px`).toBe(false);
    }
  }
});

test("keyboard users can reach the skip link and primary navigation", async ({ page }) => {
  await page.goto("/staff");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Clinic queue home" })).toBeFocused();
});

test("reduced-motion preference removes nonessential transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/staff");
  const duration = await page.getByRole("button", { name: "Call next" }).evaluate((button) =>
    Number.parseFloat(getComputedStyle(button).transitionDuration),
  );
  expect(duration).toBeLessThanOrEqual(0.001);
});
