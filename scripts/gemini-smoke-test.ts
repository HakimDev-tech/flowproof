import { analysisPrompt } from "../src/ai/prompts/analysis.prompt.js";
import { createGeminiModel } from "../src/ai/model.js";
import { AnalysisResultSchema } from "../src/ai/schemas/analysis.schema.js";
async function main() {
  const model = createGeminiModel();

  const structuredModel = model.withStructuredOutput(
    AnalysisResultSchema,
  );

  const chain = analysisPrompt.pipe(structuredModel);

  const result = await chain.invoke({
    workflowName: "Test Workflow",
    diagnostics: JSON.stringify([
      {
        code: "MISSING_WORKFLOW_NAME",
        severity: "warning",
        message: "The workflow has no descriptive name.",
        path: "name",
      },
    ]),
  });

  // Validation supplémentaire à notre frontière applicative.
  const validated = AnalysisResultSchema.parse(result);

  console.log("Gemini response:");
  console.log(JSON.stringify(validated, null, 2));
}

main().catch((error: unknown) => {
  console.error(
    "Gemini smoke test failed:",
    error instanceof Error ? error.message : "Unknown error",
  );

  process.exitCode = 1;
});