import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src/version.js";

describe("ENGINE_VERSION", () => {
  it("should expose the current engine version", () => {
    expect(ENGINE_VERSION).toBe("0.1.0");
  });
});
