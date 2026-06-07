import { describe, test, expect } from "bun:test";
import { formatTable, formatJson } from "../src/report.ts";
import { summarizeTask, buildReport } from "../src/uplift.ts";
import type { RunOutcome } from "../src/types.ts";

function pass(): RunOutcome {
  return { passed: true, checkExitCode: 0, agentExitCode: 0 };
}
function fail(): RunOutcome {
  return { passed: false, checkExitCode: 1, agentExitCode: 0 };
}

function sampleReport() {
  const tasks = [
    summarizeTask("easy", [pass(), pass()], [pass(), pass()]), // 100/100/0
    summarizeTask("hard", [pass(), pass()], [fail(), fail()]), // 100/0/+100
  ];
  return buildReport("AGENTS.md", 2, tasks);
}

describe("formatTable", () => {
  test("includes headers and per-task rows", () => {
    const out = formatTable(sampleReport());
    expect(out).toContain("TASK");
    expect(out).toContain("WITH");
    expect(out).toContain("WITHOUT");
    expect(out).toContain("UPLIFT");
    expect(out).toContain("easy");
    expect(out).toContain("hard");
  });

  test("renders percentages and signed uplift", () => {
    const out = formatTable(sampleReport());
    expect(out).toContain("100%");
    expect(out).toContain("0%");
    expect(out).toContain("+100%"); // hard task uplift
  });

  test("shows aggregate and metadata footer", () => {
    const out = formatTable(sampleReport());
    expect(out).toContain("aggregate uplift: +50%");
    expect(out).toContain("context file: AGENTS.md");
    expect(out).toContain("seeds: 2");
  });

  test("renders negative uplift with a minus sign", () => {
    const tasks = [summarizeTask("regress", [fail()], [pass()])];
    const out = formatTable(buildReport("AGENTS.md", 1, tasks));
    expect(out).toContain("-100%");
  });
});

describe("formatJson", () => {
  test("round-trips to the same structure", () => {
    const report = sampleReport();
    const parsed = JSON.parse(formatJson(report));
    expect(parsed.context_file).toBe("AGENTS.md");
    expect(parsed.seeds).toBe(2);
    expect(parsed.aggregateUplift).toBeCloseTo(0.5, 10);
    expect(parsed.tasks.length).toBe(2);
    expect(parsed.tasks[1].id).toBe("hard");
    expect(parsed.tasks[1].uplift).toBe(1);
  });
});
