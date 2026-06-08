#!/usr/bin/env bash
#
# Local Codex code review for agents-bench.
#
# This uses your Codex / ChatGPT subscription through the codex CLI.
# There is no OpenAI API key and no CI secret involved. You log in once with
# "codex login" (ChatGPT) and this script reads your changes only.
#
# What it does:
#   Runs "codex exec review" in a read-only sandbox against a base branch
#   (default: main). Codex reads AGENTS.md, diffs your branch against the base,
#   and prints review notes. It never edits the working tree.
#
# Usage:
#   ./scripts/codex-review.sh            # review current branch vs main
#   ./scripts/codex-review.sh develop    # review current branch vs develop
#   bun run review                       # same thing via package.json
#
set -euo pipefail

BASE_BRANCH="${1:-main}"

if ! command -v codex >/dev/null 2>&1; then
  echo "error: the codex CLI is not on your PATH." >&2
  echo >&2
  echo "Install the Codex CLI, then sign in with your ChatGPT (Codex) account:" >&2
  echo "  npm install -g @openai/codex   # or: brew install codex" >&2
  echo "  codex login                    # sign in with ChatGPT, no API key" >&2
  echo >&2
  echo "Then re-run: ./scripts/codex-review.sh ${BASE_BRANCH}" >&2
  exit 1
fi

echo "Running codex exec review (read-only) against base branch: ${BASE_BRANCH}"
echo "Using your Codex / ChatGPT subscription. No API key, no CI secret."
echo

# -s read-only is a global flag and must come before the review subcommand.
# review --base diffs the current branch against BASE_BRANCH. Codex reads
# AGENTS.md on its own; the prompt below focuses it on this repo's invariants.
exec codex exec -s read-only review --base "${BASE_BRANCH}" "$(cat <<'PROMPT'
You are reviewing changes for the agents-bench repository. Read AGENTS.md in the
repository root first; it defines the project invariants and conventions.

Focus your review on the AGENTS.md working rules, specifically:
  - Tests-first: behavior changes must come with test changes.
  - The restore guarantee in src/context.ts: withContextHidden must always
    restore the context file in a finally block.
  - Mock determinism: no randomness or time in the mock backend.
  - uplift.ts stays pure (no I/O).
  - No destructive operations on user files.
  - Style: straight quotes only, no em dashes or en dashes, and bun instead of
    npm, yarn, or pnpm.

Output concise Markdown review notes grouped into Blocking, Should-fix, and
Nits. If you find nothing material, say so in one line. Do not restate the diff.
PROMPT
)"
