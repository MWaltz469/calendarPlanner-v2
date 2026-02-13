#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { stdin as input, stdout as output } from "node:process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, "..");
const WRANGLER_NPX_PREFIX = ["--yes", "wrangler@4.50.0"];
const PLACEHOLDER_DB_ID = "00000000-0000-0000-0000-000000000000";

main().catch((error) => {
  console.error(`\n[deploy] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const interactive = !args.yes;
  const root = resolve(args.root || DEFAULT_ROOT);

  const paths = {
    root,
    wranglerToml: resolve(root, "wrangler.toml"),
    deployConfig: resolve(root, "deploy.config.json"),
    deployConfigExample: resolve(root, "deploy.config.example.json"),
    deployEnv: resolve(root, ".env.deploy.local"),
    deployEnvExample: resolve(root, ".env.deploy.example")
  };

  if (!existsSync(paths.wranglerToml)) {
    throw new Error(`Missing wrangler.toml at ${paths.wranglerToml}`);
  }

  const wranglerTomlOriginal = readFileSync(paths.wranglerToml, "utf8");
  const wranglerValues = extractWranglerValues(wranglerTomlOriginal);
  const deployConfig = loadJsonObject(paths.deployConfig);
  const deployEnv = loadEnvFile(paths.deployEnv);

  const runEnv = {
    ...process.env,
    ...deployEnv
  };
  const hasApiToken = Boolean(String((args.token || runEnv.CLOUDFLARE_API_TOKEN || "")).trim());

  if (args.accountId) {
    runEnv.CLOUDFLARE_ACCOUNT_ID = args.accountId;
  }
  if (args.token) {
    runEnv.CLOUDFLARE_API_TOKEN = args.token;
  }

  const rl = interactive ? createInterface({ input, output }) : null;

  try {
    const defaultProjectName =
      args.project ||
      runEnv.CF_PAGES_PROJECT ||
      deployConfig.projectName ||
      wranglerValues.projectName ||
      "trip-week-planner";
    const defaultBranch =
      args.branch || runEnv.CF_PAGES_BRANCH || deployConfig.branch || "main";

    const defaultDbName =
      args.dbName ||
      runEnv.CF_D1_DB_NAME ||
      deployConfig.databaseName ||
      wranglerValues.dbName ||
      defaultProjectName;

    const defaultDbId =
      args.dbId ||
      runEnv.CF_D1_DB_ID ||
      deployConfig.databaseId ||
      (isPlaceholderDbId(wranglerValues.dbId) ? "" : wranglerValues.dbId);

    console.log("[deploy] Cloudflare one-click orchestrator");
    console.log(`[deploy] Root: ${paths.root}`);

    const projectName = await promptValue(rl, "Pages project name", defaultProjectName);
    const branchName = await promptValue(rl, "Deploy branch (production URL)", defaultBranch);
    const dbName = await promptValue(rl, "D1 database name", defaultDbName);

    if (!projectName || !branchName || !dbName) {
      throw new Error("Pages project name, deploy branch, and D1 database name are required.");
    }

    await ensureWranglerAuth({ interactive, rl, runEnv, paths });

    if (args.destroy) {
      await destroyFlow({
        interactive,
        force: args.force,
        rl,
        runEnv,
        projectName,
        dbName,
        wranglerTomlOriginal,
        paths,
        deployConfig
      });
      return;
    }

    let dbId = defaultDbId;
    if (!dbId && hasApiToken) {
      dbId = await findDatabaseIdByName(dbName, runEnv, paths.root);
      if (dbId) {
        console.log(`[deploy] Found existing D1 database \"${dbName}\" (${dbId}).`);
      }
    }

    if (!dbId) {
      const shouldCreate = await confirm(
        rl,
        `No D1 database named \"${dbName}\" found. Create it now?`,
        true,
        interactive
      );

      if (!shouldCreate) {
        throw new Error("Cannot continue without a D1 database ID.");
      }

      dbId = await createDatabase(dbName, runEnv, paths.root, {
        hasApiToken,
        wranglerTomlPath: paths.wranglerToml
      });
      console.log(`[deploy] Created D1 database \"${dbName}\" (${dbId}).`);
    }

    if (!dbId) {
      throw new Error("Could not determine D1 database_id.");
    }

    const wranglerTomlNext = applyWranglerValues(wranglerTomlOriginal, {
      projectName,
      dbName,
      dbId
    });

    if (wranglerTomlNext !== wranglerTomlOriginal) {
      writeFileSync(paths.wranglerToml, wranglerTomlNext, "utf8");
      console.log(`[deploy] Updated ${paths.wranglerToml}.`);
    } else {
      console.log("[deploy] wrangler.toml already up to date.");
    }

    writeDeployConfig(paths.deployConfig, {
      projectName,
      branch: branchName,
      databaseName: dbName,
      databaseId: dbId,
      accountId: runEnv.CLOUDFLARE_ACCOUNT_ID || deployConfig.accountId || ""
    });
    ensureDeployTemplates(paths);

    await ensurePagesProject(projectName, runEnv, paths.root, hasApiToken);

    runWrangler(["d1", "migrations", "apply", dbName, "--remote"], {
      env: runEnv,
      cwd: paths.root
    });

    const deployResult = runWrangler(["pages", "deploy", ".", "--project-name", projectName, "--branch", branchName], {
      env: runEnv,
      cwd: paths.root,
      capture: true
    });

    const deployOutput = `${deployResult.stdout}\n${deployResult.stderr}`;
    const liveUrl = extractLiveUrl(deployOutput, projectName);

    console.log(deployOutput.trim());
    console.log("\n" + "=".repeat(50));
    console.log("[deploy] Deployment complete!");
    console.log("=".repeat(50));
    console.log(`  Project : ${projectName}`);
    console.log(`  Branch  : ${branchName}`);
    console.log(`  Database: ${dbName} (${dbId})`);
    if (liveUrl) {
      console.log(`  Live URL: ${liveUrl}`);
    }
    console.log("=".repeat(50));
    if (liveUrl) {
      console.log(`\nShare this link with your group:\n\n  ${liveUrl}\n`);
    }
  } finally {
    rl?.close();
  }
}

