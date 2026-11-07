
import { describe, expect, it } from "vitest";

import { validateCorrectionOperation } from "../../src/ai/validate-correction-operation.js";

const baseProposal = {
  diagnosticCode: "MISSING_WORKFLOW_NAME",
  title: "Add workflow name",
  description: "The workflow has no name.",
  proposedChange: "Add a name property to the workflow.",
  confidence: "high" as const,
  risk: "low" as const,
  requiresHumanApproval: true as const,
};

describe("validateCorrectionOperation", () => {
  it("accepts adding a missing object property", () => {
    const result = validateCorrectionOperation(
      {},
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/name",
          value: "FlowProof",
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(true);
  });

  it("rejects adding an existing object property", () => {
    const result = validateCorrectionOperation(
      { name: "Existing workflow" },
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/name",
          value: "FlowProof",
        },
      },
    );

    expect(result.valid).toBe(false);
    expect(result.applicable).toBe(false);
  });

  it("accepts replacing an existing object property", () => {
    const result = validateCorrectionOperation(
      { name: "Old name" },
      {
        ...baseProposal,
        operation: "replace",
        change: {
          path: "/name",
          value: "FlowProof",
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(true);
  });

  it("rejects replacing a missing object property", () => {
    const result = validateCorrectionOperation(
      {},
      {
        ...baseProposal,
        operation: "replace",
        change: {
          path: "/name",
          value: "FlowProof",
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("accepts removing an existing object property", () => {
    const result = validateCorrectionOperation(
      { name: "FlowProof" },
      {
        ...baseProposal,
        operation: "remove",
        change: {
          path: "/name",
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(true);
  });

  it("rejects removing a missing object property", () => {
    const result = validateCorrectionOperation(
      {},
      {
        ...baseProposal,
        operation: "remove",
        change: {
          path: "/name",
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects a path whose parent does not exist", () => {
    const result = validateCorrectionOperation(
      {},
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/settings/name",
          value: "FlowProof",
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("accepts adding an array element at the end", () => {
    const result = validateCorrectionOperation(
      { nodes: ["first"] },
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/nodes/1",
          value: "second",
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(true);
  });

  it("accepts appending an array element with the '-' token", () => {
    const result = validateCorrectionOperation(
      { nodes: ["first"] },
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/nodes/-",
          value: "second",
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(true);
  });

  it("rejects an array index greater than its length", () => {
    const result = validateCorrectionOperation(
      { nodes: ["first"] },
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/nodes/3",
          value: "fourth",
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects forbidden prototype-related paths", () => {
    const result = validateCorrectionOperation(
      {},
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/__proto__/polluted",
          value: true,
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects a non-object workflow root", () => {
    const result = validateCorrectionOperation(
      ["not", "an", "object"],
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/name",
          value: "FlowProof",
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("accepts a manual proposal but marks it as not applicable", () => {
    const result = validateCorrectionOperation(
      {},
      {
        ...baseProposal,
        operation: "manual",
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(false);
    expect(result.operation).toBe("manual");
  });

  it("rejects a schema-invalid proposal", () => {
    const result = validateCorrectionOperation(
      {},
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "name",
          value: "FlowProof",
        },
      },
    );

    expect(result.valid).toBe(false);
    expect(result.applicable).toBe(false);
  });

  it("accepts replacing an existing array element", () => {
    const result = validateCorrectionOperation(
      { nodes: ["old", "second"] },
      {
        ...baseProposal,
        operation: "replace",
        change: {
          path: "/nodes/0",
          value: "new",
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(true);
  });

  it("accepts removing an existing array element", () => {
    const result = validateCorrectionOperation(
      { nodes: ["first", "second"] },
      {
        ...baseProposal,
        operation: "remove",
        change: {
          path: "/nodes/0",
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(true);
  });

  it("rejects replacing an array element at the array length", () => {
    const result = validateCorrectionOperation(
      { nodes: ["first"] },
      {
        ...baseProposal,
        operation: "replace",
        change: {
          path: "/nodes/1",
          value: "second",
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects array indexes with leading zeros", () => {
    const result = validateCorrectionOperation(
      { nodes: ["first"] },
      {
        ...baseProposal,
        operation: "replace",
        change: {
          path: "/nodes/00",
          value: "new",
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("supports escaped slashes in property names", () => {
    const result = validateCorrectionOperation(
      {
        settings: {
          "execution/order": "old",
        },
      },
      {
        ...baseProposal,
        operation: "replace",
        change: {
          path: "/settings/execution~1order",
          value: "new",
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(true);
  });

  it("supports escaped tildes in property names", () => {
    const result = validateCorrectionOperation(
      {
        settings: {
          "execution~order": "old",
        },
      },
      {
        ...baseProposal,
        operation: "replace",
        change: {
          path: "/settings/execution~0order",
          value: "new",
        },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.applicable).toBe(true);
  });

  it("rejects traversal through a primitive value", () => {
    const result = validateCorrectionOperation(
      {
        settings: "not-an-object",
      },
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/settings/name",
          value: "FlowProof",
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects accessor properties in the target path", () => {
    const settings = {};

    Object.defineProperty(settings, "name", {
      get() {
        return "FlowProof";
      },
      enumerable: true,
      configurable: true,
    });

    const result = validateCorrectionOperation(
      { settings },
      {
        ...baseProposal,
        operation: "replace",
        change: {
          path: "/settings/name",
          value: "New name",
        },
      },
    );

    expect(result.valid).toBe(false);
  });

  it("rejects constructor-related path segments", () => {
    const result = validateCorrectionOperation(
      {},
      {
        ...baseProposal,
        operation: "add",
        change: {
          path: "/constructor/prototype",
          value: {},
        },
      },
    );

    expect(result.valid).toBe(false);
  });
});
