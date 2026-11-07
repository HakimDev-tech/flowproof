import type { Diagnostic } from "../graph/state.js";
import { applyCorrections, type ApplyCorrectionsResult } from "./apply-corrections.js";
import type { GeneratedCorrectionSet } from "./generate-corrections.js";
import { revalidateWorkflow } from "./revalidate-workflow.js";
import { verifyCorrections } from "./verify-corrections.js";
import { RevalidationResultSchema, type RevalidationResult } from "./schemas/revalidation.schema.js";

export type ApplyAndRevalidateResult = ApplyCorrectionsResult & {
  revalidation: RevalidationResult;
  correctionVerification: ReturnType<typeof verifyCorrections>;
};

/**
 * Applies only human-approved structured operations, then runs the same
 * deterministic validator used by the LangGraph validation node.
 * A revalidation error never marks the workflow as valid.
 */
export function applyAndRevalidateCorrections(
  workflow: unknown,
  generated: GeneratedCorrectionSet,
  rawApproval: unknown,
  initialDiagnostics: Diagnostic[],
): ApplyAndRevalidateResult {
  const applied = applyCorrections(workflow, generated, rawApproval);
  const revalidation = RevalidationResultSchema.parse(
    revalidateWorkflow(applied.workflow, initialDiagnostics, applied.originalFingerprint),
  );
  return {
    ...applied,
    revalidation,
    correctionVerification: verifyCorrections(
      applied.appliedDiagnosticCodes,
      initialDiagnostics,
      revalidation,
    ),
    auditEntry: {
      ...applied.auditEntry,
      revalidation,
    } as ApplyCorrectionsResult["auditEntry"],
  };
}
