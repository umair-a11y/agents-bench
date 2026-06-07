// Run an agent command then a check command, in a target repo directory.
//
// Two execution paths:
//   - Real backend: the configured `agent` template, e.g. `codex exec "{{prompt}}"`.
//   - Mock backend: `agent: mock`. Deterministic, offline. It "succeeds more
//     often when the context file is present" so the A/B math is testable with
//     no API. The mock writes a result file the example check reads.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunOutcome } from "./types.ts";

/** Sentinel agent value that selects the built-in mock backend. */
export const MOCK_AGENT = "mock";

/** File the mock writes its verdict into, read by the example checks. */
export const MOCK_RESULT_FILE = ".agents-bench-mock-result";

/** Substitute {{prompt}} in the agent template. Quoting is the user's job. */
export function renderAgentCommand(template: string, prompt: string): string {
  return template.replaceAll("{{prompt}}", prompt);
}

/** Run a shell command in `cwd`, resolving to its exit code. Never rejects. */
export function runShell(
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      stdio: "ignore",
    });
    child.on("error", () => resolve(127));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

/**
 * Deterministic mock agent.
 *
 * It decides pass/fail purely from whether the context file is present in the
 * target repo and from the task prompt, so a run is fully reproducible. With
 * the context file present every task passes; without it, only tasks whose
 * prompt hashes into the "easy" bucket pass. This guarantees a positive,
 * deterministic uplift for the example config.
 *
 * Writes "pass" or "fail" to MOCK_RESULT_FILE so the example check can read it.
 */
export async function runMockAgent(
  prompt: string,
  contextFile: string,
  cwd: string,
): Promise<number> {
  const contextPresent = existsSync(join(cwd, contextFile));
  const passed = contextPresent || isEasyWithoutContext(prompt);
  await writeFile(join(cwd, MOCK_RESULT_FILE), passed ? "pass" : "fail");
  return 0;
}

/**
 * Deterministic "is this task easy enough to pass without context" check.
 * Uses a stable hash of the prompt. Roughly half of arbitrary prompts are
 * easy, but the example tasks are chosen so context produces real uplift.
 */
export function isEasyWithoutContext(prompt: string): boolean {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = (hash * 31 + prompt.charCodeAt(i)) & 0x7fffffff;
  }
  return hash % 2 === 0;
}

/**
 * Execute one task once: run the agent, then the check. Returns the outcome.
 *
 * `agent` is either the special MOCK_AGENT string or a real command template.
 * `contextFile` is the path (relative to cwd) under test; the mock uses it to
 * decide success.
 */
export async function runOnce(args: {
  agent: string;
  prompt: string;
  check: string;
  contextFile: string;
  cwd: string;
}): Promise<RunOutcome> {
  const { agent, prompt, check, contextFile, cwd } = args;

  let agentExitCode: number;
  if (agent === MOCK_AGENT) {
    agentExitCode = await runMockAgent(prompt, contextFile, cwd);
  } else {
    agentExitCode = await runShell(renderAgentCommand(agent, prompt), cwd);
  }

  const checkExitCode = await runShell(check, cwd);
  return {
    passed: checkExitCode === 0,
    checkExitCode,
    agentExitCode,
  };
}
