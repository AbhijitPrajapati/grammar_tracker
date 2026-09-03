import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = join(projectRoot, "docker-compose.e2e.yaml");
const composeArguments = [
  "compose",
  "--project-name",
  "grammar-tracker-e2e",
  "--file",
  composeFile,
];
let composeWasStarted = false;

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
}

function requireSuccess(result, operation) {
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${operation} failed with exit code ${result.status}`);
  }
}

try {
  composeWasStarted = true;
  requireSuccess(
    run(
      "docker",
      [...composeArguments, "up", "--build", "--detach", "--wait"],
      projectRoot,
    ),
    "Starting the isolated E2E stack",
  );

  const playwrightCli = join(
    projectRoot,
    "node_modules",
    "@playwright",
    "test",
    "cli.js",
  );
  const result = run(
    process.execPath,
    [playwrightCli, "test", ...process.argv.slice(2)],
    projectRoot,
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (composeWasStarted) {
    run(
      "docker",
      [...composeArguments, "down", "--volumes", "--remove-orphans"],
      projectRoot,
    );
  }
}
