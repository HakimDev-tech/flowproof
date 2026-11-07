
import type { AnalysisResult } from "./schemas/analysis.schema.js";

export class AnalysisConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisConsistencyError";
  }
}

export function validateAnalysisReferences(
  inputDiagnosticCodes: string[],
  result: AnalysisResult,
): AnalysisResult {
  // Plusieurs diagnostics peuvent partager le même code.
  // On vérifie donc la couverture des codes distincts.
  const inputCodes = new Set(inputDiagnosticCodes);

  const classifiedCodes = [
    ...result.findings.map((finding) => finding.diagnosticCode),
    ...result.unaddressedDiagnosticCodes,
  ];

  const classifiedSet = new Set(classifiedCodes);

  // Chaque code distinct doit être classifié une seule fois.
  if (classifiedSet.size !== classifiedCodes.length) {
    throw new AnalysisConsistencyError(
      "Gemini classified a diagnostic code more than once.",
    );
  }

  // Refuser les codes inventés par Gemini.
  for (const code of classifiedCodes) {
    if (!inputCodes.has(code)) {
      throw new AnalysisConsistencyError(
        `Gemini returned an unknown diagnostic code: ${code}`,
      );
    }
  }

  // Refuser les codes omis par Gemini.
  for (const code of inputCodes) {
    if (!classifiedSet.has(code)) {
      throw new AnalysisConsistencyError(
        `Gemini did not classify diagnostic code: ${code}`,
      );
    }
  }

  return result;
}