async function destroyFlow(context) {
  const {
    interactive,
    force,
    rl,
    runEnv,
    projectName,
    dbName,
    wranglerTomlOriginal,
    paths,
    deployConfig
  } = context;

  if (!force && !interactive) {
    throw new Error("Destroy mode is destructive. Re-run with --force.");
  }

  if (!force && interactive) {
    const typed = (await rl.question(`Type the project name \"${projectName}\" to confirm destroy: `)).trim();
    if (typed !== projectName) {
      throw new Error("Destroy confirmation did not match. Aborting.");
    }
  }

  console.log("\n[deploy] Destroy mode: deleting remote resources...");

  await deletePagesProject(projectName, runEnv, paths.root, interactive);
  await deleteD1Database(dbName, runEnv, paths.root, interactive);

  const wranglerTomlNext = applyWranglerValues(wranglerTomlOriginal, {
    projectName,
    dbName,
    dbId: PLACEHOLDER_DB_ID
  });
  if (wranglerTomlNext !== wranglerTomlOriginal) {
    writeFileSync(paths.wranglerToml, wranglerTomlNext, "utf8");
    console.log(`[deploy] Reset database_id placeholder in ${paths.wranglerToml}.`);
  }

  writeDeployConfig(paths.deployConfig, {
    projectName,
    databaseName: dbName,
    databaseId: "",
    accountId: runEnv.CLOUDFLARE_ACCOUNT_ID || deployConfig.accountId || ""
  });

  console.log("[deploy] Destroy complete.");
}

