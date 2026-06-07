import { describe, test, expect } from "bun:test";
import { parseArgs, applyOverrides } from "../src/cli.ts";
import { ConfigError } from "../src/config.ts";
import type { BenchConfig } from "../src/types.ts";

describe("parseArgs", () => {
  test("defaults", () => {
    const o = parseArgs([]);
    expect(o.config).toBe("bench.yaml");
    expect(o.repo).toBe(".");
    expect(o.json).toBe(false);
    expect(o.help).toBe(false);
    expect(o.agent).toBeUndefined();
    expect(o.seeds).toBeUndefined();
  });

  test("long flags", () => {
    const o = parseArgs([
      "--config", "x.yaml",
      "--repo", "/tmp/r",
      "--agent", "mock",
      "--seeds", "5",
      "--json",
    ]);
    expect(o.config).toBe("x.yaml");
    expect(o.repo).toBe("/tmp/r");
    expect(o.agent).toBe("mock");
    expect(o.seeds).toBe(5);
    expect(o.json).toBe(true);
  });

  test("short flags", () => {
    const o = parseArgs(["-c", "y.yaml", "-r", "/r", "-a", "mock", "-s", "2"]);
    expect(o.config).toBe("y.yaml");
    expect(o.repo).toBe("/r");
    expect(o.agent).toBe("mock");
    expect(o.seeds).toBe(2);
  });

  test("--help sets help", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-h"]).help).toBe(true);
  });

  test("rejects unknown flag", () => {
    expect(() => parseArgs(["--nope"])).toThrow(ConfigError);
  });

  test("rejects missing value", () => {
    expect(() => parseArgs(["--config"])).toThrow(/requires a value/);
  });

  test("rejects non-integer seeds", () => {
    expect(() => parseArgs(["--seeds", "abc"])).toThrow(/positive integer/);
  });
});

describe("applyOverrides", () => {
  const base: BenchConfig = {
    agent: "codex",
    context_file: "AGENTS.md",
    seeds: 1,
    tasks: [{ id: "a", prompt: "p", check: "true" }],
  };

  test("overrides agent and seeds when provided", () => {
    const out = applyOverrides(base, {
      config: "bench.yaml",
      repo: ".",
      agent: "mock",
      seeds: 7,
      json: false,
      help: false,
    });
    expect(out.agent).toBe("mock");
    expect(out.seeds).toBe(7);
    expect(out.context_file).toBe("AGENTS.md"); // untouched
  });

  test("keeps config values when no override", () => {
    const out = applyOverrides(base, {
      config: "bench.yaml",
      repo: ".",
      json: false,
      help: false,
    });
    expect(out.agent).toBe("codex");
    expect(out.seeds).toBe(1);
  });
});
