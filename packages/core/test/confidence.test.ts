import { describe, it, expect } from "vitest";
import { buildConfidenceReport } from "../src/ingest/confidence.js";

describe("buildConfidenceReport", () => {
  it("calculates overall confidence from resolved fields", () => {
    const report = buildConfidenceReport(
      { title: "resolved", description: "resolved", tags: "missing" },
      false,
    );
    expect(report.overallConfidence).toBeCloseTo(2 / 3);
    expect(report.usedLLMFallback).toBe(false);
  });

  it("returns 0 confidence when no fields provided", () => {
    const report = buildConfidenceReport({}, false);
    expect(report.overallConfidence).toBe(0);
  });
});