function parseArgs(argv) {
  const result = {
    yes: false,
    destroy: false,
    force: false,
    project: "",
    branch: "",
    dbName: "",
    dbId: "",
    root: "",
    accountId: "",
    token: ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--yes") {
      result.yes = true;
      continue;
    }
    if (token === "--destroy") {
      result.destroy = true;
      continue;
    }
    if (token === "--force") {
      result.force = true;
      continue;
    }

    if (token.startsWith("--project=")) {
      result.project = token.slice("--project=".length).trim();
      continue;
    }
    if (token === "--project") {
      result.project = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }

    if (token.startsWith("--branch=")) {
      result.branch = token.slice("--branch=".length).trim();
      continue;
    }
    if (token === "--branch") {
      result.branch = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }

    if (token.startsWith("--db-name=")) {
      result.dbName = token.slice("--db-name=".length).trim();
      continue;
    }
    if (token === "--db-name") {
      result.dbName = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }

    if (token.startsWith("--db-id=")) {
      result.dbId = token.slice("--db-id=".length).trim();
      continue;
    }
    if (token === "--db-id") {
      result.dbId = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }

    if (token.startsWith("--root=")) {
      result.root = token.slice("--root=".length).trim();
      continue;
    }
    if (token === "--root") {
      result.root = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }

    if (token.startsWith("--account-id=")) {
      result.accountId = token.slice("--account-id=".length).trim();
      continue;
    }
    if (token === "--account-id") {
      result.accountId = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }

    if (token.startsWith("--token=")) {
      result.token = token.slice("--token=".length).trim();
      continue;
    }
    if (token === "--token") {
      result.token = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
  }

  return result;
}

async function promptValue(rl, label, defaultValue) {
  if (!rl) {
    return String(defaultValue || "").trim();
  }

  const prompt = defaultValue ? `${label} [${defaultValue}]: ` : `${label}: `;
  const answer = (await rl.question(prompt)).trim();
  return answer || String(defaultValue || "").trim();
}

async function confirm(rl, message, defaultYes, interactive) {
  if (!interactive || !rl) {
    return defaultYes;
  }

  const suffix = defaultYes ? " [Y/n]: " : " [y/N]: ";
  const answer = (await rl.question(`${message}${suffix}`)).trim().toLowerCase();
  if (!answer) {
    return defaultYes;
  }

  return answer === "y" || answer === "yes";
}

async function ensureWranglerAuth(context) {
  const { interactive, rl, runEnv, paths } = context;
  const hasToken = Boolean(String(runEnv.CLOUDFLARE_API_TOKEN || "").trim());
  const hasAccountId = Boolean(String(runEnv.CLOUDFLARE_ACCOUNT_ID || "").trim());

  if (hasToken) {
    if (!hasAccountId) {
      if (!interactive || !rl) {
        throw new Error(
          "CLOUDFLARE_ACCOUNT_ID is required with CLOUDFLARE_API_TOKEN. Set it in .env.deploy.local or pass --account-id."
        );
      }
      const accountId = (await rl.question("Cloudflare account ID (required for API token auth): ")).trim();
      if (!accountId) {
        throw new Error("Cloudflare account ID is required for API token auth.");
      }
      runEnv.CLOUDFLARE_ACCOUNT_ID = accountId;
    }

    console.log("[deploy] Using API token authentication from environment.");
    return;
  }

  const whoami = runWrangler(["whoami"], {
    capture: true,
    allowFailure: true,
    quiet: true,
    env: runEnv,
    cwd: paths.root
  });

  if (whoami.status === 0) {
    const line = whoami.stdout.trim().split("\n").find(Boolean);
    if (line) {
      console.log(`[deploy] Authenticated: ${line}`);
    } else {
      console.log("[deploy] Wrangler authentication is active.");
    }
    return;
  }

  if (!interactive) {
    throw new Error(
      "No Wrangler auth detected. Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in .env.deploy.local, or run interactive deploy to log in."
    );
  }

  const shouldLogin = await confirm(rl, "Wrangler is not authenticated. Run `wrangler login` now?", true, true);
  if (!shouldLogin) {
    throw new Error("Wrangler authentication is required.");
  }

  runWrangler(["login"], { env: runEnv, cwd: paths.root });

  const checkAgain = runWrangler(["whoami"], {
    capture: true,
    allowFailure: true,
    quiet: true,
    env: runEnv,
    cwd: paths.root
  });

  if (checkAgain.status !== 0) {
    throw new Error("Wrangler login did not complete successfully.");
  }

  console.log("[deploy] Wrangler authentication completed.");
}

