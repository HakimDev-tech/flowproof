import { describe, expect, it } from "vitest";
import { RevalidationResultSchema } from "../../src/ai/schemas/revalidation.schema.js";

describe("RevalidationResultSchema", () => {
  it("rejects incoherent diagnostic counts", () => {
    const result = {
      status: "valid",
      timestamp: new Date().toISOString(),
      originalFingerprint: "a".repeat(64),
      resultingFingerprint: "b".repeat(64),
      initialDiagnostics: [],
      finalDiagnostics: [],
      resolvedDiagnostics: [],
      unresolvedDiagnostics: [],
      newDiagnostics: [],
      counts: { initial: 1, final: 0, resolved: 0, unresolved: 0, newlyIntroduced: 0 },
    };
    expect(RevalidationResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects valid status when final diagnostics remain", () => {
    const diagnostic = { code: "X", severity: "warning", message: "Still present" };
    const result = {
      status: "valid",
      timestamp: new Date().toISOString(),
      originalFingerprint: "a".repeat(64),
      resultingFingerprint: "b".repeat(64),
      initialDiagnostics: [diagnostic],
      finalDiagnostics: [diagnostic],
      resolvedDiagnostics: [],
      unresolvedDiagnostics: [diagnostic],
      newDiagnostics: [],
      counts: { initial: 1, final: 1, resolved: 0, unresolved: 1, newlyIntroduced: 0 },
    };
    expect(RevalidationResultSchema.safeParse(result).success).toBe(false);
  });
});
