import { describe, test, expect } from "bun:test";
import {
  parseConfig,
  validateConfig,
  ConfigError,
  DEFAULT_CONTEXT_FILE,
  DEFAULT_SEEDS,
} from "../src/config.ts";

describe("parseConfig defaults", () => {
  test("applies default context_file and seeds", () => {
    const cfg = parseConfig(`
agent: mock
tasks:
  - id: t1
    prompt: do a thing
    check: "true"
`);
    expect(cfg.context_file).toBe(DEFAULT_CONTEXT_FILE);
    expect(cfg.seeds).toBe(DEFAULT_SEEDS);
    expect(cfg.tasks.length).toBe(1);
    expect(cfg.tasks[0]!.id).toBe("t1");
  });

  test("honors explicit context_file and seeds", () => {
    const cfg = parseConfig(`
agent: 'codex exec "{{prompt}}"'
context_file: CLAUDE.md
seeds: 5
tasks:
  - id: t1
    prompt: p
    check: "true"
`);
    expect(cfg.context_file).toBe("CLAUDE.md");
    expect(cfg.seeds).toBe(5);
    expect(cfg.agent).toContain("{{prompt}}");
  });
});

describe("validateConfig errors", () => {
  test("rejects non-object", () => {
    expect(() => validateConfig("nope")).toThrow(ConfigError);
  });

  test("rejects missing agent", () => {
    expect(() => validateConfig({ tasks: [] })).toThrow(/agent/);
  });

  test("rejects real agent template without {{prompt}}", () => {
    expect(() =>
      validateConfig({
        agent: "codex exec",
        tasks: [{ id: "a", prompt: "p", check: "true" }],
      }),
    ).toThrow(/\{\{prompt\}\}/);
  });

  test("allows mock agent without {{prompt}}", () => {
    const cfg = validateConfig({
      agent: "mock",
      tasks: [{ id: "a", prompt: "p", check: "true" }],
    });
    expect(cfg.agent).toBe("mock");
  });

  test("rejects empty tasks list", () => {
    expect(() => validateConfig({ agent: "mock", tasks: [] })).toThrow(/tasks/);
  });

  test("rejects duplicate task ids", () => {
    expect(() =>
      validateConfig({
        agent: "mock",
        tasks: [
          { id: "dup", prompt: "p", check: "true" },
          { id: "dup", prompt: "q", check: "true" },
        ],
      }),
    ).toThrow(/duplicate/);
  });

  test("rejects task missing check", () => {
    expect(() =>
      validateConfig({
        agent: "mock",
        tasks: [{ id: "a", prompt: "p" }],
      }),
    ).toThrow(/check/);
  });

  test("rejects non-positive seeds", () => {
    expect(() =>
      validateConfig({
        agent: "mock",
        seeds: 0,
        tasks: [{ id: "a", prompt: "p", check: "true" }],
      }),
    ).toThrow(/seeds/);
  });

  test("rejects non-integer seeds", () => {
    expect(() =>
      validateConfig({
        agent: "mock",
        seeds: 2.5,
        tasks: [{ id: "a", prompt: "p", check: "true" }],
      }),
    ).toThrow(/seeds/);
  });
});

describe("parseConfig invalid yaml", () => {
  test("wraps YAML parse failures in ConfigError", () => {
    expect(() => parseConfig("agent: [unclosed")).toThrow(ConfigError);
  });
});
