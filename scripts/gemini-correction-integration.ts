
import assert from "node:assert/strict";

import type {
  Diagnostic,
  FlowProofStateType,
} from "../src/graph/state.js";

import { validateInput } from "../src/graph/nodes/validate-input.js";
import { analyzeDiagnostics } from "../src/ai/analyze-diagnostics.js";
import { generateCorrections } from "../src/ai/generate-corrections.js";

function collectDiagnostics(workflow: unknown): Diagnostic[] {
  const state: FlowProofStateType = {
    rawInput: JSON.stringify(workflow),
    parsedWorkflow: workflow,
    diagnostics: [],
    report: null,
  };

  const result = validateInput(state);

  return result.diagnostics ?? [];
}

async function main() {
  const workflowName = "FlowProof correction integration test";

  // 1. Original workflow.
  const workflow = {
    nodes: [],
    connections: {},
  };

  const originalWorkflow = structuredClone(workflow);

  // 2. Run the deterministic validator.
  const diagnostics = collectDiagnostics(workflow);

  assert.equal(diagnostics.length, 1);

  assert.equal(
    diagnostics[0].code,
    "MISSING_WORKFLOW_NAME",
  );

  console.log("Deterministic diagnostics:");
  console.log(JSON.stringify(diagnostics, null, 2));

  // 3. Ask Gemini to analyze the diagnostics.
  console.log("\nRunning Gemini diagnostic analysis...");

  const analysis = await analyzeDiagnostics({
    workflowName,
    diagnostics,
  });

  console.log("\nGemini analysis:");
  console.log(JSON.stringify(analysis, null, 2));

  // 4. Ask Gemini to generate correction proposals.
  console.log("\nGenerating correction proposals...");

  const corrections = await generateCorrections({
    workflowName,
    workflow,
    diagnostics,
    analysis,
  });

  console.log("\nGemini correction proposals:");
  console.log(JSON.stringify(corrections, null, 2));

  // 5. Verify diagnostic coverage.
  const classifiedCodes = [
    ...corrections.proposals.map(
      (proposal) => proposal.diagnosticCode,
    ),
    ...corrections.unaddressedDiagnosticCodes,
  ];

  assert.deepEqual(
    classifiedCodes,
    ["MISSING_WORKFLOW_NAME"],
    "The correction result must classify the expected diagnostic exactly once.",
  );

  // 6. Verify human approval.
  for (const proposal of corrections.proposals) {
    assert.equal(
      proposal.requiresHumanApproval,
      true,
      "Every correction proposal must require human approval.",
    );
  }

  // 7. Verify that the original workflow was not modified.
  assert.deepEqual(
    workflow,
    originalWorkflow,
    "The original workflow must remain unchanged.",
  );

  console.log("\nIntegration assertions:");
  console.log("✓ Deterministic validation produced the expected diagnostic.");
  console.log("✓ Gemini analyzed the diagnostic.");
  console.log("✓ Gemini generated a structurally valid correction result.");
  console.log("✓ No diagnostic code was invented, omitted, or duplicated.");
  console.log("✓ Every generated proposal requires human approval.");
  console.log("✓ The original workflow was not modified.");

  console.log("\nGemini correction integration test passed.");
}

main().catch((error: unknown) => {
  console.error("\nGemini correction integration test failed:");
  console.error(error);
  process.exitCode = 1;
});
