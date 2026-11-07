
import { describe, expect, it } from "vitest";
import { AnalysisResultSchema } from "../../src/ai/schemas/analysis.schema.js";

describe("AnalysisResultSchema", () => {
  it("accepts a valid analysis", () => {
    const result = {
      summary: "The workflow contains one warning.",
      overallAssessment: "warning",
      findings: [
        {
          diagnosticCode: "MISSING_WORKFLOW_NAME",
          explanation: "The workflow has no name.",
          suggestedAction: "Add a descriptive workflow name.",
          confidence: "high",
        },
      ],
      unaddressedDiagnosticCodes: [],
    };

    expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects an unsupported assessment", () => {
    const result = {
      summary: "Analysis completed.",
      overallAssessment: "unknown",
      findings: [],
      unaddressedDiagnosticCodes: [],
    };

    expect(AnalysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects a finding without a diagnostic code", () => {
    const result = {
      summary: "Analysis completed.",
      overallAssessment: "warning",
      findings: [
        {
          explanation: "Something may be wrong.",
          suggestedAction: "Investigate the issue.",
          confidence: "medium",
        },
      ],
      unaddressedDiagnosticCodes: [],
    };

    expect(AnalysisResultSchema.safeParse(result).success).toBe(false);
  });
});
