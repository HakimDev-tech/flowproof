
import { describe, expect, it } from "vitest";

import {
  createAuditEntry,
} from "../../src/ai/create-audit-entry.js";

const baseInput = {
  workflowFingerprint: "a".repeat(64),
  resultingFingerprint: "b".repeat(64),
  rawApproval: {
    decisions: [
      {
        diagnosticCode: "FIX_NAME",
        decision: "approved",
        reason: "The proposed name is correct.",
      },
    ],
  },
  appliedDiagnosticCodes: ["FIX_NAME"],
  rejectedDiagnosticCodes: [],
  manualDiagnosticCodes: [],
  timestamp: "2026-11-07T14:00:00.000Z",
};

describe("createAuditEntry", () => {
  it("creates an audit entry for completed corrections", () => {
    const result = createAuditEntry(baseInput);

    expect(result).toEqual({
      workflowFingerprint: "a".repeat(64),
      resultingFingerprint: "b".repeat(64),
      timestamp: "2026-11-07T14:00:00.000Z",
      decisions: baseInput.rawApproval.decisions,
      appliedDiagnosticCodes: ["FIX_NAME"],
      rejectedDiagnosticCodes: [],
      manualDiagnosticCodes: [],
      status: "completed",
    });
  });

  it("creates an entry when a correction requires manual intervention", () => {
    const result = createAuditEntry({
      ...baseInput,
      rawApproval: {
        decisions: [
          {
            diagnosticCode: "MANUAL_FIX",
            decision: "approved",
          },
        ],
      },
      appliedDiagnosticCodes: [],
      manualDiagnosticCodes: ["MANUAL_FIX"],
    });

    expect(result.status).toBe(
      "completed_with_manual_actions",
    );

    expect(result.manualDiagnosticCodes).toEqual([
      "MANUAL_FIX",
    ]);
  });

  it("creates an entry when all proposals are rejected", () => {
    const result = createAuditEntry({
      ...baseInput,
      rawApproval: {
        decisions: [
          {
            diagnosticCode: "FIX_NAME",
            decision: "rejected",
            reason: "The proposed correction is incorrect.",
          },
        ],
      },
      appliedDiagnosticCodes: [],
      rejectedDiagnosticCodes: ["FIX_NAME"],
    });

    expect(result.status).toBe("no_changes");
    expect(result.rejectedDiagnosticCodes).toEqual([
      "FIX_NAME",
    ]);
  });

  it("uses the current timestamp when none is provided", () => {
    const before = Date.now();

    const result = createAuditEntry({
      ...baseInput,
      timestamp: undefined,
    });

    const after = Date.now();
    const timestamp = new Date(result.timestamp).getTime();

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("rejects invalid human approval", () => {
    expect(() =>
      createAuditEntry({
        ...baseInput,
        rawApproval: {
          decisions: [],
        },
      }),
    ).toThrow();
  });

  it("rejects inconsistent audit classifications", () => {
    expect(() =>
      createAuditEntry({
        ...baseInput,
        rejectedDiagnosticCodes: ["FIX_NAME"],
      }),
    ).toThrow();
  });

  it("rejects invalid fingerprints", () => {
    expect(() =>
      createAuditEntry({
        ...baseInput,
        workflowFingerprint: "invalid",
      }),
    ).toThrow();
  });

  it("rejects an invalid timestamp", () => {
    expect(() =>
      createAuditEntry({
        ...baseInput,
        timestamp: "invalid-date",
      }),
    ).toThrow();
  });
});
