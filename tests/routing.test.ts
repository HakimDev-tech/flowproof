import { describe, expect, it } from "vitest";
import { routeAfterParsing } from "../src/graph/routing.js";

describe("routeAfterParsing", () => {
  it("routes invalid JSON to END", () => {
    const route = routeAfterParsing({
      rawInput: "{ invalid json }",
      parsedWorkflow: null,
      diagnostics: [],
      report: null,
    });

    expect(route).toBe("invalid");
  });

  it("routes successfully parsed JSON to validation", () => {
    const route = routeAfterParsing({
      rawInput: '{"name":"My workflow"}',
      parsedWorkflow: { name: "My workflow" },
      diagnostics: [],
      report: null,
    });

    expect(route).toBe("valid");
  });
});