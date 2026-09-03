import { expect, test } from "@playwright/test";

import { registerThroughUi, uniqueCredentials } from "./support/auth";
import {
  DETERMINISTIC_TRANSCRIPT,
  uploadSpeechThroughUi,
} from "./support/speech";

test("a user cannot exceed the speech-analysis minute limit", async ({
  page,
}) => {
  await registerThroughUi(page, uniqueCredentials("rate-limit"));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await uploadSpeechThroughUi(page);
    await expect(page.getByText(DETERMINISTIC_TRANSCRIPT)).toBeVisible();
  }

  await uploadSpeechThroughUi(page);
  await expect(page.getByText("Analysis quota reached")).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await registerThroughUi(page, uniqueCredentials("rate-limit-isolation"));
  await uploadSpeechThroughUi(page);
  await expect(page.getByText(DETERMINISTIC_TRANSCRIPT)).toBeVisible();
});
