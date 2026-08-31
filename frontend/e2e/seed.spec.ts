import { expect, test } from "@playwright/test";

test.describe("test-generation seed", () => {
  test("authentication page is available", async ({ page }) => {
    await page.goto("/auth");

    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  });
});
