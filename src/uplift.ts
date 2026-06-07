// Pure uplift math. No I/O so it is trivially unit-testable.

import type {
  RunOutcome,
  TaskResult,
  BenchReport,
  ConfidenceInterval,
  UpliftStatistics,
} from "./types.ts";

const DEFAULT_CONFIDENCE_LEVEL = 0.95;
const Z_95 = 1.959963984540054;
const SIGNIFICANCE_ALPHA = 0.05;

/** Fraction of outcomes that passed, in the range 0..1. Empty input is 0. */
export function passRate(outcomes: RunOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const passes = outcomes.filter((o) => o.passed).length;
  return passes / outcomes.length;
}

function passCount(outcomes: RunOutcome[]): number {
  return outcomes.filter((o) => o.passed).length;
}

function clampRate(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf =
    sign *
    (1 -
      (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
        t *
        Math.exp(-x * x)));
  return 0.5 * (1 + erf);
}

function twoProportionPValue(
  withPasses: number,
  withTotal: number,
  withoutPasses: number,
  withoutTotal: number,
): number {
  if (withTotal === 0 || withoutTotal === 0) return 1;

  const pWith = withPasses / withTotal;
  const pWithout = withoutPasses / withoutTotal;
  const difference = pWith - pWithout;
  if (difference === 0) return 1;

  const pooled = (withPasses + withoutPasses) / (withTotal + withoutTotal);
  const standardError = Math.sqrt(
    pooled * (1 - pooled) * (1 / withTotal + 1 / withoutTotal),
  );
  if (standardError === 0) return 1;

  const z = Math.abs(difference / standardError);
  return 2 * (1 - normalCdf(z));
}

function wilsonInterval(
  passes: number,
  total: number,
  z = Z_95,
): { low: number; high: number } {
  if (total === 0) return { low: 0, high: 1 };

  const p = passes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const margin =
    z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);

  return {
    low: clampRate((center - margin) / denominator),
    high: clampRate((center + margin) / denominator),
  };
}

function differenceInterval(
  withPasses: number,
  withTotal: number,
  withoutPasses: number,
  withoutTotal: number,
): ConfidenceInterval {
  if (withTotal === 0 || withoutTotal === 0) {
    return {
      low: -1,
      high: 1,
      confidenceLevel: DEFAULT_CONFIDENCE_LEVEL,
    };
  }

  const withInterval = wilsonInterval(withPasses, withTotal);
  const withoutInterval = wilsonInterval(withoutPasses, withoutTotal);

  return {
    low: Math.max(-1, withInterval.low - withoutInterval.high),
    high: Math.min(1, withInterval.high - withoutInterval.low),
    confidenceLevel: DEFAULT_CONFIDENCE_LEVEL,
  };
}

function significanceLabel(
  difference: number,
  pValue: number,
  confidenceInterval: ConfidenceInterval,
): UpliftStatistics["significanceLabel"] {
  const excludesZero =
    confidenceInterval.low > 0 || confidenceInterval.high < 0;
  if (pValue < SIGNIFICANCE_ALPHA && excludesZero) return "significant";
  if (difference !== 0) return "low_confidence";
  return "not_significant";
}

export function comparePassRates(
  withContext: RunOutcome[],
  withoutContext: RunOutcome[],
): UpliftStatistics {
  const withPasses = passCount(withContext);
  const withoutPasses = passCount(withoutContext);
  const withTotal = withContext.length;
  const withoutTotal = withoutContext.length;
  const difference = passRate(withContext) - passRate(withoutContext);
  const pValue = twoProportionPValue(
    withPasses,
    withTotal,
    withoutPasses,
    withoutTotal,
  );
  const confidenceInterval = differenceInterval(
    withPasses,
    withTotal,
    withoutPasses,
    withoutTotal,
  );
  const label =
    withTotal === 0 || withoutTotal === 0
      ? "low_confidence"
      : significanceLabel(difference, pValue, confidenceInterval);

  return {
    withPasses,
    withTotal,
    withoutPasses,
    withoutTotal,
    difference,
    pValue,
    confidenceInterval,
    significant: label === "significant",
    significanceLabel: label,
  };
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
  const statistics = comparePassRates(withContext, withoutContext);
  return {
    id,
    seeds: withContext.length,
    withContext,
    withoutContext,
    passRateWith,
    passRateWithout,
    uplift: passRateWith - passRateWithout,
    statistics,
  };
}

/** Mean uplift across tasks, in the range -1..1. Empty input is 0. */
export function aggregateUplift(tasks: TaskResult[]): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, t) => sum + t.uplift, 0);
  return total / tasks.length;
}

function aggregateStatistics(tasks: TaskResult[]): UpliftStatistics {
  const withContext = tasks.flatMap((task) => task.withContext);
  const withoutContext = tasks.flatMap((task) => task.withoutContext);
  return comparePassRates(withContext, withoutContext);
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
    aggregateStatistics: aggregateStatistics(tasks),
  };
}
