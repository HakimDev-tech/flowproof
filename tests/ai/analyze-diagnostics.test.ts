import { describe, expect, it } from "vitest";
import { analyzeDiagnostics } from "../../src/ai/analyze-diagnostics.js";

describe("analyzeDiagnostics", () => {
  it("returns a deterministic result when there are no diagnostics", async () => {
    const result = await analyzeDiagnostics({
      workflowName: "Clean Workflow",
      diagnostics: [],
    });

    expect(result).toEqual({
      summary: "No diagnostics were produced by the deterministic validators.",
      overallAssessment: "healthy",
      findings: [],
      unaddressedDiagnosticCodes: [],
    });
  });

  it("rejects an empty workflow name", async () => {
    await expect(
      analyzeDiagnostics({
        workflowName: "   ",
        diagnostics: [],
      }),
    ).rejects.toThrow("Workflow name cannot be empty.");
  });
});