import type { FlowProofStateType } from "../state.js";

export function parseInput(state: FlowProofStateType) {
  try {
    const parsedWorkflow: unknown = JSON.parse(state.rawInput);

    return { parsedWorkflow };
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }

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
}