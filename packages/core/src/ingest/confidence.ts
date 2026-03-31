import type { ConfidenceReport, Recipe, ConfidenceLevel } from "../types.js";

export function buildConfidenceReport(
  fields: Partial<Record<keyof Recipe, ConfidenceLevel>>,
  usedLLMFallback: boolean,
): ConfidenceReport {
  const values = Object.values(fields);
  const resolved = values.filter((v) => v === "resolved").length;
  const overallConfidence = values.length > 0 ? resolved / values.length : 0;

  return { fields, overallConfidence, usedLLMFallback };
}
