
import { describe, expect, it } from "vitest";
import {
  MemorySaver
} from "@langchain/langgraph";

import { createFlowProofRunConfig } from "../src/graph/config.js";
import { createWorkflowGraph } from "../src/graph/workflow.graph.js";

describe("FlowProof workflow graph", () => {
  it("parses and validates a valid workflow", async () => {
    const workflowGraph = createWorkflowGraph(new MemorySaver());

    const result = await workflowGraph.invoke(
      {
        rawInput: JSON.stringify({
          name: "My workflow",
        }),
      },
      createFlowProofRunConfig({
        threadId: "workflow-valid-test",
        source: "test",
      }),
    );

    expect(result.parsedWorkflow).toEqual({
      name: "My workflow",
    });

    expect(result.diagnostics).toEqual([]);
  });

  it("detects invalid JSON", async () => {
    const workflowGraph = createWorkflowGraph(new MemorySaver());

    const result = await workflowGraph.invoke(
      {
        rawInput: "{ invalid json }",
      },
      createFlowProofRunConfig({
        threadId: "workflow-invalid-json-test",
        source: "test",
      }),
    );

    expect(result.parsedWorkflow).toBeNull();

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "INVALID_JSON",
        severity: "error",
      }),
    );
  });

  it("detects a missing workflow name", async () => {
    const workflowGraph = createWorkflowGraph(new MemorySaver());

    const result = await workflowGraph.invoke(
      {
        rawInput: JSON.stringify({
          nodes: [],
          connections: {},
        }),
      },
      createFlowProofRunConfig({
        threadId: "workflow-missing-name-test",
        source: "test",
      }),
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MISSING_WORKFLOW_NAME",
        severity: "warning",
      }),
    );
  });
});
