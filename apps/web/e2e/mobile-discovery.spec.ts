import { expect, test } from "@playwright/test";

test("mobile discovery routes through the persistent navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find the dish/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();

  await page.getByRole("link", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search/);
  await expect(page.getByPlaceholder("Search North End…")).toBeVisible();

  await page.getByRole("link", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
});

test("search filters open as a mobile sheet", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("button", { name: "More filters" }).click();
  await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show results" })).toBeVisible();
});