async function findDatabaseIdByName(dbName, runEnv, cwd) {
  const listed = runWrangler(["d1", "list", "--json"], {
    capture: true,
    allowFailure: true,
    quiet: true,
    env: runEnv,
    cwd
  });

  if (listed.status === 0) {
    const data = parseJson(listed.stdout);
    const rows = Array.isArray(data) ? data : Array.isArray(data?.result) ? data.result : [];
    const matched = rows.find((item) => String(item?.name || "") === dbName);
    return matched ? String(matched.uuid || matched.id || matched.database_id || "").trim() : "";
  }

  const listedText = `${listed.stdout}\n${listed.stderr}`;
  if (!usesUnsupportedJson(listedText)) {
    return "";
  }

  const listedFallback = runWrangler(["d1", "list"], {
    capture: true,
    allowFailure: true,
    quiet: true,
    env: runEnv,
    cwd
  });

  if (listedFallback.status !== 0) {
    return "";
  }

  return parseD1ListForDatabaseId(`${listedFallback.stdout}\n${listedFallback.stderr}`, dbName);
}

async function createDatabase(dbName, runEnv, cwd, options = {}) {
  const hasApiToken = Boolean(options.hasApiToken);
  const wranglerTomlPath = options.wranglerTomlPath || resolve(cwd, "wrangler.toml");

  if (!hasApiToken) {
    const before = existsSync(wranglerTomlPath) ? readFileSync(wranglerTomlPath, "utf8") : "";
    const beforeId = extractWranglerValues(before).dbId;

    try {
      runWrangler(
        ["d1", "create", dbName, "--binding", "DB", "--update-config", "--use-remote"],
        {
          env: runEnv,
          cwd
        }
      );
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error || "");
      if (!/already exists|already been taken|already created/i.test(message)) {
        throw error;
      }
    }

    const after = existsSync(wranglerTomlPath) ? readFileSync(wranglerTomlPath, "utf8") : "";
    const afterId = extractWranglerValues(after).dbId;
    if (afterId && !isPlaceholderDbId(afterId) && afterId !== beforeId) {
      return afterId;
    }

    if (afterId && !isPlaceholderDbId(afterId)) {
      return afterId;
    }

    throw new Error(
      `D1 create completed but database_id was not written to ${wranglerTomlPath}. ` +
        "Add CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID for non-interactive lookup, then rerun."
    );
  }

  const created = runWrangler(["d1", "create", dbName, "--json"], {
    capture: true,
    allowFailure: true,
    quiet: true,
    env: runEnv,
    cwd
  });

  let createOutput = `${created.stdout}\n${created.stderr}`;
  if (created.status !== 0 && usesUnsupportedJson(createOutput)) {
    const createdFallback = runWrangler(["d1", "create", dbName], {
      capture: true,
      allowFailure: true,
      quiet: true,
      env: runEnv,
      cwd
    });
    createOutput = `${createdFallback.stdout}\n${createdFallback.stderr}`;

    if (createdFallback.status === 0) {
      const idFromFallbackOutput = extractDatabaseId(createOutput);
      if (idFromFallbackOutput) {
        return idFromFallbackOutput;
      }
      const idFromFallbackList = await findDatabaseIdByName(dbName, runEnv, cwd);
      if (idFromFallbackList) {
        return idFromFallbackList;
      }
      throw new Error(`Database was created but database_id could not be found for \"${dbName}\".`);
    }

    if (!/already exists/i.test(createOutput)) {
      throw new Error(`Failed to create D1 database \"${dbName}\".\n${createOutput.trim()}`);
    }
  } else if (created.status !== 0) {
    if (!/already exists/i.test(createOutput)) {
      throw new Error(`Failed to create D1 database \"${dbName}\".\n${createOutput.trim()}`);
    }
  }

  const idFromOutput = extractDatabaseId(created.stdout) || extractDatabaseId(created.stderr);
  if (idFromOutput) {
    return idFromOutput;
  }

  const idFromList = await findDatabaseIdByName(dbName, runEnv, cwd);
  if (idFromList) {
    return idFromList;
  }

  throw new Error(`Could not parse database_id for \"${dbName}\".`);
}

