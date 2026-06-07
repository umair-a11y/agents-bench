// Temporarily move the context file aside, run work, then always restore it.
//
// Safety contract:
//   - The file is moved to a sibling path with a ".agents-bench-hidden" suffix.
//   - withContextHidden() restores the original in a finally block, so the
//     file comes back even if the callback throws or the process logic fails.
//   - If the context file does not exist, the "absent" condition is a no-op
//     (it is already absent) and restoration does nothing.

import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

/** Suffix used for the temporarily moved-aside context file. */
export const HIDDEN_SUFFIX = ".agents-bench-hidden";

/** Compute the hidden path for a given context file path. */
export function hiddenPathFor(contextPath: string): string {
  return join(dirname(contextPath), basename(contextPath) + HIDDEN_SUFFIX);
}

/**
 * Run `fn` with the context file temporarily moved aside (made absent),
 * then restore it no matter what.
 *
 * Returns whatever `fn` returns. Re-throws any error from `fn` after
 * restoring the file.
 */
export async function withContextHidden<T>(
  contextPath: string,
  fn: () => Promise<T>,
): Promise<T> {
  const hidden = hiddenPathFor(contextPath);
  const existed = existsSync(contextPath);

  if (existed) {
    await rename(contextPath, hidden);
  }

  try {
    return await fn();
  } finally {
    // Restore only if we moved it and the hidden file is still there.
    if (existed && existsSync(hidden)) {
      await rename(hidden, contextPath);
    }
  }
}
