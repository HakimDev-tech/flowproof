
import { describe, expect, it } from "vitest";
import {
  END,
  START,
  StateGraph,
  StateSchema,
  ReducedValue,
} from "@langchain/langgraph";
import * as z from "zod";

const TestState = new StateSchema({
  diagnostics: new ReducedValue(
    z.array(z.string()).default([]),
    {
      reducer: (current, update) => [...current, ...update],
    },
  ),
  report: z.array(z.string()).default([]),
});

describe("Parallel branches", () => {
  it("merges diagnostics from both branches before reporting", async () => {
    const checkNodes = () => ({
      diagnostics: ["NODE_WITHOUT_NAME"],
    });

    const checkConnections = () => ({
      diagnostics: [
        "UNKNOWN_NODE_REFERENCE",
        "INVALID_CONNECTION",
      ],
    });

    const generateReport = (
      state: typeof TestState.State,
    ) => ({
      report: state.diagnostics,
    });

    const graph = new StateGraph(TestState)
      .addNode("checkNodes", checkNodes)
      .addNode("checkConnections", checkConnections)
      .addNode("generateReport", generateReport)
      .addEdge(START, "checkNodes")
      .addEdge(START, "checkConnections")
      .addEdge(
        ["checkNodes", "checkConnections"],
        "generateReport",
      )
      .addEdge("generateReport", END)
      .compile();

    const result = await graph.invoke({});

    expect(result.diagnostics).toHaveLength(3);
    expect(result.report).toHaveLength(3);

    expect(result.report).toContain("NODE_WITHOUT_NAME");
    expect(result.report).toContain("UNKNOWN_NODE_REFERENCE");
    expect(result.report).toContain("INVALID_CONNECTION");
  });
});
