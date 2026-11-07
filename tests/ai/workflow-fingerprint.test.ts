
import { describe, expect, it } from "vitest";

import {
  createWorkflowFingerprint,
  WorkflowFingerprintError,
} from "../../src/ai/workflow-fingerprint.js";

describe("createWorkflowFingerprint", () => {
  it("returns a SHA-256 hexadecimal fingerprint", () => {
    const fingerprint = createWorkflowFingerprint({
      name: "FlowProof",
    });

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces the same fingerprint for equivalent objects", () => {
    const first = {
      name: "FlowProof",
      settings: {
        executionOrder: "v1",
        saveData: true,
      },
    };

    const second = {
      settings: {
        saveData: true,
        executionOrder: "v1",
      },
      name: "FlowProof",
    };

    expect(createWorkflowFingerprint(first)).toBe(
      createWorkflowFingerprint(second),
    );
  });

  it("produces different fingerprints when a value changes", () => {
    const first = {
      name: "FlowProof",
    };

    const second = {
      name: "Other workflow",
    };

    expect(createWorkflowFingerprint(first)).not.toBe(
      createWorkflowFingerprint(second),
    );
  });

  it("preserves array order", () => {
    const first = {
      nodes: ["A", "B"],
    };

    const second = {
      nodes: ["B", "A"],
    };

    expect(createWorkflowFingerprint(first)).not.toBe(
      createWorkflowFingerprint(second),
    );
  });

  it("sorts nested object keys", () => {
    const first = {
      settings: {
        z: 1,
        a: {
          y: 2,
          b: 3,
        },
      },
    };

    const second = {
      settings: {
        a: {
          b: 3,
          y: 2,
        },
        z: 1,
      },
    };

    expect(createWorkflowFingerprint(first)).toBe(
      createWorkflowFingerprint(second),
    );
  });

  it("does not mutate the original workflow", () => {
    const workflow = {
      name: "FlowProof",
      nodes: [
        {
          name: "Node A",
        },
      ],
    };

    const original = structuredClone(workflow);

    createWorkflowFingerprint(workflow);

    expect(workflow).toEqual(original);
  });

  it("rejects a non-object workflow root", () => {
    expect(() =>
      createWorkflowFingerprint(["not", "an", "object"]),
    ).toThrow(WorkflowFingerprintError);
  });

  it("rejects non-finite numbers", () => {
    expect(() =>
      createWorkflowFingerprint({
        settings: {
          timeout: Number.POSITIVE_INFINITY,
        },
      }),
    ).toThrow(WorkflowFingerprintError);
  });

  it("rejects circular references", () => {
    const workflow: Record<string, unknown> = {
      name: "FlowProof",
    };

    workflow.self = workflow;

    expect(() =>
      createWorkflowFingerprint(workflow),
    ).toThrow(WorkflowFingerprintError);
  });

  it("rejects accessor properties", () => {
    const settings = {};

    Object.defineProperty(settings, "name", {
      get() {
        return "FlowProof";
      },
      enumerable: true,
      configurable: true,
    });

    expect(() =>
      createWorkflowFingerprint({
        settings,
      }),
    ).toThrow(WorkflowFingerprintError);
  });

  it("rejects sparse arrays", () => {
    const nodes = new Array(2);
    nodes[0] = "Node A";

    expect(() =>
      createWorkflowFingerprint({
        nodes,
      }),
    ).toThrow(WorkflowFingerprintError);
  });

  it("rejects undefined values", () => {
    expect(() =>
      createWorkflowFingerprint({
        name: undefined,
      }),
    ).toThrow(WorkflowFingerprintError);
  });

  it("supports JSON objects with an own __proto__ property", () => {
    const workflow = JSON.parse(
      '{"name":"FlowProof","__proto__":{"polluted":true}}',
    );

    expect(() =>
      createWorkflowFingerprint(workflow),
    ).not.toThrow();

    expect(
      Object.prototype.hasOwnProperty.call(
        Object.prototype,
        "polluted",
      ),
    ).toBe(false);
  });

  it("rejects arrays with non-index numeric properties", () => {
    const nodes = ["Node A"];

    Object.defineProperty(nodes, "4294967295", {
      value: "unexpected",
      enumerable: true,
      configurable: true,
    });

    expect(() =>
      createWorkflowFingerprint({ nodes }),
    ).toThrow(WorkflowFingerprintError);
  });

  it("rejects arrays with a custom prototype", () => {
    const nodes = ["Node A"];

    Object.setPrototypeOf(nodes, {
      custom: true,
    });

    expect(() =>
      createWorkflowFingerprint({ nodes }),
    ).toThrow(WorkflowFingerprintError);
  });
});
