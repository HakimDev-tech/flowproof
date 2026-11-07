import type { FlowProofStateType } from "../state.js";
import { validateWorkflow } from "../validate-workflow.js";

export function validateInput(state: FlowProofStateType) {
  const workflow = state.parsedWorkflow;
  if (workflow === null) return {};
  const diagnostics = validateWorkflow(workflow);
  return diagnostics.length > 0 ? { diagnostics } : {};
}
