import { describe, expect, it } from "vitest";
import {
  END,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import * as z from "zod";

import {
  isRetryableNodeError,
  TransientNodeError,
} from "../src/graph/errors.js";

const TestState = new StateSchema({
  result: z.string().default(""),
});

describe("Retry policy integration", () => {
  it("retries a node after a temporary failure", async () => {
    let attempts = 0;

    const unstableNode = () => {
      attempts += 1;

      if (attempts === 1) {
        throw new TransientNodeError("Temporary failure");
      }

      return {
        result: "success",
      };
    };

    const graph = new StateGraph(TestState)
      .addNode("unstableNode", unstableNode, {
        retryPolicy: {
          maxAttempts: 2,
          initialInterval: 1,
          jitter: false,
          retryOn: isRetryableNodeError,
        },
      })
      .addEdge(START, "unstableNode")
      .addEdge("unstableNode", END)
      .compile();

    const result = await graph.invoke({});

    expect(attempts).toBe(2);
    expect(result.result).toBe("success");
  });

  it("does not retry a non-retryable error", async () => {
    let attempts = 0;

    const failingNode = () => {
      attempts += 1;
      throw new Error("Permanent failure");
    };

    const graph = new StateGraph(TestState)
      .addNode("failingNode", failingNode, {
        retryPolicy: {
          maxAttempts: 3,
          initialInterval: 1,
          jitter: false,
          retryOn: isRetryableNodeError,
        },
      })
      .addEdge(START, "failingNode")
      .addEdge("failingNode", END)
      .compile();

    await expect(graph.invoke({})).rejects.toThrow(
      "Permanent failure",
    );

    expect(attempts).toBe(1);
  });
});