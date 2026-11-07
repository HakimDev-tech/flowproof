import {
  END,
  START,
  StateGraph,
} from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

import { FlowProofState } from "./state.js";
import { parseInput } from "./nodes/parse-input.js";
import { validateInput } from "./nodes/validate-input.js";
import { routeAfterParsing } from "./routing.js";

export function createWorkflowGraph(
  checkpointer: BaseCheckpointSaver,
) {
  return new StateGraph(FlowProofState)
    .addNode("parseInput", parseInput)
    .addNode("validateInput", validateInput)
    .addEdge(START, "parseInput")
    .addConditionalEdges("parseInput", routeAfterParsing, {
      invalid: END,
      valid: "validateInput",
    })
    .addEdge("validateInput", END)
    .compile({ checkpointer });
}