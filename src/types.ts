// Core type definitions for agents-bench.

/** A single benchmark task as declared in bench.yaml. */
export interface Task {
  /** Stable identifier, unique within the config. */
  id: string;
  /** Instruction handed to the agent (substituted into the agent template). */
  prompt: string;
  /** Shell command run after the agent; exit code 0 means success. */
  check: string;
}

/** Parsed and validated bench.yaml contents. */
export interface BenchConfig {
  /** Agent command template containing a {{prompt}} placeholder. */
  agent: string;
  /** Context file under test, relative to repo root. Default "AGENTS.md". */
  context_file: string;
  /** Number of repetitions per condition (with/without). Default 1. */
  seeds: number;
  /** Tasks to benchmark. */
  tasks: Task[];
}

/** Outcome of a single agent+check execution. */
export interface RunOutcome {
  /** True when the check command exited 0. */
  passed: boolean;
  /** Exit code of the check command. */
  checkExitCode: number;
  /** Exit code of the agent command. */
  agentExitCode: number;
}

/** Wilson score confidence interval for a rate difference. */
export interface ConfidenceInterval {
  low: number;
  high: number;
  confidenceLevel: number;
}

/** Statistical comparison of with-context and without-context pass rates. */
export interface UpliftStatistics {
  withPasses: number;
  withTotal: number;
  withoutPasses: number;
  withoutTotal: number;
  difference: number;
  pValue: number;
  confidenceInterval: ConfidenceInterval;
  significant: boolean;
  significanceLabel: "significant" | "not_significant" | "low_confidence";
}

/** Aggregated results for one task across all seeds and both conditions. */
export interface TaskResult {
  id: string;
  /** Number of seeds run per condition. */
  seeds: number;
  /** Outcomes with the context file present. */
  withContext: RunOutcome[];
  /** Outcomes with the context file moved aside. */
  withoutContext: RunOutcome[];
  /** Pass rate (0..1) with context present. */
  passRateWith: number;
  /** Pass rate (0..1) with context absent. */
  passRateWithout: number;
  /** Uplift = passRateWith - passRateWithout, range -1..1. */
  uplift: number;
  /** Two-proportion z-test and Wilson interval for the uplift. */
  statistics: UpliftStatistics;
}

/** Full benchmark report across all tasks. */
export interface BenchReport {
  context_file: string;
  seeds: number;
  tasks: TaskResult[];
  /** Mean uplift across all tasks, range -1..1. */
  aggregateUplift: number;
  /** Pooled statistical comparison across all task outcomes. */
  aggregateStatistics: UpliftStatistics;
}
