import { describe, expect, it } from "vitest";

import {
  isRetryableNodeError,
  TransientNodeError,
} from "../src/graph/errors.js";

describe("Node error classification", () => {
  it("identifies transient node errors as retryable", () => {
    const error = new TransientNodeError("Network timeout");

    expect(isRetryableNodeError(error)).toBe(true);
  });

  it("does not classify regular errors as retryable", () => {
    const error = new Error("Invalid configuration");

    expect(isRetryableNodeError(error)).toBe(false);
  });

  it("does not classify non-error values as retryable", () => {
    expect(isRetryableNodeError("Unexpected failure")).toBe(false);
  });
});