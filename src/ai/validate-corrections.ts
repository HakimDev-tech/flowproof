
import type { CorrectionResult } from "./schemas/correction.schema.js";

export class CorrectionConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorrectionConsistencyError";
  }
}

export function validateCorrectionReferences(
  inputDiagnosticCodes: string[],
  result: CorrectionResult,
): CorrectionResult {
  const inputCodes = new Set(inputDiagnosticCodes);

  const classifiedCodes = [
    ...result.proposals.map((proposal) => proposal.diagnosticCode),
    ...result.unaddressedDiagnosticCodes,
  ];

  const classifiedSet = new Set(classifiedCodes);

  if (classifiedSet.size !== classifiedCodes.length) {
    throw new CorrectionConsistencyError(
      "A diagnostic code was classified more than once.",
    );
  }

  for (const code of classifiedCodes) {
    if (!inputCodes.has(code)) {
      throw new CorrectionConsistencyError(
        `Unknown diagnostic code returned: ${code}`,
      );
    }
  }

  for (const code of inputCodes) {
    if (!classifiedSet.has(code)) {
      throw new CorrectionConsistencyError(
        `Diagnostic code was not classified: ${code}`,
      );
    }
  }

  for (const proposal of result.proposals) {
    if (proposal.requiresHumanApproval !== true) {
      throw new CorrectionConsistencyError(
        `Correction for ${proposal.diagnosticCode} does not require human approval.`,
      );
    }
  }

  return result;
}
