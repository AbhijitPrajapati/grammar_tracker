import { expect, type Page } from "@playwright/test";

export interface Credentials {
  email: string;
  password: string;
}

export function uniqueCredentials(prefix: string): Credentials {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    email: `${prefix}-${uniquePart}@example.com`,
    password: "DemonstrationPassword123!",
  };
}

export async function registerThroughUi(
  page: Page,
  credentials: Credentials,
): Promise<void> {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Need an account?" }).click();
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Upload a speech sample" }),
  ).toBeVisible();
}
