import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  InferenceQuotaReached,
  AnalysisQuotaReached,
  AudioSample,
  ChangePassword,
  DeleteSpeech,
  DeleteUser,
  EmailAlreadyRegistered,
  InvalidCredentials,
  InvalidCurrentPassword,
  InvalidToken,
  ListSpeeches,
  Login,
  ProcessSpeech,
  RegisterAndStartSession,
  ResolveSession,
  RetrieveAnalyticsDashboard,
  SpeechNotFound,
  type AnalysisQuota,
  type GrammarAnalyzer,
  type PasswordHasher,
  type StagedAudioStore,
  type TokenService,
  type Transcriber,
  type AnalyticsReader,
  EmailConflictError,
  type SpeechRepository,
  type StoredUser,
  type UserRepository,
} from "../../../src/application";
import {
  Analysis,
  DateRange,
  EmailAddress,
  NewPassword,
  Speech,
  UserAccount,
} from "../../../src/domain";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";
const SPEECH_ID = "b8742aa2-bc1a-4ad4-8746-9d6b905431f0";
const CREATED_AT = new Date("2026-01-10T12:00:00.000Z");
const STAGED_AUDIO_REFERENCE = {
  pathname: `speech-staging/${USER_ID}/audio.webm`,
  etag: "opaque-etag",
} as const;

const account = new UserAccount({
  id: USER_ID,
  email: new EmailAddress("learner@example.com"),
  createdAt: CREATED_AT,
});

const analysis = new Analysis({
  mistakes: [],
  frequencies: [{ category: "verb_tense", occurrences: 0, opportunities: 2 }],
  feedback: "Well done.",
});

function storedUser(passwordHash = "hash:old-password"): StoredUser {
  return { account, passwordHash };
}

function userRepository(
  overrides: Partial<UserRepository> = {},
): UserRepository {
  return {
    create: async (email, passwordHash) => ({
      account: new UserAccount({ id: USER_ID, email, createdAt: CREATED_AT }),
      passwordHash,
    }),
    getById: async () => storedUser(),
    getByEmail: async () => storedUser(),
    delete: async () => true,
    updatePassword: async (_userId, passwordHash) => storedUser(passwordHash),
    ...overrides,
  };
}

const passwordHasher: PasswordHasher = {
  hash: async (password) => `hash:${password}`,
  verify: async (password, passwordHash) => passwordHash === `hash:${password}`,
};

const tokenService: TokenService = {
  issue: async (userId) => `token:${userId}`,
  verify: async (token) => (token === `token:${USER_ID}` ? USER_ID : null),
};

function speechRepository(
  overrides: Partial<SpeechRepository> = {},
): SpeechRepository {
  return {
    create: async (userId, transcript, speechAnalysis) =>
      new Speech({
        id: SPEECH_ID,
        userId,
        transcript,
        analysis: speechAnalysis,
        createdAt: CREATED_AT,
      }),
    list: async () => [],
    deleteOwned: async () => true,
    ...overrides,
  };
}

function audioSample(): AudioSample {
  return new AudioSample({
    sizeBytes: 3,
    filename: "speech.webm",
    mediaType: "audio/webm",
    openStream: async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
  });
}

function stagedAudioStore(calls: string[] = []): StagedAudioStore {
  return {
    resolve: async () => {
      calls.push("resolve-audio");
      return audioSample();
    },
    delete: async () => {
      calls.push("delete-audio");
    },
  };
}

describe("authentication use cases", () => {
  it("registers and starts a session in one application workflow", async () => {
    let persistedHash: string | null = null;
    const users = userRepository({
      getByEmail: async () => null,
      create: async (email, passwordHash) => {
        persistedHash = passwordHash;
        return {
          account: new UserAccount({
            id: USER_ID,
            email,
            createdAt: CREATED_AT,
          }),
          passwordHash,
        };
      },
    });
    const useCase = new RegisterAndStartSession(
      users,
      passwordHasher,
      tokenService,
    );

    const result = await useCase.execute(
      new EmailAddress("New@Example.com"),
      new NewPassword("new-password"),
    );

    assert.equal(result.user.email.value, "new@example.com");
    assert.equal(result.session.userId, USER_ID);
    assert.equal(result.session.sessionToken, `token:${USER_ID}`);
    assert.equal(persistedHash, "hash:new-password");
  });

  it("maps both the email precheck and uniqueness race to one error", async () => {
    const existing = new RegisterAndStartSession(
      userRepository(),
      passwordHasher,
      tokenService,
    );
    await assert.rejects(
      existing.execute(
        new EmailAddress("learner@example.com"),
        new NewPassword("password"),
      ),
      EmailAlreadyRegistered,
    );

    const race = new RegisterAndStartSession(
      userRepository({
        getByEmail: async () => null,
        create: async () => {
          throw new EmailConflictError();
        },
      }),
      passwordHasher,
      tokenService,
    );
    await assert.rejects(
      race.execute(
        new EmailAddress("learner@example.com"),
        new NewPassword("password"),
      ),
      EmailAlreadyRegistered,
    );
  });

  it("logs in only after asynchronous password verification", async () => {
    const login = new Login(userRepository(), passwordHasher, tokenService);
    assert.equal(
      (await login.execute(account.email, "old-password")).sessionToken,
      `token:${USER_ID}`,
    );
    await assert.rejects(
      login.execute(account.email, "wrong-password"),
      InvalidCredentials,
    );
    await assert.rejects(
      new Login(
        userRepository({ getByEmail: async () => null }),
        passwordHasher,
        tokenService,
      ).execute(account.email, "old-password"),
      InvalidCredentials,
    );
  });

  it("resolves a token only when its user still exists", async () => {
    const resolve = new ResolveSession(tokenService, userRepository());
    assert.equal((await resolve.execute(`token:${USER_ID}`)).id, USER_ID);
    await assert.rejects(resolve.execute("bad-token"), InvalidToken);

    const deletedUser = new ResolveSession(
      tokenService,
      userRepository({ getById: async () => null }),
    );
    await assert.rejects(deletedUser.execute(`token:${USER_ID}`), InvalidToken);
  });
});

