import { describe, test, expect } from "bun:test";
import {
  passRate,
  summarizeTask,
  aggregateUplift,
  buildReport,
} from "../src/uplift.ts";
import type { RunOutcome } from "../src/types.ts";

function pass(): RunOutcome {
  return { passed: true, checkExitCode: 0, agentExitCode: 0 };
}
function fail(): RunOutcome {
  return { passed: false, checkExitCode: 1, agentExitCode: 0 };
}

describe("passRate", () => {
  test("empty input is 0", () => {
    expect(passRate([])).toBe(0);
  });

  test("all passing is 1", () => {
    expect(passRate([pass(), pass()])).toBe(1);
  });

  test("half passing is 0.5", () => {
    expect(passRate([pass(), fail()])).toBe(0.5);
  });

  test("none passing is 0", () => {
    expect(passRate([fail(), fail()])).toBe(0);
  });
});

describe("summarizeTask uplift math", () => {
  test("positive uplift when context helps", () => {
    const withCtx = [pass(), pass(), pass()];
    const withoutCtx = [pass(), fail(), fail()];
    const r = summarizeTask("t1", withCtx, withoutCtx);
    expect(r.passRateWith).toBe(1);
    expect(r.passRateWithout).toBeCloseTo(1 / 3, 10);
    expect(r.uplift).toBeCloseTo(2 / 3, 10);
    expect(r.seeds).toBe(3);
  });

  test("zero uplift when context makes no difference", () => {
    const r = summarizeTask("t2", [pass(), fail()], [pass(), fail()]);
    expect(r.uplift).toBe(0);
  });

  test("negative uplift when context hurts", () => {
    const r = summarizeTask("t3", [fail(), fail()], [pass(), pass()]);
    expect(r.uplift).toBe(-1);
  });
});

describe("aggregateUplift", () => {
  test("empty is 0", () => {
    expect(aggregateUplift([])).toBe(0);
  });

  test("mean across tasks", () => {
    const tasks = [
      summarizeTask("a", [pass()], [fail()]), // +1
      summarizeTask("b", [fail()], [pass()]), // -1
      summarizeTask("c", [pass()], [pass()]), //  0
    ];
    expect(aggregateUplift(tasks)).toBeCloseTo(0, 10);
  });
});

describe("buildReport", () => {
  test("carries metadata and computes aggregate", () => {
    const tasks = [
      summarizeTask("a", [pass(), pass()], [pass(), fail()]), // +0.5
      summarizeTask("b", [pass()], [fail()]), // +1
    ];
    const report = buildReport("AGENTS.md", 2, tasks);
    expect(report.context_file).toBe("AGENTS.md");
    expect(report.seeds).toBe(2);
    expect(report.tasks.length).toBe(2);
    expect(report.aggregateUplift).toBeCloseTo(0.75, 10);
  });
});
