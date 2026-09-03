import "server-only";

import { Redis } from "@upstash/redis";

import {
  ChangePassword,
  DeleteSpeech,
  DeleteUser,
  ListSpeeches,
  Login,
  ProcessSpeech,
  RegisterAndStartSession,
  ResolveSession,
  RetrieveAnalyticsDashboard,
} from "@/src/core/application/use-cases";
import type { StagedAudioStore } from "@/src/core/application/ports/services";
import { Argon2PasswordHasher } from "@/src/adapters/outbound/auth/argon2-password-hasher";
import { JwtTokenService } from "@/src/adapters/outbound/auth/jwt-token-service";
import { VercelBlobStagedAudioStore } from "@/src/adapters/outbound/blob";
import { getServerEnvironment } from "@/src/adapters/outbound/config/env";
import {
  DeterministicGrammarAnalyzer,
  DeterministicTranscriber,
} from "@/src/adapters/outbound/openai/deterministic";
import { OpenAiClient } from "@/src/adapters/outbound/openai/client";
import { OpenAiGrammarAnalyzer } from "@/src/adapters/outbound/openai/grammar-analyzer";
import { OpenAiTranscriber } from "@/src/adapters/outbound/openai/transcriber";
import {
  PostgresAnalyticsReader,
  PostgresSpeechRepository,
  PostgresUserRepository,
} from "@/src/adapters/outbound/postgres";
import { UpstashAnalysisQuota } from "@/src/adapters/outbound/quota";

export interface ApplicationContainer {
  readonly registerAndStartSession: RegisterAndStartSession;
  readonly login: Login;
  readonly resolveSession: ResolveSession;
  readonly changePassword: ChangePassword;
  readonly deleteUser: DeleteUser;
  readonly processSpeech: ProcessSpeech;
  readonly listSpeeches: ListSpeeches;
  readonly deleteSpeech: DeleteSpeech;
  readonly retrieveAnalyticsDashboard: RetrieveAnalyticsDashboard;
  readonly stagedAudioStore: StagedAudioStore;
}

let applicationContainer: ApplicationContainer | undefined;

/** The application's only composition root. No domain or use-case imports a framework. */
export function getApplicationContainer(): ApplicationContainer {
  applicationContainer ??= createApplicationContainer();
  return applicationContainer;
}

export function createApplicationContainer(): ApplicationContainer {
  const environment = getServerEnvironment();

  const users = new PostgresUserRepository();
  const speeches = new PostgresSpeechRepository();
  const analytics = new PostgresAnalyticsReader();
  const passwordHasher = new Argon2PasswordHasher();
  const tokens = new JwtTokenService({
    secret: environment.jwtSecret,
    expirationMinutes: environment.sessionTtlMinutes,
  });

  const quota = new UpstashAnalysisQuota(
    new Redis({
      url: environment.upstashRedisRestUrl,
      token: environment.upstashRedisRestToken,
    }),
    {
      minuteLimit: environment.analysisMinuteLimit,
      dayLimit: environment.analysisDayLimit,
    },
  );

  let transcriber;
  let grammarAnalyzer;
  if (environment.analyzerMode === "deterministic") {
    transcriber = new DeterministicTranscriber();
    grammarAnalyzer = new DeterministicGrammarAnalyzer();
  } else {
    const apiKey = environment.openAiApiKey;
    if (!apiKey) {
      // The environment parser owns this invariant. Keep the composition root
      // safe if a future configuration source bypasses that parser.
      throw new Error("OPENAI_API_KEY is required");
    }
    const client = new OpenAiClient({
      apiKey,
      baseUrl: environment.openAiBaseUrl,
      timeoutMs: environment.openAiTimeoutMs,
      maxRetries: environment.openAiMaxRetries,
    });
    transcriber = new OpenAiTranscriber(
      client,
      environment.openAiTranscriptionModel,
    );
    grammarAnalyzer = new OpenAiGrammarAnalyzer(
      client,
      environment.openAiAnalysisModel,
    );
  }

  const stagedAudioStore = new VercelBlobStagedAudioStore(
    environment.blobStoreId,
  );

  return Object.freeze({
    registerAndStartSession: new RegisterAndStartSession(
      users,
      passwordHasher,
      tokens,
    ),
    login: new Login(users, passwordHasher, tokens),
    resolveSession: new ResolveSession(tokens, users),
    changePassword: new ChangePassword(users, passwordHasher),
    deleteUser: new DeleteUser(users),
    processSpeech: new ProcessSpeech(
      speeches,
      transcriber,
      grammarAnalyzer,
      quota,
    ),
    listSpeeches: new ListSpeeches(speeches),
    deleteSpeech: new DeleteSpeech(speeches),
    retrieveAnalyticsDashboard: new RetrieveAnalyticsDashboard(analytics),
    stagedAudioStore,
  });
}
