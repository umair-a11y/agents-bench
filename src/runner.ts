// A/B orchestration: for each task, run the agent `seeds` times with the
// context file present, then `seeds` times with it moved aside. Restore the
// file afterwards (guaranteed by withContextHidden).

import { join } from "node:path";
import type { BenchConfig, RunOutcome, TaskResult, BenchReport } from "./types.ts";
import { runOnce } from "./agent.ts";
import { withContextHidden } from "./context.ts";
import { summarizeTask, buildReport } from "./uplift.ts";

/** Optional progress callback for CLI feedback. */
export type ProgressFn = (msg: string) => void;

/**
 * Run the full benchmark.
 *
 * @param config   Parsed bench.yaml.
 * @param repoDir  Absolute path to the target repo the agent operates in.
 * @param onProgress Optional progress reporter.
 */
export async function runBenchmark(
  config: BenchConfig,
  repoDir: string,
  onProgress: ProgressFn = () => {},
): Promise<BenchReport> {
  const contextPath = join(repoDir, config.context_file);
  const results: TaskResult[] = [];

  for (const task of config.tasks) {
    onProgress(`task ${task.id}: with context (${config.seeds} seed(s))`);
    const withContext: RunOutcome[] = [];
    for (let s = 0; s < config.seeds; s++) {
      withContext.push(
        await runOnce({
          agent: config.agent,
          prompt: task.prompt,
          check: task.check,
          contextFile: config.context_file,
          cwd: repoDir,
        }),
      );
    }

    onProgress(`task ${task.id}: without context (${config.seeds} seed(s))`);
    const withoutContext = await withContextHidden(contextPath, async () => {
      const outcomes: RunOutcome[] = [];
      for (let s = 0; s < config.seeds; s++) {
        outcomes.push(
          await runOnce({
            agent: config.agent,
            prompt: task.prompt,
            check: task.check,
            contextFile: config.context_file,
            cwd: repoDir,
          }),
        );
      }
      return outcomes;
    });

    results.push(summarizeTask(task.id, withContext, withoutContext));
  }

  return buildReport(config.context_file, config.seeds, results);
}
