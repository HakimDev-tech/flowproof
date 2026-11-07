
import { describe, expect, it } from "vitest";
import {
  END,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import * as z from "zod";

describe("Conditional routing integration", () => {
  it("skips validation when parsing fails", async () => {
    const TestState = new StateSchema({
      valid: z.boolean(),
      executionTrace: z.array(z.string()).default([]),
    });

    const parseNode = (state: typeof TestState.State) => ({
      executionTrace: [...state.executionTrace, "parse"],
    });

    const validateNode = (state: typeof TestState.State) => ({
      executionTrace: [...state.executionTrace, "validate"],
    });

    const graph = new StateGraph(TestState)
      .addNode("parse", parseNode)
      .addNode("validate", validateNode)
      .addEdge(START, "parse")
      .addConditionalEdges(
        "parse",
        (state) => state.valid ? "valid" : "invalid",
        {
          valid: "validate",
          invalid: END,
        },
      )
      .addEdge("validate", END)
      .compile();

    const result = await graph.invoke({
      valid: false,
      executionTrace: [],
    });

    expect(result.executionTrace).toEqual(["parse"]);
  });

  it("executes validation when parsing succeeds", async () => {
    const TestState = new StateSchema({
      valid: z.boolean(),
      executionTrace: z.array(z.string()).default([]),
    });

    const parseNode = (state: typeof TestState.State) => ({
      executionTrace: [...state.executionTrace, "parse"],
    });

    const validateNode = (state: typeof TestState.State) => ({
      executionTrace: [...state.executionTrace, "validate"],
    });

    const graph = new StateGraph(TestState)
      .addNode("parse", parseNode)
      .addNode("validate", validateNode)
      .addEdge(START, "parse")
      .addConditionalEdges(
        "parse",
        (state) => state.valid ? "valid" : "invalid",
        {
          valid: "validate",
          invalid: END,
        },
      )
      .addEdge("validate", END)
      .compile();

    const result = await graph.invoke({
      valid: true,
      executionTrace: [],
    });

    expect(result.executionTrace).toEqual(["parse", "validate"]);
  });
});
