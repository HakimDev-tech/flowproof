import { validateWorkflow } from "../graph/validate-workflow.js";
import type { Diagnostic } from "../graph/state.js";
import { createWorkflowFingerprint } from "./workflow-fingerprint.js";
import { RevalidationResultSchema, type RevalidationResult } from "./schemas/revalidation.schema.js";

function diagnosticKey(diagnostic: Diagnostic): string {
  return JSON.stringify([diagnostic.code, diagnostic.severity, diagnostic.path ?? null]);
}

function compareDiagnostics(initial: Diagnostic[], final: Diagnostic[]) {
  const remaining = new Map<string, number>();
  for (const diagnostic of final) {
    const key = diagnosticKey(diagnostic);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  const resolved: Diagnostic[] = [];
  const unresolved: Diagnostic[] = [];
  for (const diagnostic of initial) {
    const key = diagnosticKey(diagnostic);
    const count = remaining.get(key) ?? 0;
    if (count > 0) {
      unresolved.push(diagnostic);
      remaining.set(key, count - 1);
    } else {
      resolved.push(diagnostic);
    }
  }

  const newDiagnostics: Diagnostic[] = [];
  const initialCounts = new Map<string, number>();
  for (const diagnostic of initial) {
    const key = diagnosticKey(diagnostic);
    initialCounts.set(key, (initialCounts.get(key) ?? 0) + 1);
  }
  for (const diagnostic of final) {
    const key = diagnosticKey(diagnostic);
    const count = initialCounts.get(key) ?? 0;
    if (count > 0) initialCounts.set(key, count - 1);
    else newDiagnostics.push(diagnostic);
  }
  return { resolved, unresolved, newDiagnostics };
}

export function revalidateWorkflow(
  workflow: unknown,
  initialDiagnostics: Diagnostic[],
  originalFingerprint: string,
): RevalidationResult {
  const timestamp = new Date().toISOString();
  let resultingFingerprint = originalFingerprint;

  try {
    resultingFingerprint = createWorkflowFingerprint(workflow);
    const finalDiagnostics = validateWorkflow(workflow);
    const comparison = compareDiagnostics(initialDiagnostics, finalDiagnostics);
    const status = finalDiagnostics.length === 0 ? "valid" : "invalid";
    return RevalidationResultSchema.parse({
      status,
      timestamp,
      originalFingerprint,
      resultingFingerprint,
      initialDiagnostics,
      finalDiagnostics,
      ...{
        resolvedDiagnostics: comparison.resolved,
        unresolvedDiagnostics: comparison.unresolved,
        newDiagnostics: comparison.newDiagnostics,
      },
      counts: {
        initial: initialDiagnostics.length,
        final: finalDiagnostics.length,
        resolved: comparison.resolved.length,
        unresolved: comparison.unresolved.length,
        newlyIntroduced: comparison.newDiagnostics.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown revalidation failure.";
    return RevalidationResultSchema.parse({
      status: "error",
      timestamp,
      originalFingerprint,
      resultingFingerprint,
      initialDiagnostics,
      finalDiagnostics: [],
      resolvedDiagnostics: [],
      unresolvedDiagnostics: initialDiagnostics,
      newDiagnostics: [],
      counts: {
        initial: initialDiagnostics.length,
        final: 0,
        resolved: 0,
        unresolved: initialDiagnostics.length,
        newlyIntroduced: 0,
      },
      error: message,
    });
  }
}
