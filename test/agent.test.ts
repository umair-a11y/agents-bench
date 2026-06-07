import { describe, test, expect, afterEach } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  renderAgentCommand,
  isEasyWithoutContext,
  runMockAgent,
  runOnce,
  runShell,
  MOCK_RESULT_FILE,
  MOCK_AGENT,
} from "../src/agent.ts";

const tmpDirs: string[] = [];
async function makeTmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agents-bench-agent-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(async () => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop()!;
    await rm(d, { recursive: true, force: true });
  }
});

describe("renderAgentCommand", () => {
  test("substitutes every {{prompt}} occurrence", () => {
    const out = renderAgentCommand('echo "{{prompt}}" && log "{{prompt}}"', "hi");
    expect(out).toBe('echo "hi" && log "hi"');
  });

  test("leaves templates without placeholder unchanged", () => {
    expect(renderAgentCommand("echo static", "hi")).toBe("echo static");
  });
});

describe("isEasyWithoutContext determinism", () => {
  test("same prompt always yields the same verdict", () => {
    const p = "Add a build status badge to the top of README.md.";
    expect(isEasyWithoutContext(p)).toBe(isEasyWithoutContext(p));
  });

  test("the example prompts split into easy and hard", () => {
    expect(
      isEasyWithoutContext("Add a build status badge to the top of README.md."),
    ).toBe(true);
    expect(
      isEasyWithoutContext("Extract duplicated helpers into a shared module."),
    ).toBe(false);
  });
});

describe("runShell", () => {
  test("exit 0 for a successful command", async () => {
    const dir = await makeTmp();
    expect(await runShell("true", dir)).toBe(0);
  });

  test("non-zero for a failing command", async () => {
    const dir = await makeTmp();
    expect(await runShell("exit 7", dir)).toBe(7);
  });

  test("runs in the given cwd", async () => {
    const dir = await makeTmp();
    await writeFile(join(dir, "marker"), "x");
    expect(await runShell("test -f marker", dir)).toBe(0);
  });
});

describe("runMockAgent", () => {
  test("writes pass when context file is present", async () => {
    const dir = await makeTmp();
    await writeFile(join(dir, "AGENTS.md"), "ctx");
    await runMockAgent("Extract duplicated helpers into a shared module.", "AGENTS.md", dir);
    const verdict = await Bun.file(join(dir, MOCK_RESULT_FILE)).text();
    expect(verdict).toBe("pass");
  });

  test("writes fail for a hard task when context is absent", async () => {
    const dir = await makeTmp();
    // No AGENTS.md present.
    await runMockAgent("Extract duplicated helpers into a shared module.", "AGENTS.md", dir);
    const verdict = await Bun.file(join(dir, MOCK_RESULT_FILE)).text();
    expect(verdict).toBe("fail");
  });

  test("writes pass for an easy task even when context is absent", async () => {
    const dir = await makeTmp();
    await runMockAgent("Add a build status badge to the top of README.md.", "AGENTS.md", dir);
    const verdict = await Bun.file(join(dir, MOCK_RESULT_FILE)).text();
    expect(verdict).toBe("pass");
  });
});

describe("runOnce with mock backend", () => {
  const check = `test "$(cat ${MOCK_RESULT_FILE})" = "pass"`;

  test("hard task passes with context present", async () => {
    const dir = await makeTmp();
    await writeFile(join(dir, "AGENTS.md"), "ctx");
    const outcome = await runOnce({
      agent: MOCK_AGENT,
      prompt: "Extract duplicated helpers into a shared module.",
      check,
      contextFile: "AGENTS.md",
      cwd: dir,
    });
    expect(outcome.passed).toBe(true);
    expect(outcome.checkExitCode).toBe(0);
  });

  test("hard task fails with context absent", async () => {
    const dir = await makeTmp();
    const outcome = await runOnce({
      agent: MOCK_AGENT,
      prompt: "Extract duplicated helpers into a shared module.",
      check,
      contextFile: "AGENTS.md",
      cwd: dir,
    });
    expect(outcome.passed).toBe(false);
    expect(outcome.checkExitCode).not.toBe(0);
  });
});
