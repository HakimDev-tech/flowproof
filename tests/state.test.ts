import { describe, expect, it } from "vitest";
import { DiagnosticSchema } from "../src/graph/state.js";

describe("DiagnosticSchema", () => {
  it("accepts a valid diagnostic", () => {
    const diagnostic = {
      code: "INVALID_CONNECTION",
      severity: "error",
      message: "Connection references an unknown node",
      path: "connections.main",
    };

    expect(DiagnosticSchema.safeParse(diagnostic).success).toBe(true);
  });

  it("rejects an invalid severity", () => {
    const diagnostic = {
      code: "INVALID_CONNECTION",
      severity: "critical",
      message: "Invalid connection",
    };

    expect(DiagnosticSchema.safeParse(diagnostic).success).toBe(false);
  });

  it("rejects an empty diagnostic code", () => {
    const diagnostic = {
      code: "",
      severity: "warning",
      message: "Missing information",
    };

    expect(DiagnosticSchema.safeParse(diagnostic).success).toBe(false);
  });
});