async function ensurePagesProject(projectName, runEnv, cwd, hasApiToken) {
  if (!hasApiToken) {
    const createdInteractive = runWrangler(["pages", "project", "create", projectName], {
      allowFailure: true,
      quiet: true,
      env: runEnv,
      cwd
    });

    if (createdInteractive.status !== 0) {
      console.log(
        `[deploy] Pages project create returned non-zero for \"${projectName}\"; continuing because it may already exist.`
      );
    } else {
      console.log(`[deploy] Pages project \"${projectName}\" is ready.`);
    }
    return;
  }

  const created = runWrangler(["pages", "project", "create", projectName], {
    capture: true,
    allowFailure: true,
    quiet: true,
    env: runEnv,
    cwd
  });

  if (created.status !== 0) {
    const output = `${created.stdout}\n${created.stderr}`;
    if (!/already exists/i.test(output)) {
      throw new Error(`Failed to create Pages project \"${projectName}\".\n${output.trim()}`);
    }
  }

  console.log(`[deploy] Pages project \"${projectName}\" is ready.`);
}

async function deletePagesProject(projectName, runEnv, cwd, interactive) {
  const deleted = runWrangler(["pages", "project", "delete", projectName, "--yes"], {
    capture: true,
    allowFailure: true,
    quiet: true,
    env: runEnv,
    cwd
  });

  if (deleted.status === 0) {
    console.log(`[deploy] Deleted Pages project \"${projectName}\".`);
    return;
  }

  const output = `${deleted.stdout}\n${deleted.stderr}`;
  if (isNotFound(output)) {
    console.log(`[deploy] Pages project \"${projectName}\" was already absent.`);
    return;
  }

  if (usesUnsupportedYes(output) && interactive) {
    runWrangler(["pages", "project", "delete", projectName], { env: runEnv, cwd });
    console.log(`[deploy] Deleted Pages project \"${projectName}\".`);
    return;
  }

  throw new Error(`Failed to delete Pages project \"${projectName}\".\n${output.trim()}`);
}

async function deleteD1Database(dbName, runEnv, cwd, interactive) {
  const deleted = runWrangler(["d1", "delete", dbName, "--yes"], {
    capture: true,
    allowFailure: true,
    quiet: true,
    env: runEnv,
    cwd
  });

  if (deleted.status === 0) {
    console.log(`[deploy] Deleted D1 database \"${dbName}\".`);
    return;
  }

  const output = `${deleted.stdout}\n${deleted.stderr}`;
  if (isNotFound(output)) {
    console.log(`[deploy] D1 database \"${dbName}\" was already absent.`);
    return;
  }

  if (usesUnsupportedYes(output) && interactive) {
    runWrangler(["d1", "delete", dbName], { env: runEnv, cwd });
    console.log(`[deploy] Deleted D1 database \"${dbName}\".`);
    return;
  }

  throw new Error(`Failed to delete D1 database \"${dbName}\".\n${output.trim()}`);
}

function runWrangler(args, options = {}) {
  return runCommand("npx", [...WRANGLER_NPX_PREFIX, ...args], options);
}

