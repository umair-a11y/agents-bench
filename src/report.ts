// Render a BenchReport as a human-readable table or as JSON.

import type { BenchReport } from "./types.ts";

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function signedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(0)}%`;
}

/** Pad a string to width, left-aligned. */
function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

/**
 * Format a report as an aligned ASCII table plus an aggregate line.
 * Pure string output so it is snapshot-testable.
 */
export function formatTable(report: BenchReport): string {
  const headers = ["TASK", "WITH", "WITHOUT", "UPLIFT"];
  const rows = report.tasks.map((t) => [
    t.id,
    pct(t.passRateWith),
    pct(t.passRateWithout),
    signedPct(t.uplift),
  ]);

  const widths = headers.map((h, col) =>
    Math.max(h.length, ...rows.map((r) => r[col]!.length)),
  );

  const renderRow = (cells: string[]) =>
    cells.map((c, i) => pad(c, widths[i]!)).join("  ");

  const lines: string[] = [];
  lines.push(renderRow(headers));
  lines.push(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) lines.push(renderRow(r));
  lines.push("");
  lines.push(
    `context file: ${report.context_file}   seeds: ${report.seeds}`,
  );
  lines.push(`aggregate uplift: ${signedPct(report.aggregateUplift)}`);

  return lines.join("\n");
}

/** Format a report as pretty-printed JSON. */
export function formatJson(report: BenchReport): string {
  return JSON.stringify(report, null, 2);
}
