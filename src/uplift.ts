// Pure uplift math. No I/O so it is trivially unit-testable.

import type { RunOutcome, TaskResult, BenchReport } from "./types.ts";

/** Fraction of outcomes that passed, in the range 0..1. Empty input is 0. */
export function passRate(outcomes: RunOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const passes = outcomes.filter((o) => o.passed).length;
  return passes / outcomes.length;
}

/**
 * Compute a per-task result from the two condition arrays.
 * Uplift is (pass rate with context) minus (pass rate without context).
 */
export function summarizeTask(
  id: string,
  withContext: RunOutcome[],
  withoutContext: RunOutcome[],
): TaskResult {
  const passRateWith = passRate(withContext);
  const passRateWithout = passRate(withoutContext);
  return {
    id,
    seeds: withContext.length,
    withContext,
    withoutContext,
    passRateWith,
    passRateWithout,
    uplift: passRateWith - passRateWithout,
  };
}

/** Mean uplift across tasks, in the range -1..1. Empty input is 0. */
export function aggregateUplift(tasks: TaskResult[]): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, t) => sum + t.uplift, 0);
  return total / tasks.length;
}

/** Assemble the full report from per-task results. */
export function buildReport(
  context_file: string,
  seeds: number,
  tasks: TaskResult[],
): BenchReport {
  return {
    context_file,
    seeds,
    tasks,
    aggregateUplift: aggregateUplift(tasks),
  };
}
