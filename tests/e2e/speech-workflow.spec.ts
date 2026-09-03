import { expect, test } from "@playwright/test";

import { registerThroughUi, uniqueCredentials } from "./support/auth";
import {
  DETERMINISTIC_TRANSCRIPT,
  uploadSpeechThroughUi,
} from "./support/speech";

test("speech upload, history, analytics, and deletion", async ({ page }) => {
  await registerThroughUi(page, uniqueCredentials("speech"));

  await uploadSpeechThroughUi(page);

  await expect(page.getByText(DETERMINISTIC_TRANSCRIPT)).toBeVisible();
  await expect(page.getByText("She goes", { exact: false })).toBeVisible();
  await expect(page.getByText("two apples", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "Speeches" }).click();
  const speechRow = page
    .getByRole("row")
    .filter({ hasText: "She go to the store yesterday" });
  await expect(speechRow).toBeVisible();
  await expect(
    speechRow.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Analytics" }).click();
  await expect(page.getByText("Total speeches: 1")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Error rate over time" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Speeches" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await speechRow.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No speeches saved yet.")).toBeVisible();
});
