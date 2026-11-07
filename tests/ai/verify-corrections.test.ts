import { describe, expect, it } from "vitest";
import { revalidateWorkflow } from "../../src/ai/revalidate-workflow.js";
import { verifyCorrections } from "../../src/ai/verify-corrections.js";
import { createWorkflowFingerprint } from "../../src/ai/workflow-fingerprint.js";

describe("verifyCorrections", () => {
  it("marks an applied diagnostic as resolved when it no longer exists", () => {
    const initial = [{ code: "MISSING_WORKFLOW_NAME", severity: "warning" as const, message: "Missing name" }];
    const workflow = { name: "Now named" };
    const result = revalidateWorkflow(workflow, initial, createWorkflowFingerprint({}));
    expect(verifyCorrections(["MISSING_WORKFLOW_NAME"], initial, result)).toEqual([
      { diagnosticCode: "MISSING_WORKFLOW_NAME", outcome: "resolved" },
    ]);
  });

  it("reports persistent diagnostics independent of diagnostic ordering", () => {
    const initial = [
      { code: "MISSING_WORKFLOW_NAME", severity: "warning" as const, message: "Missing name" },
    ];
    const result = revalidateWorkflow({}, initial, createWorkflowFingerprint({}));
    expect(verifyCorrections(["MISSING_WORKFLOW_NAME"], initial, result)).toEqual([
      { diagnosticCode: "MISSING_WORKFLOW_NAME", outcome: "persistent" },
    ]);
  });

  it("marks codes absent from the initial diagnostics as not_found", () => {
    const result = revalidateWorkflow({ name: "ok" }, [], createWorkflowFingerprint({}));
    expect(verifyCorrections(["UNKNOWN"], [], result)).toEqual([
      { diagnosticCode: "UNKNOWN", outcome: "not_found" },
    ]);
  });
});
