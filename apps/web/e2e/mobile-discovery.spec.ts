import { expect, test } from "@playwright/test";

test("mobile discovery routes through the persistent navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find the dish/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();

  await page.getByRole("link", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search/);
  await expect(page.getByPlaceholder("Search dishes, restaurants, or ingredients")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick a category or type a dish" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All Dishes" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Map" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("link", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
});

test("search filters open as a mobile sheet", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("button", { name: "More filters" }).click();
  await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show results" })).toBeVisible();
});

test("search browse becomes results after a category pick", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: "Pick a category or type a dish" })).toBeVisible();
  await page.getByRole("button", { name: /pizza/i }).click();
  await expect(page.getByRole("heading", { name: "Matched Dishes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick a category or type a dish" })).toHaveCount(0);
});

test("map lives on search and is off until toggled", async ({ page }) => {
  await page.goto("/map");
  await expect(page).toHaveURL(/\/search\?view=map/);
  await expect(page.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Map" }).click();
  await expect(page.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/\/search\/?$/);
});
