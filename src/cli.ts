#!/usr/bin/env bun
// agents-bench CLI.
//
// Usage:
//   agents-bench [options]
//
// Options:
//   -c, --config <path>   Path to bench.yaml (default: ./bench.yaml)
//   -r, --repo <dir>      Target repo the agent runs in (default: cwd)
//   -a, --agent <cmd>     Override the agent command (e.g. "mock")
//   -s, --seeds <n>       Override seeds per condition
//       --json            Emit JSON instead of a table
//   -h, --help            Show help

import { resolve } from "node:path";
import { loadConfig, ConfigError } from "./config.ts";
import { runBenchmark } from "./runner.ts";
import { formatTable, formatJson } from "./report.ts";
import type { BenchConfig } from "./types.ts";

interface CliOptions {
  config: string;
  repo: string;
  agent?: string;
  seeds?: number;
  json: boolean;
  help: boolean;
}

const HELP = `agents-bench - measure whether a context file (AGENTS.md / CLAUDE.md)
actually improves a coding agent on a repo's golden tasks.

Usage:
  agents-bench [options]

Options:
  -c, --config <path>   Path to bench.yaml (default: ./bench.yaml)
  -r, --repo <dir>      Target repo the agent runs in (default: cwd)
  -a, --agent <cmd>     Override the agent command (e.g. "mock")
  -s, --seeds <n>       Override seeds per condition
      --json            Emit JSON instead of a table
  -h, --help            Show this help

Examples:
  agents-bench --agent mock --config examples/bench.yaml --repo examples/fixture
  agents-bench --config bench.yaml --repo .
`;

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    config: "bench.yaml",
    repo: ".",
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "-c":
      case "--config":
        opts.config = requireValue(argv, ++i, arg);
        break;
      case "-r":
      case "--repo":
        opts.repo = requireValue(argv, ++i, arg);
        break;
      case "-a":
      case "--agent":
        opts.agent = requireValue(argv, ++i, arg);
        break;
      case "-s":
      case "--seeds": {
        const raw = requireValue(argv, ++i, arg);
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) {
          throw new ConfigError(`--seeds must be a positive integer, got "${raw}"`);
        }
        opts.seeds = n;
        break;
      }
      case "--json":
        opts.json = true;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      default:
        throw new ConfigError(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function requireValue(argv: string[], i: number, flag: string): string {
  const v = argv[i];
  if (v === undefined) throw new ConfigError(`${flag} requires a value`);
  return v;
}

/** Apply CLI overrides on top of the loaded config. */
export function applyOverrides(config: BenchConfig, opts: CliOptions): BenchConfig {
  return {
    ...config,
    agent: opts.agent ?? config.agent,
    seeds: opts.seeds ?? config.seeds,
  };
}

export async function main(argv: string[]): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }

  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }

  let config: BenchConfig;
  try {
    config = applyOverrides(await loadConfig(opts.config), opts);
  } catch (e) {
    process.stderr.write(`config error: ${(e as Error).message}\n`);
    return 2;
  }

  const repoDir = resolve(opts.repo);
  const progress = (msg: string) =>
    opts.json ? undefined : process.stderr.write(`  ${msg}\n`);

  const report = await runBenchmark(config, repoDir, progress);

  if (opts.json) {
    process.stdout.write(formatJson(report) + "\n");
  } else {
    process.stdout.write("\n" + formatTable(report) + "\n");
  }
  return 0;
}

// Run only when invoked directly, not when imported by tests.
if (import.meta.main) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
