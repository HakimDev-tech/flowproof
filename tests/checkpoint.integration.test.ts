import { describe, expect, it } from "vitest";
import {
  END,
  START,
  MemorySaver,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import * as z from "zod";

const TestState = new StateSchema({
  result: z.string().default(""),
});

describe("Checkpoint integration", () => {
  it("saves the final state and exposes its history", async () => {
    const checkpointer = new MemorySaver();

    const graph = new StateGraph(TestState)
      .addNode("produce", () => ({
        result: "persisted",
      }))
      .addEdge(START, "produce")
      .addEdge("produce", END)
      .compile({ checkpointer });

    const config = {
      configurable: {
        thread_id: "checkpoint-state-test",
      },
    };

    await graph.invoke({}, config);

    const snapshot = await graph.getState(config);

    expect(snapshot.values.result).toBe("persisted");
    expect(snapshot.next).toEqual([]);

    let checkpointCount = 0;

    for await (const _snapshot of graph.getStateHistory(config)) {
      checkpointCount += 1;
    }

    expect(checkpointCount).toBeGreaterThan(0);
  });

  it("keeps different threads isolated", async () => {
    const checkpointer = new MemorySaver();

    const graph = new StateGraph(TestState)
      .addNode("produce", (state) => ({
        result: state.result,
      }))
      .addEdge(START, "produce")
      .addEdge("produce", END)
      .compile({ checkpointer });

    const threadA = {
      configurable: {
        thread_id: "thread-A",
      },
    };

    const threadB = {
      configurable: {
        thread_id: "thread-B",
      },
    };

    await graph.invoke({ result: "data-A" }, threadA);
    await graph.invoke({ result: "data-B" }, threadB);

    const snapshotA = await graph.getState(threadA);
    const snapshotB = await graph.getState(threadB);

    expect(snapshotA.values.result).toBe("data-A");
    expect(snapshotB.values.result).toBe("data-B");
  });

  it("resumes execution after a node failure", async () => {
    const checkpointer = new MemorySaver();
    let attempts = 0;

    const unstableNode = () => {
      attempts += 1;

      if (attempts === 1) {
        throw new Error("Temporary failure");
      }

      return {
        result: "recovered",
      };
    };

    const graph = new StateGraph(TestState)
      .addNode("unstableNode", unstableNode, {
        retryPolicy: {
          maxAttempts: 1,
        },
      })
      .addEdge(START, "unstableNode")
      .addEdge("unstableNode", END)
      .compile({ checkpointer });

    const config = {
      configurable: {
        thread_id: "resume-after-failure",
      },
    };

    await expect(
      graph.invoke({}, config),
    ).rejects.toThrow("Temporary failure");

    const snapshotBeforeResume = await graph.getState(config);

    expect(snapshotBeforeResume.next).toContain("unstableNode");

    const result = await graph.invoke(null, config);

    expect(result.result).toBe("recovered");
    expect(attempts).toBe(2);
  });
});