describe("account use cases", () => {
  it("verifies the old password before hashing and storing the new one", async () => {
    let newHash: string | null = null;
    const change = new ChangePassword(
      userRepository({
        updatePassword: async (_userId, passwordHash) => {
          newHash = passwordHash;
          return storedUser(passwordHash);
        },
      }),
      passwordHasher,
    );

    await change.execute(
      USER_ID,
      "old-password",
      new NewPassword("new-password"),
    );
    assert.equal(newHash, "hash:new-password");

    await assert.rejects(
      change.execute(
        USER_ID,
        "wrong-password",
        new NewPassword("new-password"),
      ),
      InvalidCurrentPassword,
    );
  });

  it("deletes the requested user without inventing a not-found error", async () => {
    let deletedId: string | null = null;
    const remove = new DeleteUser(
      userRepository({
        delete: async (userId) => {
          deletedId = userId;
          return false;
        },
      }),
    );
    await remove.execute(USER_ID);
    assert.equal(deletedId, USER_ID);
  });
});

describe("speech use cases", () => {
  it("consumes quota, transcribes, analyzes, then atomically creates speech", async () => {
    const calls: string[] = [];
    const quota: AnalysisQuota = {
      tryConsume: async () => {
        calls.push("quota");
        return true;
      },
    };
    const transcriber: Transcriber = {
      transcribe: async () => {
        calls.push("transcribe");
        return "I spoke clearly.";
      },
    };
    const analyzer: GrammarAnalyzer = {
      analyze: async (transcript) => {
        calls.push(`analyze:${transcript}`);
        return analysis;
      },
    };
    const speeches = speechRepository({
      create: async (userId, transcript, speechAnalysis) => {
        calls.push("create-aggregate");
        return new Speech({
          id: SPEECH_ID,
          userId,
          transcript,
          analysis: speechAnalysis,
          createdAt: CREATED_AT,
        });
      },
    });

    const result = await new ProcessSpeech(
      stagedAudioStore(calls),
      speeches,
      transcriber,
      analyzer,
      quota,
    ).execute(USER_ID, STAGED_AUDIO_REFERENCE);

    assert.equal(result.id, SPEECH_ID);
    assert.deepEqual(calls, [
      "resolve-audio",
      "quota",
      "transcribe",
      "analyze:I spoke clearly.",
      "create-aggregate",
      "delete-audio",
    ]);
  });

  it("stops before provider work when local quota is unavailable", async () => {
    let providerCalled = false;
    const process = new ProcessSpeech(
      stagedAudioStore(),
      speechRepository(),
      {
        transcribe: async () => {
          providerCalled = true;
          return "";
        },
      },
      { analyze: async () => analysis },
      { tryConsume: async () => false },
    );

    await assert.rejects(
      process.execute(USER_ID, STAGED_AUDIO_REFERENCE),
      AnalysisQuotaReached,
    );
    assert.equal(providerCalled, false);
  });

  it("maps the provider quota signal to the public quota error", async () => {
    const process = new ProcessSpeech(
      stagedAudioStore(),
      speechRepository(),
      {
        transcribe: async () => {
          throw new InferenceQuotaReached();
        },
      },
      { analyze: async () => analysis },
      { tryConsume: async () => true },
    );
    await assert.rejects(
      process.execute(USER_ID, STAGED_AUDIO_REFERENCE),
      AnalysisQuotaReached,
    );
  });

  it("lists 100 recent items by default while preserving explicit pagination", async () => {
    const calls: Array<[string, number, number]> = [];
    const list = new ListSpeeches(
      speechRepository({
        list: async (userId, limit, offset) => {
          calls.push([userId, limit, offset]);
          return [];
        },
      }),
    );
    await list.execute(USER_ID);
    await list.execute(USER_ID, 20, 40);
    assert.deepEqual(calls, [
      [USER_ID, 100, 0],
      [USER_ID, 20, 40],
    ]);
  });

  it("uses one owner-scoped delete and hides foreign IDs as not found", async () => {
    let argumentsSeen: readonly string[] = [];
    const remove = new DeleteSpeech(
      speechRepository({
        deleteOwned: async (speechId, userId) => {
          argumentsSeen = [speechId, userId];
          return false;
        },
      }),
    );
    await assert.rejects(remove.execute(SPEECH_ID, USER_ID), SpeechNotFound);
    assert.deepEqual(argumentsSeen, [SPEECH_ID, USER_ID]);
  });
});

describe("analytics use cases", () => {
  it("builds the dashboard with both analytics reads", async () => {
    const calls: string[] = [];
    const analytics: AnalyticsReader = {
      distribution: async () => {
        calls.push("distribution");
        return { mistakeFrequencies: [], totalSpeeches: 0 };
      },
      timeSeries: async (_userId, _range, _category, bucket) => {
        calls.push(`time-series:${bucket}`);
        return { points: [] };
      },
    };
    const dashboard = await new RetrieveAnalyticsDashboard(analytics).execute(
      USER_ID,
      new DateRange(),
      "article_usage",
    );

    assert.deepEqual(calls, ["distribution", "time-series:month"]);
    assert.equal(dashboard.bucket, "month");
    assert.equal(dashboard.mistakeCategory, "article_usage");
  });
});
