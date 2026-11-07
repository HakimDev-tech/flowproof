import { describe, expect, it } from "vitest";
import {
  END,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import * as z from "zod";

import { createFlowProofRunConfig } from "../src/graph/config.js";

const TestState = new StateSchema({
  result: z.string().default(""),
});

describe("Execution configuration", () => {
  it("passes configurable values, metadata and tags to nodes", async () => {
    let receivedConfig:
      | {
          threadId: unknown;
          metadata: Record<string, unknown> | undefined;
          tags: string[] | undefined;
        }
      | undefined;

    const captureConfig = (
      _state: typeof TestState.State,
      config: {
        configurable?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
        tags?: string[];
      },
    ) => {
      receivedConfig = {
        threadId: config.configurable?.thread_id,
        metadata: config.metadata,
        tags: config.tags,
      };

      return {
        result: "configuration captured",
      };
    };

    const graph = new StateGraph(TestState)
      .addNode("captureConfig", captureConfig)
      .addEdge(START, "captureConfig")
      .addEdge("captureConfig", END)
      .compile();

    const result = await graph.invoke(
      {},
      createFlowProofRunConfig({
        threadId: "flowproof-test-001",
        source: "test",
      }),
    );

    expect(result.result).toBe("configuration captured");

    expect(receivedConfig?.threadId).toBe(
      "flowproof-test-001",
    );

    expect(receivedConfig?.metadata).toMatchObject({
      engine: "flowproof",
      source: "test",
    });

    expect(receivedConfig?.tags).toEqual(
      expect.arrayContaining([
        "flowproof",
        "workflow-analysis",
        "test",
      ]),
    );
  });

  it("rejects an empty thread ID", () => {
    expect(() =>
      createFlowProofRunConfig({
        threadId: "   ",
        source: "test",
      }),
    ).toThrow("threadId must not be empty");
  });
});

describe("Recursion limit", () => {
  it("stops a graph that enters an infinite cycle", async () => {
    const LoopState = new StateSchema({
      count: z.number().default(0),
    });

    let executions = 0;

    const loopNode = (
      state: typeof LoopState.State,
    ) => {
      executions += 1;

      return {
        count: state.count + 1,
      };
    };

    const graph = new StateGraph(LoopState)
      .addNode("loop", loopNode)
      .addEdge(START, "loop")
      .addEdge("loop", "loop")
      .compile();

    await expect(
      graph.invoke(
        {},
        {
          recursionLimit: 2,
        },
      ),
    ).rejects.toThrow(/recursion limit/i);

    expect(executions).toBeGreaterThan(0);
  });
});