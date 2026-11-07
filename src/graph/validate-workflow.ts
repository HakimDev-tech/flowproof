import { DiagnosticSchema, type Diagnostic } from "./state.js";

/**
 * Single deterministic validation implementation shared by the graph
 * and the post-correction revalidation stage.
 */
export function validateWorkflow(workflow: unknown): Diagnostic[] {
  if (workflow === null || typeof workflow !== "object" || Array.isArray(workflow)) {
    return [DiagnosticSchema.parse({
      code: "INVALID_WORKFLOW_ROOT",
      severity: "error",
      message: "Workflow must be a JSON object",
    })];
  }

  const workflowObject = workflow as Record<string, unknown>;
  if (typeof workflowObject.name !== "string" || workflowObject.name.trim() === "") {
    return [DiagnosticSchema.parse({
      code: "MISSING_WORKFLOW_NAME",
      severity: "warning",
      message: "Workflow name is missing",
    })];
  }

  return [];
}
