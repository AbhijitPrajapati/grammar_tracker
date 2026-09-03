import { expect, type Page } from "@playwright/test";

export const DETERMINISTIC_TRANSCRIPT =
  "She go to the store yesterday and buy two apple.";

export async function uploadSpeechThroughUi(page: Page): Promise<void> {
  await page.getByLabel("Audio clip").setInputFiles({
    name: "learner-sample.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("deterministic E2E audio fixture"),
  });

  const actionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.request().headers()["next-action"] !== undefined,
  );
  await page.getByRole("button", { name: "Upload and analyze" }).click();
  await actionResponse;
  await expect(
    page.getByRole("button", { name: "Upload and analyze" }),
  ).toBeEnabled();
}
