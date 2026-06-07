import { describe, test, expect, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBenchmark } from "../src/runner.ts";
import { MOCK_RESULT_FILE } from "../src/agent.ts";
import type { BenchConfig } from "../src/types.ts";

const tmpDirs: string[] = [];
async function makeRepo(withContext: boolean): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agents-bench-run-"));
  tmpDirs.push(dir);
  if (withContext) await writeFile(join(dir, "AGENTS.md"), "ctx");
  return dir;
}
afterEach(async () => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop()!;
    await rm(d, { recursive: true, force: true });
  }
});

const CHECK = `test "$(cat ${MOCK_RESULT_FILE})" = "pass"`;

function mockConfig(seeds: number): BenchConfig {
  return {
    agent: "mock",
    context_file: "AGENTS.md",
    seeds,
    tasks: [
      // Easy: passes even without context.
      { id: "easy", prompt: "Add a build status badge to the top of README.md.", check: CHECK },
      // Hard: only passes with context.
      { id: "hard", prompt: "Extract duplicated helpers into a shared module.", check: CHECK },
    ],
  };
}

describe("runBenchmark A/B orchestration (mock backend)", () => {
  test("hard task shows full uplift, easy task shows none", async () => {
    const repo = await makeRepo(true);
    const report = await runBenchmark(mockConfig(3), repo);

    const easy = report.tasks.find((t) => t.id === "easy")!;
    const hard = report.tasks.find((t) => t.id === "hard")!;

    // Easy task: passes in both conditions -> no uplift.
    expect(easy.passRateWith).toBe(1);
    expect(easy.passRateWithout).toBe(1);
    expect(easy.uplift).toBe(0);

    // Hard task: passes only with context -> full uplift.
    expect(hard.passRateWith).toBe(1);
    expect(hard.passRateWithout).toBe(0);
    expect(hard.uplift).toBe(1);

    // Aggregate is the mean: (0 + 1) / 2 = 0.5.
    expect(report.aggregateUplift).toBeCloseTo(0.5, 10);
    expect(report.seeds).toBe(3);
    expect(report.context_file).toBe("AGENTS.md");
  });

  test("records the configured number of seeds per condition", async () => {
    const repo = await makeRepo(true);
    const report = await runBenchmark(mockConfig(4), repo);
    for (const task of report.tasks) {
      expect(task.withContext.length).toBe(4);
      expect(task.withoutContext.length).toBe(4);
    }
  });

  test("restores the context file after the run", async () => {
    const repo = await makeRepo(true);
    const ctx = join(repo, "AGENTS.md");
    expect(existsSync(ctx)).toBe(true);
    await runBenchmark(mockConfig(2), repo);
    // The file must be back exactly where it started.
    expect(existsSync(ctx)).toBe(true);
    expect(existsSync(ctx + ".agents-bench-hidden")).toBe(false);
  });

  test("with no context file present, with and without are identical", async () => {
    const repo = await makeRepo(false); // no AGENTS.md at all
    const report = await runBenchmark(mockConfig(2), repo);
    // Both conditions are "absent", so uplift collapses to 0 everywhere.
    for (const task of report.tasks) {
      expect(task.uplift).toBe(0);
    }
    expect(report.aggregateUplift).toBe(0);
  });

  test("emits progress messages", async () => {
    const repo = await makeRepo(true);
    const messages: string[] = [];
    await runBenchmark(mockConfig(1), repo, (m) => messages.push(m));
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.includes("with context"))).toBe(true);
    expect(messages.some((m) => m.includes("without context"))).toBe(true);
  });
});
