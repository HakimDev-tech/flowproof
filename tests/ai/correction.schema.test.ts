
import { describe, expect, it } from "vitest";

import {
  CorrectionProposalSchema,
  CorrectionResultSchema,
  JsonPointerSchema,
} from "../../src/ai/schemas/correction.schema.js";

const baseProposal = {
  diagnosticCode: "MISSING_WORKFLOW_NAME",
  title: "Add missing workflow name",
  description: "The workflow has no name.",
  proposedChange: "Add the name property.",
  confidence: "high" as const,
  risk: "low" as const,
  requiresHumanApproval: true as const,
};

describe("JsonPointerSchema", () => {
  it("accepts valid JSON Pointer paths", () => {
    expect(JsonPointerSchema.safeParse("/name").success).toBe(true);
    expect(
      JsonPointerSchema.safeParse("/nodes/0/name").success,
    ).toBe(true);
    expect(
      JsonPointerSchema.safeParse("/settings/executionOrder").success,
    ).toBe(true);
  });

  it("accepts correctly escaped JSON Pointer segments", () => {
    expect(
      JsonPointerSchema.safeParse("/settings/a~1b").success,
    ).toBe(true);
    expect(
      JsonPointerSchema.safeParse("/settings/a~0b").success,
    ).toBe(true);
  });

  it("rejects empty paths and paths without a leading slash", () => {
    expect(JsonPointerSchema.safeParse("").success).toBe(false);
    expect(JsonPointerSchema.safeParse("name").success).toBe(false);
  });

  it("rejects invalid JSON Pointer escape sequences", () => {
    expect(
      JsonPointerSchema.safeParse("/settings/a~2b").success,
    ).toBe(false);
    expect(
      JsonPointerSchema.safeParse("/settings/a~").success,
    ).toBe(false);
  });
});

describe("CorrectionProposalSchema", () => {
  it("accepts a valid add proposal", () => {
    const proposal = {
      ...baseProposal,
      operation: "add",
      change: {
        path: "/name",
        value: "FlowProof",
      },
    };

    expect(CorrectionProposalSchema.safeParse(proposal).success).toBe(
      true,
    );
  });

  it("accepts a valid replace proposal", () => {
    const proposal = {
      ...baseProposal,
      operation: "replace",
      change: {
        path: "/settings/executionOrder",
        value: "v1",
      },
    };

    expect(CorrectionProposalSchema.safeParse(proposal).success).toBe(
      true,
    );
  });

  it("accepts a valid remove proposal", () => {
    const proposal = {
      ...baseProposal,
      operation: "remove",
      change: {
        path: "/settings/unsupportedProperty",
      },
    };

    expect(CorrectionProposalSchema.safeParse(proposal).success).toBe(
      true,
    );
  });

  it("accepts a manual proposal without a change object", () => {
    const proposal = {
      ...baseProposal,
      operation: "manual",
    };

    expect(CorrectionProposalSchema.safeParse(proposal).success).toBe(
      true,
    );
  });

  it("rejects an automatic operation without change", () => {
    const proposal = {
      ...baseProposal,
      operation: "add",
    };

    expect(CorrectionProposalSchema.safeParse(proposal).success).toBe(
      false,
    );
  });

  it("rejects a manual proposal containing change", () => {
    const proposal = {
      ...baseProposal,
      operation: "manual",
      change: {
        path: "/name",
        value: "FlowProof",
      },
    };

    expect(CorrectionProposalSchema.safeParse(proposal).success).toBe(
      false,
    );
  });

  it("rejects unexpected properties in change", () => {
    const proposal = {
      ...baseProposal,
      operation: "add",
      change: {
        path: "/name",
        value: "FlowProof",
        executableCode: "unexpected",
      },
    };

    expect(CorrectionProposalSchema.safeParse(proposal).success).toBe(
      false,
    );
  });

  it("rejects an add proposal with an invalid path", () => {
    const proposal = {
      ...baseProposal,
      operation: "add",
      change: {
        path: "name",
        value: "FlowProof",
      },
    };

    expect(CorrectionProposalSchema.safeParse(proposal).success).toBe(
      false,
    );
  });

  it("rejects a remove proposal containing a value", () => {
    const proposal = {
      ...baseProposal,
      operation: "remove",
      change: {
        path: "/name",
        value: "FlowProof",
      },
    };

    expect(CorrectionProposalSchema.safeParse(proposal).success).toBe(
      false,
    );
  });
});

describe("CorrectionResultSchema", () => {
  it("accepts a complete structured correction result", () => {
    const result = {
      summary: "One correction is proposed.",
      proposals: [
        {
          ...baseProposal,
          operation: "add",
          change: {
            path: "/name",
            value: "FlowProof",
          },
        },
      ],
      unaddressedDiagnosticCodes: [],
    };

    expect(CorrectionResultSchema.safeParse(result).success).toBe(
      true,
    );
  });
});
