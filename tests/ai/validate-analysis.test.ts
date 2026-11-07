
import { describe, expect, it } from "vitest";

import { AnalysisResultSchema } from "../../src/ai/schemas/analysis.schema.js";
import {
  AnalysisConsistencyError,
  validateAnalysisReferences,
} from "../../src/ai/validate-analysis.js";

function createResult(
  findings: Array<{ diagnosticCode: string }>,
  unaddressedDiagnosticCodes: string[] = [],
) {
  return AnalysisResultSchema.parse({
    summary: "Analysis completed.",
    overallAssessment: "warning",
    findings: findings.map(({ diagnosticCode }) => ({
      diagnosticCode,
      explanation: "A technical issue was detected.",
      suggestedAction:
        "Inspect the corresponding workflow configuration.",
      confidence: "high",
    })),
    unaddressedDiagnosticCodes,
  });
}

describe("validateAnalysisReferences", () => {
  it("accepts a complete and valid classification", () => {
    const result = createResult(
      [{ diagnosticCode: "MISSING_WORKFLOW_NAME" }],
      ["INVALID_WORKFLOW_ROOT"],
    );

    expect(
      validateAnalysisReferences(
        ["MISSING_WORKFLOW_NAME", "INVALID_WORKFLOW_ROOT"],
        result,
      ),
    ).toEqual(result);
  });

  it("rejects an invented diagnostic code", () => {
    const result = createResult([
      { diagnosticCode: "INVENTED_CODE" },
    ]);

    expect(() =>
      validateAnalysisReferences(
        ["MISSING_WORKFLOW_NAME"],
        result,
      ),
    ).toThrow(AnalysisConsistencyError);
  });

  it("rejects an omitted diagnostic code", () => {
    const result = createResult([
      { diagnosticCode: "MISSING_WORKFLOW_NAME" },
    ]);

    expect(() =>
      validateAnalysisReferences(
        ["MISSING_WORKFLOW_NAME", "INVALID_WORKFLOW_ROOT"],
        result,
      ),
    ).toThrow("did not classify diagnostic code");
  });

  it("accepts repeated input codes when the distinct code is classified", () => {
    const result = createResult([
      { diagnosticCode: "MISSING_WORKFLOW_NAME" },
    ]);

    expect(
      validateAnalysisReferences(
        ["MISSING_WORKFLOW_NAME", "MISSING_WORKFLOW_NAME"],
        result,
      ),
    ).toEqual(result);
  });

  it("rejects a code classified twice", () => {
    const result = createResult(
      [{ diagnosticCode: "MISSING_WORKFLOW_NAME" }],
      ["MISSING_WORKFLOW_NAME"],
    );

    expect(() =>
      validateAnalysisReferences(
        ["MISSING_WORKFLOW_NAME"],
        result,
      ),
    ).toThrow("more than once");
  });
});
