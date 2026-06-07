// Load and validate bench.yaml into a BenchConfig.
//
// Parsing uses Bun.YAML (built in). Validation is explicit so a bad config
// fails fast with a clear message instead of a confusing runtime error later.

import type { BenchConfig, Task } from "./types.ts";

export const DEFAULT_CONTEXT_FILE = "AGENTS.md";
export const DEFAULT_SEEDS = 1;

/** Raised when a config is structurally invalid. Message is user-facing. */
export class ConfigError extends Error {}

/** Validate an already-parsed object into a BenchConfig. Pure, testable. */
export function validateConfig(raw: unknown): BenchConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new ConfigError("config must be a YAML mapping at the top level");
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.agent !== "string" || obj.agent.trim() === "") {
    throw new ConfigError('config must define a non-empty string "agent"');
  }
  const agent = obj.agent;

  // A real agent template must contain the {{prompt}} placeholder. The mock
  // backend ignores the template, so it is exempt.
  if (agent !== "mock" && !agent.includes("{{prompt}}")) {
    throw new ConfigError(
      'agent template must contain the {{prompt}} placeholder (or be "mock")',
    );
  }

  let context_file = DEFAULT_CONTEXT_FILE;
  if (obj.context_file !== undefined) {
    if (typeof obj.context_file !== "string" || obj.context_file.trim() === "") {
      throw new ConfigError('"context_file" must be a non-empty string');
    }
    context_file = obj.context_file;
  }

  let seeds = DEFAULT_SEEDS;
  if (obj.seeds !== undefined) {
    if (
      typeof obj.seeds !== "number" ||
      !Number.isInteger(obj.seeds) ||
      obj.seeds < 1
    ) {
      throw new ConfigError('"seeds" must be a positive integer');
    }
    seeds = obj.seeds;
  }

  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
    throw new ConfigError('config must define a non-empty "tasks" list');
  }

  const seenIds = new Set<string>();
  const tasks: Task[] = obj.tasks.map((t, i) => validateTask(t, i, seenIds));

  return { agent, context_file, seeds, tasks };
}

function validateTask(raw: unknown, index: number, seenIds: Set<string>): Task {
  if (typeof raw !== "object" || raw === null) {
    throw new ConfigError(`task #${index} must be a mapping`);
  }
  const t = raw as Record<string, unknown>;

  if (typeof t.id !== "string" || t.id.trim() === "") {
    throw new ConfigError(`task #${index} must have a non-empty string "id"`);
  }
  if (seenIds.has(t.id)) {
    throw new ConfigError(`duplicate task id "${t.id}"`);
  }
  seenIds.add(t.id);

  if (typeof t.prompt !== "string" || t.prompt.trim() === "") {
    throw new ConfigError(`task "${t.id}" must have a non-empty string "prompt"`);
  }
  if (typeof t.check !== "string" || t.check.trim() === "") {
    throw new ConfigError(`task "${t.id}" must have a non-empty string "check"`);
  }

  return { id: t.id, prompt: t.prompt, check: t.check };
}

/** Parse YAML text into a validated BenchConfig. */
export function parseConfig(yamlText: string): BenchConfig {
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(yamlText);
  } catch (e) {
    throw new ConfigError(`could not parse YAML: ${(e as Error).message}`);
  }
  return validateConfig(parsed);
}

/** Read and validate a bench.yaml file from disk. */
export async function loadConfig(path: string): Promise<BenchConfig> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new ConfigError(`config file not found: ${path}`);
  }
  return parseConfig(await file.text());
}
