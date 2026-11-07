import type { FlowProofStateType } from "./state.js";

export function routeAfterParsing(
  state: FlowProofStateType,
) {
  return state.parsedWorkflow === null
    ? "invalid"
    : "valid";
}