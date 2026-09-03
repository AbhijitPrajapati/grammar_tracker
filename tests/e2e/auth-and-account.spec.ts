import { expect, test } from "@playwright/test";

import { registerThroughUi, uniqueCredentials } from "./support/auth";

test("authentication and account lifecycle", async ({ page }) => {
  const credentials = uniqueCredentials("account");
  const newPassword = "UpdatedDemonstrationPassword123!";

  await page.goto("/");
  await expect(page).toHaveURL(/\/auth$/);

  await registerThroughUi(page, credentials);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Upload a speech sample" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Account" }).click();
  await page.getByLabel("Current password").fill(credentials.password);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/auth$/);

  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid credentials")).toBeVisible();

  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("link", { name: "Account" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(page).toHaveURL(/\/auth$/);
});
