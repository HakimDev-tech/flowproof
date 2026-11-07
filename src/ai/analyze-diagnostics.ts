import { ChatGoogle } from "@langchain/google/node";
import { z } from "zod";

import { DiagnosticSchema } from "../graph/state.js";
import { getGeminiConfig } from "./config.js";
import { analysisPrompt } from "./prompts/analysis.prompt.js";
import { AnalysisResultSchema } from "./schemas/analysis.schema.js";
import { validateAnalysisReferences } from "./validate-analysis.js";

const DiagnosticsInputSchema = z.array(DiagnosticSchema);

export type AnalyzeDiagnosticsInput = {
  workflowName: string;
  diagnostics: unknown;
};

export async function analyzeDiagnostics({
  workflowName,
  diagnostics,
}: AnalyzeDiagnosticsInput) {
  const parsedDiagnostics = DiagnosticsInputSchema.parse(diagnostics);

  if (!workflowName.trim()) {
    throw new Error("Workflow name cannot be empty.");
  }

  // Évite un appel API inutile lorsqu'il n'existe aucun diagnostic.
  if (parsedDiagnostics.length === 0) {
    return {
      summary: "No diagnostics were produced by the deterministic validators.",
      overallAssessment: "healthy" as const,
      findings: [],
      unaddressedDiagnosticCodes: [],
    };
  }

  const config = getGeminiConfig();

  const model = new ChatGoogle({
    model: config.model,
    apiKey: config.apiKey,
    temperature: 0,
    maxRetries: 2,
  });

  const structuredModel = model.withStructuredOutput(
    AnalysisResultSchema,
  );

  const chain = analysisPrompt.pipe(structuredModel);

  const rawResult = await chain.invoke({
    workflowName,
    diagnostics: JSON.stringify(parsedDiagnostics, null, 2),
  });

  // Validation à la frontière applicative.
  const result = AnalysisResultSchema.parse(rawResult);

  // Contrôle sémantique des références.
  return validateAnalysisReferences(
    parsedDiagnostics.map((diagnostic) => diagnostic.code),
    result,
  );
}