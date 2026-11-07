import type { Diagnostic } from "../graph/state.js";
import type { RevalidationResult } from "./schemas/revalidation.schema.js";

export type CorrectionVerification = {
  diagnosticCode: string;
  outcome: "resolved" | "persistent" | "not_found" | "revalidation_error";
};

export function verifyCorrections(
  appliedDiagnosticCodes: string[],
  initialDiagnostics: Diagnostic[],
  result: RevalidationResult,
): CorrectionVerification[] {
  return appliedDiagnosticCodes.map((diagnosticCode) => {
    if (result.status === "error") {
      return { diagnosticCode, outcome: "revalidation_error" };
    }
    const existedInitially = initialDiagnostics.some(d => d.code === diagnosticCode);
    if (!existedInitially) return { diagnosticCode, outcome: "not_found" };
    const remains = result.finalDiagnostics.some(d => d.code === diagnosticCode);
    return { diagnosticCode, outcome: remains ? "persistent" : "resolved" };
  });
}
