import { test, expect } from "@playwright/test";

test("homepage loads without JS errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/Dropi/i);
  expect(errors).toHaveLength(0);
});

test("page has main navigation or workspace element", async ({ page }) => {
  await page.goto("/");
  // Either an auth overlay or the workspace should be visible
  const hasWorkspace = await page.locator("#workspace, #app, main, .workspace").count() > 0;
  const hasAuth = await page.locator("#sso-overlay, #login, .auth-overlay, [data-auth]").count() > 0;
  expect(hasWorkspace || hasAuth).toBe(true);
});
