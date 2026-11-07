
import { describe, expect, it } from "vitest";

import {
  HumanApprovalSchema,
  HumanDecisionSchema,
} from "../../src/ai/schemas/approval.schema.js";

describe("HumanDecisionSchema", () => {
  it("accepts an approved decision", () => {
    const result = HumanDecisionSchema.safeParse({
      diagnosticCode: "MISSING_WORKFLOW_NAME",
      decision: "approved",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a rejected decision with a reason", () => {
    const result = HumanDecisionSchema.safeParse({
      diagnosticCode: "MISSING_WORKFLOW_NAME",
      decision: "rejected",
      reason: "The proposed name is not appropriate.",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a decision without a reason", () => {
    const result = HumanDecisionSchema.safeParse({
      diagnosticCode: "MISSING_WORKFLOW_NAME",
      decision: "approved",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty diagnostic code", () => {
    const result = HumanDecisionSchema.safeParse({
      diagnosticCode: "",
      decision: "approved",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported decision", () => {
    const result = HumanDecisionSchema.safeParse({
      diagnosticCode: "MISSING_WORKFLOW_NAME",
      decision: "maybe",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty reason", () => {
    const result = HumanDecisionSchema.safeParse({
      diagnosticCode: "MISSING_WORKFLOW_NAME",
      decision: "rejected",
      reason: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unexpected properties", () => {
    const result = HumanDecisionSchema.safeParse({
      diagnosticCode: "MISSING_WORKFLOW_NAME",
      decision: "approved",
      applied: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("HumanApprovalSchema", () => {
  it("accepts a complete approval object", () => {
    const result = HumanApprovalSchema.safeParse({
      decisions: [
        {
          diagnosticCode: "MISSING_WORKFLOW_NAME",
          decision: "approved",
        },
        {
          diagnosticCode: "INVALID_WORKFLOW_ROOT",
          decision: "rejected",
          reason: "The correction is unsafe.",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts an empty decisions array", () => {
    const result = HumanApprovalSchema.safeParse({
      decisions: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid decision inside the array", () => {
    const result = HumanApprovalSchema.safeParse({
      decisions: [
        {
          diagnosticCode: "MISSING_WORKFLOW_NAME",
          decision: "pending",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unexpected top-level properties", () => {
    const result = HumanApprovalSchema.safeParse({
      decisions: [],
      approved: true,
    });

    expect(result.success).toBe(false);
  });
});
