# AGENTS.md

Context for coding agents working on **agents-bench**. This file is dogfooded:
agents-bench exists to measure whether files like this one actually help an
agent, so this repo keeps its own AGENTS.md tight and useful.

## What this project is

A CLI that measures the *efficacy* of a context file (`AGENTS.md` / `CLAUDE.md`)
on a repo's golden tasks. It runs a coding agent twice per task, once with the
file present and once with it moved aside, runs a check after each run, and
reports the uplift (pass-rate with minus pass-rate without). The differentiator
versus every existing tool: those lint syntax, this measures causal uplift.

## Stack and conventions

- **Runtime:** Bun + TypeScript. No build step; `src/cli.ts` runs directly.
- **Package manager:** `bun`. Do not use npm, yarn, or pnpm.
- **YAML:** parsed with the built-in `Bun.YAML.parse`. Do not add a YAML dep.
- **No new runtime dependencies** unless there is a strong reason. The only dev
  dependencies are `@types/bun` and `typescript` (for `tsc --noEmit`).
- **Style:** straight quotes only. No em dashes or en dashes anywhere in code,
  comments, docs, or output.
- **Strictness:** `tsconfig.json` is strict with `noUncheckedIndexedAccess`.
  Keep `tsc --noEmit` clean.

## Layout

```
src/
  types.ts     shared interfaces (Task, BenchConfig, RunOutcome, ...)
  config.ts    load + validate bench.yaml (ConfigError on bad input)
  context.ts   move the context file aside and always restore it
  agent.ts     run the agent + check; includes the deterministic mock backend
  uplift.ts    pure pass-rate and uplift math (no I/O)
  runner.ts    A/B orchestration tying the above together
  report.ts    human table and JSON formatting
  cli.ts       arg parsing + main entry point
test/          one *.test.ts per src module
examples/      example bench.yaml + a tiny fixture repo for the mock demo
```

## Commands

- Run tests: `bun test`
- Typecheck: `./node_modules/.bin/tsc --noEmit`
- Mock demo: `bun run demo`
- Run the CLI: `bun run src/cli.ts --help`

## Working rules

- **Tests first.** This repo is test-driven. Add or update a test in
  `test/<module>.test.ts` before changing behavior in `src/<module>.ts`.
- **Keep the mock deterministic.** `agent.ts` decides mock success from the
  presence of the context file plus a stable hash of the prompt. Tests depend on
  this. Do not introduce randomness or time into the mock.
- **Never break the restore guarantee.** `withContextHidden` must restore the
  context file in a `finally` block. Any change there needs the crash-safety
  test in `test/context.test.ts` to still pass.
- **Pure math stays pure.** `uplift.ts` must not do I/O. It is the most heavily
  tested module precisely because it is pure.
- **No destructive operations.** The tool moves and restores one file and runs
  user-provided commands in a user-specified directory. It must never delete
  user files itself.

## How we use Codex to maintain this

This is forward-looking: the maintainer plans to use the OpenAI Codex CLI for
ongoing upkeep. None of this claims past Codex commits.

- **PR review:** run `codex exec` over the diff of an incoming pull request to
  flag missing tests, broken invariants (especially the restore guarantee and
  mock determinism), and style violations (stray em dashes, npm usage).
- **Issue triage:** summarize new issues, label them, and propose a minimal
  reproduction or a failing test that captures the bug before any fix.
- **Release notes:** generate a changelog entry from the commit range since the
  last tag, grouped into features, fixes, and docs.

When Codex (or any agent) works here, it should follow the working rules above
and keep both `bun test` and `tsc --noEmit` green before opening a PR.
