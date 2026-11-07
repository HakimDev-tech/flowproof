
import { describe, expect, it } from "vitest";

import {
  validateHumanApproval,
} from "../../src/ai/validate-human-approval.js";

const correctionResult = {
  summary: "Two correction proposals were generated.",
  proposals: [
    {
      diagnosticCode: "MISSING_WORKFLOW_NAME",
      title: "Add workflow name",
      description: "The workflow has no name.",
      proposedChange: "Add a name property.",
      operation: "add" as const,
      change: {
        path: "/name",
        value: "FlowProof",
      },
      confidence: "high" as const,
      risk: "low" as const,
      requiresHumanApproval: true as const,
    },
    {
      diagnosticCode: "MISSING_WORKFLOW_SETTINGS",
      title: "Add workflow settings",
      description: "Workflow settings are missing.",
      proposedChange: "Add a settings property.",
      operation: "add" as const,
      change: {
        path: "/settings",
        value: {},
      },
      confidence: "medium" as const,
      risk: "low" as const,
      requiresHumanApproval: true as const,
    },
  ],
  unaddressedDiagnosticCodes: [
    "UNSUPPORTED_WORKFLOW_FEATURE",
  ],
};

describe("validateHumanApproval", () => {
  it("accepts a complete set of human decisions", () => {
    const result = validateHumanApproval(
      correctionResult,
      {
        decisions: [
          {
            diagnosticCode: "MISSING_WORKFLOW_NAME",
            decision: "approved",
          },
          {
            diagnosticCode: "MISSING_WORKFLOW_SETTINGS",
            decision: "rejected",
            reason: "The settings must be configured manually.",
          },
        ],
      },
    );

    expect(result).toEqual({
      valid: true,
      corrections: correctionResult,
      approvedDiagnosticCodes: [
        "MISSING_WORKFLOW_NAME",
      ],
      rejectedDiagnosticCodes: [
        "MISSING_WORKFLOW_SETTINGS",
      ],
    });
  });

  it("rejects an approval with a missing decision", () => {
    const result = validateHumanApproval(
      correctionResult,
      {
        decisions: [
          {
            diagnosticCode: "MISSING_WORKFLOW_NAME",
            decision: "approved",
          },
        ],
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects duplicate decisions for the same proposal", () => {
    const result = validateHumanApproval(
      correctionResult,
      {
        decisions: [
          {
            diagnosticCode: "MISSING_WORKFLOW_NAME",
            decision: "approved",
          },
          {
            diagnosticCode: "MISSING_WORKFLOW_NAME",
            decision: "rejected",
          },
          {
            diagnosticCode: "MISSING_WORKFLOW_SETTINGS",
            decision: "approved",
          },
        ],
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects decisions referencing unknown proposals", () => {
    const result = validateHumanApproval(
      correctionResult,
      {
        decisions: [
          {
            diagnosticCode: "UNKNOWN_DIAGNOSTIC",
            decision: "approved",
          },
          {
            diagnosticCode: "MISSING_WORKFLOW_NAME",
            decision: "approved",
          },
          {
            diagnosticCode: "MISSING_WORKFLOW_SETTINGS",
            decision: "approved",
          },
        ],
      },
    );

    expect(result.valid).toBe(false);
  });

  it("does not require a decision for unaddressed diagnostics", () => {
    const result = validateHumanApproval(
      correctionResult,
      {
        decisions: [
          {
            diagnosticCode: "MISSING_WORKFLOW_NAME",
            decision: "approved",
          },
          {
            diagnosticCode: "MISSING_WORKFLOW_SETTINGS",
            decision: "approved",
          },
        ],
      },
    );

    expect(result.valid).toBe(true);
  });

  it("rejects an invalid correction result", () => {
    const result = validateHumanApproval(
      {
        summary: "",
        proposals: [],
        unaddressedDiagnosticCodes: [],
      },
      {
        decisions: [],
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects an invalid human approval object", () => {
    const result = validateHumanApproval(
      correctionResult,
      {
        decisions: "approved",
      },
    );

    expect(result.valid).toBe(false);
  });

  it("accepts an empty approval when there are no proposals", () => {
    const emptyCorrectionResult = {
      summary: "No correction proposals.",
      proposals: [],
      unaddressedDiagnosticCodes: [
        "UNSUPPORTED_WORKFLOW_FEATURE",
      ],
    };

    const result = validateHumanApproval(
      emptyCorrectionResult,
      {
        decisions: [],
      },
    );

    expect(result).toEqual({
      valid: true,
      corrections: emptyCorrectionResult,
      approvedDiagnosticCodes: [],
      rejectedDiagnosticCodes: [],
    });
  });

  it("rejects duplicate diagnostic codes in proposals", () => {
    const result = validateHumanApproval(
      {
        ...correctionResult,
        proposals: [
          correctionResult.proposals[0],
          {
            ...correctionResult.proposals[1],
            diagnosticCode: "MISSING_WORKFLOW_NAME",
          },
        ],
      },
      {
        decisions: [
          {
            diagnosticCode: "MISSING_WORKFLOW_NAME",
            decision: "approved",
          },
        ],
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects duplicate unaddressed diagnostic codes", () => {
    const result = validateHumanApproval(
      {
        ...correctionResult,
        unaddressedDiagnosticCodes: [
          "UNSUPPORTED_WORKFLOW_FEATURE",
          "UNSUPPORTED_WORKFLOW_FEATURE",
        ],
      },
      {
        decisions: [
          {
            diagnosticCode: "MISSING_WORKFLOW_NAME",
            decision: "approved",
          },
          {
            diagnosticCode: "MISSING_WORKFLOW_SETTINGS",
            decision: "approved",
          },
        ],
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects a diagnostic classified as both proposed and unaddressed", () => {
    const result = validateHumanApproval(
      {
        ...correctionResult,
        unaddressedDiagnosticCodes: [
          "MISSING_WORKFLOW_NAME",
        ],
      },
      {
        decisions: [
          {
            diagnosticCode: "MISSING_WORKFLOW_NAME",
            decision: "approved",
          },
          {
            diagnosticCode: "MISSING_WORKFLOW_SETTINGS",
            decision: "approved",
          },
        ],
      },
    );

    expect(result.valid).toBe(false);
  });
});
