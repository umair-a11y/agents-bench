import { describe, test, expect } from "bun:test";
import {
  passRate,
  summarizeTask,
  aggregateUplift,
  comparePassRates,
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
    expect(r.statistics.difference).toBeCloseTo(2 / 3, 10);
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

describe("comparePassRates statistics", () => {
  test("zero seeds returns an uninformative low confidence result", () => {
    const stats = comparePassRates([], []);
    expect(stats.withPasses).toBe(0);
    expect(stats.withTotal).toBe(0);
    expect(stats.withoutPasses).toBe(0);
    expect(stats.withoutTotal).toBe(0);
    expect(stats.difference).toBe(0);
    expect(stats.pValue).toBe(1);
    expect(stats.confidenceInterval.low).toBe(-1);
    expect(stats.confidenceInterval.high).toBe(1);
    expect(stats.significant).toBe(false);
    expect(stats.significanceLabel).toBe("low_confidence");
  });

  test("all pass in both conditions is not significant", () => {
    const stats = comparePassRates([pass(), pass()], [pass(), pass()]);
    expect(stats.difference).toBe(0);
    expect(stats.pValue).toBe(1);
    expect(stats.confidenceInterval.low).toBeLessThan(0);
    expect(stats.confidenceInterval.high).toBeGreaterThan(0);
    expect(stats.significant).toBe(false);
    expect(stats.significanceLabel).toBe("not_significant");
  });

  test("all fail in both conditions is not significant", () => {
    const stats = comparePassRates([fail(), fail()], [fail(), fail()]);
    expect(stats.difference).toBe(0);
    expect(stats.pValue).toBe(1);
    expect(stats.confidenceInterval.low).toBeLessThan(0);
    expect(stats.confidenceInterval.high).toBeGreaterThan(0);
    expect(stats.significant).toBe(false);
    expect(stats.significanceLabel).toBe("not_significant");
  });

  test("identical rates are not significant", () => {
    const stats = comparePassRates(
      [pass(), pass(), fail(), fail()],
      [pass(), pass(), fail(), fail()],
    );
    expect(stats.difference).toBe(0);
    expect(stats.pValue).toBe(1);
    expect(stats.confidenceInterval.low).toBeLessThan(0);
    expect(stats.confidenceInterval.high).toBeGreaterThan(0);
    expect(stats.significant).toBe(false);
    expect(stats.significanceLabel).toBe("not_significant");
  });

  test("tiny samples with a full observed gap are labeled low confidence", () => {
    const stats = comparePassRates([pass()], [fail()]);
    expect(stats.difference).toBe(1);
    expect(stats.pValue).toBeGreaterThan(0.05);
    expect(stats.confidenceInterval.low).toBeLessThanOrEqual(0);
    expect(stats.confidenceInterval.high).toBe(1);
    expect(stats.significant).toBe(false);
    expect(stats.significanceLabel).toBe("low_confidence");
  });

  test("large repeated gaps are significant with a CI above zero", () => {
    const stats = comparePassRates(
      Array.from({ length: 18 }, () => pass()).concat(
        Array.from({ length: 2 }, () => fail()),
      ),
      Array.from({ length: 5 }, () => pass()).concat(
        Array.from({ length: 15 }, () => fail()),
      ),
    );
    expect(stats.difference).toBeCloseTo(0.65, 10);
    expect(stats.pValue).toBeLessThan(0.001);
    expect(stats.confidenceInterval.low).toBeGreaterThan(0);
    expect(stats.confidenceInterval.high).toBeLessThanOrEqual(1);
    expect(stats.significant).toBe(true);
    expect(stats.significanceLabel).toBe("significant");
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
    expect(report.aggregateStatistics.difference).toBeCloseTo(2 / 3, 10);
    expect(report.aggregateStatistics.withPasses).toBe(3);
    expect(report.aggregateStatistics.withTotal).toBe(3);
    expect(report.aggregateStatistics.withoutPasses).toBe(1);
    expect(report.aggregateStatistics.withoutTotal).toBe(3);
  });
});
