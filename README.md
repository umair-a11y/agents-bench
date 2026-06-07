# agents-bench

> v0.1, experimental. Measures whether an `AGENTS.md` (or `CLAUDE.md`) context
> file actually improves a coding agent on your repo's golden tasks. Efficacy,
> not lint.

## The problem

Every tool that touches `AGENTS.md` today checks its *syntax*: does it have the
right headings, is it too long, does it follow a style guide. None of them
answer the question that actually matters:

**Does this file make the agent better at real tasks, or not?**

`agents-bench` measures that directly. It runs your coding agent on a set of
golden tasks twice: once with the context file present, once with it moved
aside. It runs a real check after each attempt and reports the **uplift**: the
pass-rate with the file minus the pass-rate without it. Positive uplift means
the file earns its place. Zero or negative uplift means it does not.

## Quick start (mock backend, zero API)

The built-in `mock` backend is deterministic and offline. It lets you see the
A/B orchestration and uplift math work end to end with no API key.

```sh
git clone <your-fork-url> agents-bench
cd agents-bench
bun install

bun run src/cli.ts --agent mock --config examples/bench.yaml --repo examples/fixture
```

You should see:

```
TASK              WITH  WITHOUT  UPLIFT
----------------  ----  -------  ------
add-readme-badge  100%  100%     0%
write-changelog   100%  100%     0%
fix-lint-config   100%  0%       +100%
refactor-helpers  100%  0%       +100%

context file: AGENTS.md   seeds: 3
aggregate uplift: +50%
```

The mock is rigged to "succeed more often when the context file is present", so
two of the four example tasks show a clean uplift and two show none. That is the
whole point made visible: not every task benefits from context, and the
aggregate tells you the net effect.

Add `--json` for machine-readable output.

## Real backends

The agent command is fully configurable. Use a template with a `{{prompt}}`
placeholder. Two documented examples:

OpenAI Codex CLI:

```yaml
agent: 'codex exec "{{prompt}}"'
```

Claude Code:

```yaml
agent: 'claude -p "{{prompt}}"'
```

A real `bench.yaml`:

```yaml
agent: 'codex exec "{{prompt}}"'
context_file: AGENTS.md
seeds: 3

tasks:
  - id: add-retry-to-client
    prompt: "Add exponential backoff retry to the HTTP client in src/http.ts."
    check: "bun test test/http.test.ts"

  - id: fix-flaky-parser
    prompt: "The date parser fails on ISO weeks. Fix it so the parser tests pass."
    check: "bun test test/parser.test.ts"
```

Run it against the repo you want to evaluate:

```sh
bun run src/cli.ts --config bench.yaml --repo /path/to/target-repo
```

The agent runs inside `--repo`. Each `check` runs in that same directory after
the agent finishes; exit code 0 counts as a pass.

## How uplift is computed

For each task, with `seeds` repetitions per condition:

```
pass_rate_with    = passes_with_context    / seeds
pass_rate_without = passes_without_context / seeds
uplift            = pass_rate_with - pass_rate_without
```

The aggregate uplift is the mean uplift across all tasks. Range is -1 to +1.

- **+1**: the file took the task from never passing to always passing.
- **0**: the file made no measurable difference.
- **-1**: the file made things worse.

The context file is moved aside (renamed to a sibling sidecar) for the "without"
condition and restored afterwards in a `finally` block, so it comes back even if
a run crashes.

## CLI options

```
-c, --config <path>   Path to bench.yaml (default: ./bench.yaml)
-r, --repo <dir>      Target repo the agent runs in (default: cwd)
-a, --agent <cmd>     Override the agent command (e.g. "mock")
-s, --seeds <n>       Override seeds per condition
    --json            Emit JSON instead of a table
-h, --help            Show help
```

## Limitations

This is v0.1. Be honest with yourself about what the number means.

- **Agent runs are nondeterministic.** A single seed is noise. Use several
  seeds and treat small uplift values as "not measured", not "no effect". The
  more variance your agent has, the more seeds you need.
- **No statistical significance test yet.** The tool reports raw rates and their
  difference. It does not tell you whether an uplift is significant given your
  seed count. Treat large, repeatable uplift as the signal.
- **Checks are as good as you make them.** A `check` that always passes will
  report zero uplift no matter what. Write checks that actually fail when the
  task is not done.
- **Cost and time.** Real backends cost API calls and wall-clock time:
  `tasks x seeds x 2` agent invocations per run. Start with a few tasks.
- **Side effects.** The agent runs real commands in your target repo. Point it
  at a clean checkout or a throwaway copy. The tool never deletes your files,
  but the *agent* can change them.

## Development

```sh
bun test          # run the suite (offline, deterministic)
bun run demo      # the mock demo shortcut
```

The A/B orchestration, uplift math, and context-file move/restore are all
covered by the test suite using the mock backend, so the core logic is verified
without any API.

## License

MIT. Copyright (c) 2026 Umair Gill.
