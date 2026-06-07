// Render a BenchReport as a human-readable table or as JSON.

import type { BenchReport, UpliftStatistics } from "./types.ts";

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function signedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(0)}%`;
}

function formatPValue(value: number): string {
  if (value < 0.001) return "<0.001";
  return value.toFixed(3);
}

function formatSignal(label: UpliftStatistics["significanceLabel"]): string {
  if (label === "low_confidence") return "low-confidence";
  if (label === "not_significant") return "not significant";
  return "significant";
}

function formatCi(stats: UpliftStatistics): string {
  return `[${signedPct(stats.confidenceInterval.low)}, ${signedPct(
    stats.confidenceInterval.high,
  )}]`;
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
  const headers = ["TASK", "WITH", "WITHOUT", "UPLIFT", "95% CI", "P", "SIGNAL"];
  const rows = report.tasks.map((t) => [
    t.id,
    pct(t.passRateWith),
    pct(t.passRateWithout),
    signedPct(t.uplift),
    formatCi(t.statistics),
    formatPValue(t.statistics.pValue),
    formatSignal(t.statistics.significanceLabel),
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
  lines.push(`aggregate CI: ${formatCi(report.aggregateStatistics)}`);
  lines.push(`aggregate p-value: ${formatPValue(report.aggregateStatistics.pValue)}`);
  lines.push(
    `aggregate signal: ${formatSignal(
      report.aggregateStatistics.significanceLabel,
    )}`,
  );

  return lines.join("\n");
}

/** Format a report as pretty-printed JSON. */
export function formatJson(report: BenchReport): string {
  return JSON.stringify(report, null, 2);
}
