
import { describe, expect, it } from "vitest";

import {
  CorrectionConsistencyError,
  validateCorrectionReferences,
} from "../../src/ai/validate-corrections.js";

import type { CorrectionResult } from "../../src/ai/schemas/correction.schema.js";

function createResult(
  diagnosticCodes: string[],
): CorrectionResult {
  return {
    summary: "Correction proposals generated.",
    proposals: diagnosticCodes.map((diagnosticCode) => ({
      diagnosticCode,
      title: "Review workflow configuration",
      description: "The workflow contains a configuration issue.",
      proposedChange: "Review and correct the configuration manually.",
      operation: "manual",
      confidence: "high",
      risk: "low",
      requiresHumanApproval: true,
    })),
    unaddressedDiagnosticCodes: [],
  };
}

describe("validateCorrectionReferences", () => {
  it("accepts a valid correction result", () => {
    const result = createResult(["MISSING_WORKFLOW_NAME"]);

    expect(
      validateCorrectionReferences(
        ["MISSING_WORKFLOW_NAME"],
        result,
      ),
    ).toEqual(result);
  });

  it("rejects an unknown diagnostic code", () => {
    const result = createResult(["UNKNOWN_DIAGNOSTIC"]);

    expect(() =>
      validateCorrectionReferences(
        ["MISSING_WORKFLOW_NAME"],
        result,
      ),
    ).toThrow(CorrectionConsistencyError);

    expect(() =>
      validateCorrectionReferences(
        ["MISSING_WORKFLOW_NAME"],
        result,
      ),
    ).toThrow(
      "Unknown diagnostic code returned: UNKNOWN_DIAGNOSTIC",
    );
  });

  it("rejects an omitted diagnostic code", () => {
    const result = createResult([]);

    expect(() =>
      validateCorrectionReferences(
        ["MISSING_WORKFLOW_NAME"],
        result,
      ),
    ).toThrow(
      "Diagnostic code was not classified: MISSING_WORKFLOW_NAME",
    );
  });

  it("rejects duplicate diagnostic classifications", () => {
    const result = createResult([
      "MISSING_WORKFLOW_NAME",
      "MISSING_WORKFLOW_NAME",
    ]);

    expect(() =>
      validateCorrectionReferences(
        ["MISSING_WORKFLOW_NAME"],
        result,
      ),
    ).toThrow(
      "A diagnostic code was classified more than once.",
    );
  });

  it("accepts repeated input codes when the distinct code is classified once", () => {
    const result = createResult(["MISSING_WORKFLOW_NAME"]);

    expect(
      validateCorrectionReferences(
        [
          "MISSING_WORKFLOW_NAME",
          "MISSING_WORKFLOW_NAME",
        ],
        result,
      ),
    ).toEqual(result);
  });

  it("rejects a correction that does not require human approval", () => {
    const result = createResult(["MISSING_WORKFLOW_NAME"]);

    const unsafeResult = {
      ...result,
      proposals: result.proposals.map((proposal) => ({
        ...proposal,
        requiresHumanApproval: false,
      })),
    } as unknown as CorrectionResult;

    expect(() =>
      validateCorrectionReferences(
        ["MISSING_WORKFLOW_NAME"],
        unsafeResult,
      ),
    ).toThrow(
      "Correction for MISSING_WORKFLOW_NAME does not require human approval.",
    );
  });

  it("accepts a diagnostic classified as unaddressed", () => {
    const result: CorrectionResult = {
      summary: "Some corrections require manual investigation.",
      proposals: [],
      unaddressedDiagnosticCodes: [
        "MISSING_WORKFLOW_NAME",
      ],
    };

    expect(
      validateCorrectionReferences(
        ["MISSING_WORKFLOW_NAME"],
        result,
      ),
    ).toEqual(result);
  });
});
