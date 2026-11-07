import type { RunnableConfig } from "@langchain/core/runnables";

export type FlowProofConfigOptions = {
  threadId: string;
  source: "cli" | "api" | "test";
  recursionLimit?: number;
};

export function createFlowProofRunConfig(
  options: FlowProofConfigOptions,
): RunnableConfig {
  if (options.threadId.trim() === "") {
    throw new Error("threadId must not be empty");
  }

  return {
    configurable: {
      thread_id: options.threadId,
    },
    recursionLimit: options.recursionLimit ?? 25,
    runName: "FlowProofWorkflowAnalysis",
    tags: [
      "flowproof",
      "workflow-analysis",
      options.source,
    ],
    metadata: {
      engine: "flowproof",
      source: options.source,
    },
  };
}