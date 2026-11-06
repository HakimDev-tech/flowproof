
import { END, START, StateGraph } from "@langchain/langgraph";
import { FlowProofState } from "./state.js";

// Node 1 : transforme le JSON brut en objet JavaScript.
const parseInput = (state: typeof FlowProofState.State) => {
  try {
    const parsedWorkflow: unknown = JSON.parse(state.rawInput);

    return { parsedWorkflow };
  } catch {
    return {
      parsedWorkflow: null,
      diagnostics: [
        {
          code: "INVALID_JSON",
          severity: "error" as const,
          message: "Input is not valid JSON",
        },
      ],
    };
  }
};

// Node 2 : vérifie la structure minimale du workflow.
const validateInput = (state: typeof FlowProofState.State) => {
  const workflow = state.parsedWorkflow;

  // Le parsing a déjà échoué : ne pas produire un second diagnostic.
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
};

// Construction et compilation du graphe.
export const workflowGraph = new StateGraph(FlowProofState)
  .addNode("parseInput", parseInput)
  .addNode("validateInput", validateInput)
  .addEdge(START, "parseInput")
  .addEdge("parseInput", "validateInput")
  .addEdge("validateInput", END)
  .compile();
