
import { ChatGoogle } from "@langchain/google/node";
import { z } from "zod";

import { DiagnosticSchema } from "../graph/state.js";
import { getGeminiConfig } from "./config.js";
import { correctionPrompt } from "./prompts/correction.prompt.js";
import { AnalysisResultSchema } from "./schemas/analysis.schema.js";
import {
  CorrectionResultSchema,
  type CorrectionResult,
} from "./schemas/correction.schema.js";
import { createWorkflowFingerprint } from "./workflow-fingerprint.js";
import { validateAnalysisReferences } from "./validate-analysis.js";
import { validateCorrectionReferences } from "./validate-corrections.js";

const DiagnosticsInputSchema = z.array(DiagnosticSchema);

export type GenerateCorrectionsInput = {
  workflowName: string;
  workflow: unknown;
  diagnostics: unknown;
  analysis: unknown;
};

type CorrectionModelInput = {
  workflowName: string;
  workflow: string;
  diagnostics: string;
  analysis: string;
};

/**
 * A generated correction set is bound to the exact workflow
 * version that was analyzed.
 *
 * The fingerprint is computed by our application, never by Gemini.
 */
export type GeneratedCorrectionSet = {
  workflowFingerprint: string;
  corrections: CorrectionResult;
};

export type GenerateCorrectionsDependencies = {
  /**
   * Optional model invocation override.
   *
   * Production uses Gemini when this dependency is omitted.
   * Tests can inject a deterministic implementation without
   * making a real API request.
   */
  invokeCorrectionModel?: (
    input: CorrectionModelInput,
  ) => Promise<unknown>;
};

function serializeWorkflow(workflow: unknown): string {
  let serialized: string | undefined;

  try {
    serialized = JSON.stringify(workflow, null, 2);
  } catch (error) {
    throw new Error(
      "Workflow must be JSON-serializable.",
      { cause: error },
    );
  }

  if (serialized === undefined) {
    throw new Error("Workflow must be JSON-serializable.");
  }

  return serialized;
}

async function invokeGemini(
  input: CorrectionModelInput,
): Promise<unknown> {
  const config = getGeminiConfig();

  const model = new ChatGoogle({
    model: config.model,
    apiKey: config.apiKey,
    temperature: 0,
    maxRetries: 2,
  });

  const structuredModel = model.withStructuredOutput(
    CorrectionResultSchema,
  );

  const chain = correctionPrompt.pipe(structuredModel);

  return chain.invoke(input);
}

export async function generateCorrections(
  {
    workflowName,
    workflow,
    diagnostics,
    analysis,
  }: GenerateCorrectionsInput,
  dependencies: GenerateCorrectionsDependencies = {},
): Promise<GeneratedCorrectionSet> {
  if (
    typeof workflowName !== "string" ||
    workflowName.trim().length === 0
  ) {
    throw new Error("Workflow name cannot be empty.");
  }

  // 1. Validate deterministic diagnostics.
  const parsedDiagnostics = DiagnosticsInputSchema.parse(
    diagnostics,
  );

  // 2. Validate the structure of the previous AI analysis.
  const parsedAnalysis = AnalysisResultSchema.parse(analysis);

  // 3. Verify that the analysis references exactly the supplied
  //    diagnostic codes.
  const validatedAnalysis = validateAnalysisReferences(
    parsedDiagnostics.map((diagnostic) => diagnostic.code),
    parsedAnalysis,
  );

  // 4. Compute the fingerprint before generating corrections.
  //    This binds the result to the exact analyzed workflow.
  const workflowFingerprint = createWorkflowFingerprint(workflow);

  // 5. Avoid an unnecessary Gemini call when there are no diagnostics.
  if (parsedDiagnostics.length === 0) {
    return {
      workflowFingerprint,
      corrections: {
        summary:
          "No corrections are required because no diagnostics were produced.",
        proposals: [],
        unaddressedDiagnosticCodes: [],
      },
    };
  }

  // 6. Serialize the original workflow without modifying it.
  const serializedWorkflow = serializeWorkflow(workflow);

  // 7. Prepare the exact input shared by the production model
  //    and the test implementation.
  const modelInput: CorrectionModelInput = {
    workflowName,
    workflow: serializedWorkflow,
    diagnostics: JSON.stringify(
      parsedDiagnostics,
      null,
      2,
    ),
    analysis: JSON.stringify(
      validatedAnalysis,
      null,
      2,
    ),
  };

  // 8. Use the injected implementation in tests, or Gemini in production.
  const rawResult = dependencies.invokeCorrectionModel
    ? await dependencies.invokeCorrectionModel(modelInput)
    : await invokeGemini(modelInput);

  // 9. Validate the structure returned by the model.
  const result = CorrectionResultSchema.parse(rawResult);

  // 10. Validate references and human approval requirements.
  const corrections = validateCorrectionReferences(
    parsedDiagnostics.map((diagnostic) => diagnostic.code),
    result,
  );

  // 11. Return the validated corrections bound to their source workflow.
  return {
    workflowFingerprint,
    corrections,
  };
}
