import { expect, test } from "@playwright/test";

import { uniqueCredentials } from "./support/auth";

test("a user cannot exceed the speech-analysis minute limit", async ({
  request,
}) => {
  const credentials = uniqueCredentials("rate-limit");
  const registration = await request.post("/api/v1/auth/register", {
    data: credentials,
  });
  expect(registration.status()).toBe(201);

  const login = await request.post("/api/v1/auth/login", {
    data: credentials,
  });
  expect(login.status()).toBe(200);

  const upload = () =>
    request.post("/api/v1/speeches", {
      multipart: {
        file: {
          name: "learner-sample.wav",
          mimeType: "audio/wav",
          buffer: Buffer.from("deterministic E2E audio fixture"),
        },
      },
    });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await upload();
    expect(response.status()).toBe(201);
  }

  const rejected = await upload();
  expect(rejected.status()).toBe(429);
  expect(await rejected.json()).toMatchObject({
    code: "QUOTA_REACHED",
  });

  const otherCredentials = uniqueCredentials("rate-limit-isolation");
  expect(
    (
      await request.post("/api/v1/auth/register", {
        data: otherCredentials,
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post("/api/v1/auth/login", {
        data: otherCredentials,
      })
    ).status(),
  ).toBe(200);
  expect((await upload()).status()).toBe(201);
});
