import { describe, expect, it } from "vitest";
import { createWorkflowFingerprint } from "../../src/ai/workflow-fingerprint.js";
import { revalidateWorkflow } from "../../src/ai/revalidate-workflow.js";
import type { Diagnostic } from "../../src/graph/state.js";

const missingName: Diagnostic = {
  code: "MISSING_WORKFLOW_NAME",
  severity: "warning",
  message: "Workflow name is missing",
};

describe("revalidateWorkflow", () => {
  it("marks a corrected workflow valid and reports the initial diagnostic as resolved", () => {
    const workflow = { name: "Fixed workflow", nodes: [], connections: {} };
    const result = revalidateWorkflow(workflow, [missingName], createWorkflowFingerprint({ name: "", nodes: [], connections: {} }));
    expect(result.status).toBe("valid");
    expect(result.resolvedDiagnostics).toEqual([missingName]);
    expect(result.unresolvedDiagnostics).toEqual([]);
    expect(result.counts).toEqual({ initial: 1, final: 0, resolved: 1, unresolved: 0, newlyIntroduced: 0 });
  });

  it("keeps persistent diagnostics and identifies newly introduced diagnostics", () => {
    const workflow = { name: "", nodes: [], connections: {} };
    const initial = [{ ...missingName, path: "/name" }];
    const result = revalidateWorkflow(workflow, initial, createWorkflowFingerprint(workflow));
    expect(result.status).toBe("invalid");
    expect(result.unresolvedDiagnostics).toEqual(initial);
    expect(result.newDiagnostics).toEqual([]);
  });

  it("returns error rather than valid when the workflow cannot be fingerprinted", () => {
    const workflow = { name: "bad", value: Number.NaN };
    const result = revalidateWorkflow(workflow, [], "a".repeat(64));
    expect(result.status).toBe("error");
    expect(result.error).toBeTruthy();
  });

  it("does not mutate the supplied workflow", () => {
    const workflow = { name: "Stable", nodes: [] };
    const before = JSON.stringify(workflow);
    revalidateWorkflow(workflow, [], createWorkflowFingerprint(workflow));
    expect(JSON.stringify(workflow)).toBe(before);
  });
});
