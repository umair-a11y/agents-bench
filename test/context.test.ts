import { describe, test, expect, afterEach } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withContextHidden, hiddenPathFor } from "../src/context.ts";

const tmpDirs: string[] = [];

async function makeTmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agents-bench-ctx-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop()!;
    await rm(d, { recursive: true, force: true });
  }
});

describe("withContextHidden", () => {
  test("file is absent inside the callback, present after", async () => {
    const dir = await makeTmp();
    const ctx = join(dir, "AGENTS.md");
    await writeFile(ctx, "original content");

    let seenInside = true;
    await withContextHidden(ctx, async () => {
      seenInside = existsSync(ctx);
    });

    expect(seenInside).toBe(false); // absent during the callback
    expect(existsSync(ctx)).toBe(true); // restored afterwards
    expect(await readFile(ctx, "utf8")).toBe("original content");
  });

  test("restores the file even when the callback throws", async () => {
    const dir = await makeTmp();
    const ctx = join(dir, "AGENTS.md");
    await writeFile(ctx, "keep me");

    await expect(
      withContextHidden(ctx, async () => {
        expect(existsSync(ctx)).toBe(false);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    // Restored despite the crash.
    expect(existsSync(ctx)).toBe(true);
    expect(await readFile(ctx, "utf8")).toBe("keep me");
    // Hidden sidecar cleaned up (renamed back).
    expect(existsSync(hiddenPathFor(ctx))).toBe(false);
  });

  test("no-op when the context file does not exist", async () => {
    const dir = await makeTmp();
    const ctx = join(dir, "AGENTS.md"); // never created

    let ran = false;
    const result = await withContextHidden(ctx, async () => {
      ran = true;
      expect(existsSync(ctx)).toBe(false);
      return 42;
    });

    expect(ran).toBe(true);
    expect(result).toBe(42);
    expect(existsSync(ctx)).toBe(false);
    expect(existsSync(hiddenPathFor(ctx))).toBe(false);
  });

  test("returns the callback value", async () => {
    const dir = await makeTmp();
    const ctx = join(dir, "AGENTS.md");
    await writeFile(ctx, "x");
    const value = await withContextHidden(ctx, async () => "result");
    expect(value).toBe("result");
  });
});