function runCommand(command, args, options = {}) {
  const opts = {
    capture: false,
    allowFailure: false,
    quiet: false,
    env: process.env,
    cwd: DEFAULT_ROOT,
    ...options
  };

  if (!opts.quiet) {
    console.log(`\n$ ${command} ${args.join(" ")}`);
  }

  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    env: opts.env,
    encoding: "utf8",
    stdio: opts.capture ? ["inherit", "pipe", "pipe"] : "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !opts.allowFailure) {
    const text = opts.capture ? `\n${result.stdout || ""}\n${result.stderr || ""}` : "";
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}${text}`);
  }

  return {
    status: result.status || 0,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function extractWranglerValues(toml) {
  return {
    projectName: matchTomlValue(toml, /^name\s*=\s*"([^"]+)"/m),
    dbName: matchTomlValue(toml, /^database_name\s*=\s*"([^"]+)"/m),
    dbId: matchTomlValue(toml, /^database_id\s*=\s*"([^"]+)"/m)
  };
}

function applyWranglerValues(toml, values) {
  let next = toml;
  next = upsertTomlLine(next, /^name\s*=\s*"[^"]*"/m, `name = "${values.projectName}"`);
  next = upsertTomlLine(next, /^database_name\s*=\s*"[^"]*"/m, `database_name = "${values.dbName}"`);
  next = upsertTomlLine(next, /^database_id\s*=\s*"[^"]*"/m, `database_id = "${values.dbId}"`);
  next = upsertTomlLine(next, /^APP_NAME\s*=\s*"[^"]*"/m, `APP_NAME = "${values.projectName}"`);
  return next;
}

function upsertTomlLine(toml, pattern, replacementLine) {
  if (pattern.test(toml)) {
    return toml.replace(pattern, replacementLine);
  }

  if (replacementLine.startsWith("APP_NAME")) {
    if (/^\[vars\]/m.test(toml)) {
      return toml.replace(/^\[vars\]\s*$/m, `[vars]\n${replacementLine}`);
    }
    return `${toml.trimEnd()}\n\n[vars]\n${replacementLine}\n`;
  }

  return `${toml.trimEnd()}\n${replacementLine}\n`;
}

function matchTomlValue(toml, regex) {
  const match = toml.match(regex);
  return match ? String(match[1] || "").trim() : "";
}

function isPlaceholderDbId(value) {
  const id = String(value || "").trim();
  return !id || id === PLACEHOLDER_DB_ID;
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractDatabaseId(raw) {
  if (!raw) {
    return "";
  }

  const parsed = parseJson(raw);
  const candidates = [
    parsed?.uuid,
    parsed?.id,
    parsed?.database_id,
    parsed?.result?.uuid,
    parsed?.result?.id,
    parsed?.result?.database_id
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (candidates.length) {
    return candidates[0];
  }

  const uuidMatch = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return uuidMatch ? uuidMatch[0] : "";
}

function loadJsonObject(path) {
  if (!existsSync(path)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeDeployConfig(path, config) {
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log(`[deploy] Wrote ${path}.`);
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const result = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const idx = trimmed.indexOf("=");
    if (idx < 1) {
      continue;
    }

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

function ensureDeployTemplates(paths) {
  if (!existsSync(paths.deployConfigExample)) {
    writeFileSync(
      paths.deployConfigExample,
      `${JSON.stringify(
        {
          projectName: "trip-week-planner",
          databaseName: "trip-week-planner",
          databaseId: "",
          accountId: ""
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.log(`[deploy] Created ${paths.deployConfigExample}.`);
  }

  if (!existsSync(paths.deployEnvExample)) {
    writeFileSync(
      paths.deployEnvExample,
      "# Cloudflare deploy credentials (optional but recommended for one-click)\n" +
        "# Keep this file out of git.\n" +
        "CLOUDFLARE_API_TOKEN=\n" +
        "CLOUDFLARE_ACCOUNT_ID=\n",
      "utf8"
    );
    console.log(`[deploy] Created ${paths.deployEnvExample}.`);
  }
}

function isNotFound(output) {
  return /not found|does not exist|no project|unknown database|could not find/i.test(output || "");
}

function usesUnsupportedYes(output) {
  return /unknown argument.*yes|unknown option.*yes|unexpected argument.*yes/i.test(output || "");
}

function usesUnsupportedJson(output) {
  return /unknown argument.*json|unknown option.*json|unexpected argument.*json/i.test(output || "");
}

function extractLiveUrl(output, projectName) {
  if (!output) return "";
  const urlMatch = output.match(/https:\/\/[^\s]+\.pages\.dev/i);
  if (urlMatch) return urlMatch[0];
  if (projectName) return `https://${projectName}.pages.dev`;
  return "";
}

function parseD1ListForDatabaseId(output, dbName) {
  if (!output) {
    return "";
  }

  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes(dbName)) {
      continue;
    }
    const uuid = extractDatabaseId(line);
    if (uuid) {
      return uuid;
    }
  }
  return "";
}
