
import assert from "node:assert/strict";

import type { Diagnostic, FlowProofStateType } from "../src/graph/state.js";
import { validateInput } from "../src/graph/nodes/validate-input.js";
import { analyzeDiagnostics } from "../src/ai/analyze-diagnostics.js";

function collectDiagnostics(parsedWorkflow: unknown): Diagnostic[] {
  const state: FlowProofStateType = {
    rawInput: JSON.stringify(parsedWorkflow),
    parsedWorkflow,
    diagnostics: [],
    report: null,
  };

  const result = validateInput(state);

  return result.diagnostics ?? [];
}

async function main() {
  // Scénario 1 : la racine JSON n'est pas un objet.
  const invalidRootDiagnostics = collectDiagnostics([]);

  // Scénario 2 : le workflow ne possède pas de nom.
  const missingNameDiagnostics = collectDiagnostics({
    nodes: [],
    connections: {},
  });

  // Regroupement des diagnostics produits par le validateur déterministe.
  const diagnostics = [
    ...invalidRootDiagnostics,
    ...missingNameDiagnostics,
  ];

  const expectedCodes = [
    "INVALID_WORKFLOW_ROOT",
    "MISSING_WORKFLOW_NAME",
  ];

  assert.equal(
    diagnostics.length,
    expectedCodes.length,
    "The deterministic validators did not produce the expected diagnostics.",
  );

  console.log("Diagnostics sent to Gemini:");
  console.log(JSON.stringify(diagnostics, null, 2));

  // Analyse réelle avec Gemini.
  const result = await analyzeDiagnostics({
    workflowName: "FlowProof Gemini integration test",
    diagnostics,
  });

  // Vérification de la structure générale.
  assert.ok(result.summary.length > 0);
  assert.ok(
    ["healthy", "warning", "critical"].includes(result.overallAssessment),
  );

  // Tous les codes doivent être classés exactement une fois.
  const classifiedCodes = [
    ...result.findings.map((finding) => finding.diagnosticCode),
    ...result.unaddressedDiagnosticCodes,
  ];

  assert.equal(
    classifiedCodes.length,
    new Set(classifiedCodes).size,
    "Gemini classified a diagnostic code more than once.",
  );

  assert.deepEqual(
    [...classifiedCodes].sort(),
    [...expectedCodes].sort(),
    "Gemini did not classify exactly the expected diagnostic codes.",
  );

  console.log("\nGemini analysis result:");
  console.log(JSON.stringify(result, null, 2));

  console.log("\nIntegration assertions:");
  console.log("✓ Structured output is valid.");
  console.log("✓ No diagnostic code was invented.");
  console.log("✓ No diagnostic code was classified more than once.");
  console.log("✓ Every expected diagnostic code was classified.");
  console.log("\nGemini integration test passed.");
}

main().catch((error: unknown) => {
  console.error("\nGemini integration test failed:");
  console.error(error);
  process.exitCode = 1;
});
