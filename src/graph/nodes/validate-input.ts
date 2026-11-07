import type { FlowProofStateType } from "../state.js";

export function validateInput(state: FlowProofStateType) {
  const workflow = state.parsedWorkflow;

  if (workflow === null) {
    return {};
  }

  if (
    typeof workflow !== "object" ||
    Array.isArray(workflow)
  ) {
    return {
      diagnostics: [
        {
          code: "INVALID_WORKFLOW_ROOT",
          severity: "error" as const,
          message: "Workflow must be a JSON object",
        },
      ],
    };
  }

  const workflowObject = workflow as Record<string, unknown>;

  if (
    typeof workflowObject.name !== "string" ||
    workflowObject.name.trim() === ""
  ) {
    return {
      diagnostics: [
        {
          code: "MISSING_WORKFLOW_NAME",
          severity: "warning" as const,
          message: "Workflow name is missing",
        },
      ],
    };
  }

  return {};
}