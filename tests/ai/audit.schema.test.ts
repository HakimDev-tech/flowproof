
import { describe, expect, it } from "vitest";

import {
  AuditDecisionSchema,
  AuditEntrySchema,
  AuditStatusSchema,
} from "../../src/ai/schemas/audit.schema.js";

const validAuditEntry = {
  workflowFingerprint: "a".repeat(64),
  resultingFingerprint: "b".repeat(64),
  timestamp: "2026-11-07T14:00:00.000Z",
  decisions: [
    {
      diagnosticCode: "MISSING_WORKFLOW_NAME",
      decision: "approved",
      reason: "The proposed name is appropriate.",
    },
  ],
  appliedDiagnosticCodes: ["MISSING_WORKFLOW_NAME"],
  rejectedDiagnosticCodes: [],
  manualDiagnosticCodes: [],
  status: "completed",
};

describe("AuditDecisionSchema", () => {
  it("accepts an approved decision", () => {
    expect(
      AuditDecisionSchema.safeParse({
        diagnosticCode: "TEST",
        decision: "approved",
      }).success,
    ).toBe(true);
  });

  it("accepts a rejected decision with a reason", () => {
    expect(
      AuditDecisionSchema.safeParse({
        diagnosticCode: "TEST",
        decision: "rejected",
        reason: "The proposal is incorrect.",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid decision", () => {
    expect(
      AuditDecisionSchema.safeParse({
        diagnosticCode: "TEST",
        decision: "pending",
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected properties", () => {
    expect(
      AuditDecisionSchema.safeParse({
        diagnosticCode: "TEST",
        decision: "approved",
        unexpected: true,
      }).success,
    ).toBe(false);
  });
});

describe("AuditStatusSchema", () => {
  it.each([
    "completed",
    "completed_with_manual_actions",
    "no_changes",
  ])("accepts status %s", (status) => {
    expect(AuditStatusSchema.safeParse(status).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(
      AuditStatusSchema.safeParse("failed").success,
    ).toBe(false);
  });
});

describe("AuditEntrySchema", () => {
  it("accepts a valid audit entry", () => {
    expect(
      AuditEntrySchema.safeParse(validAuditEntry).success,
    ).toBe(true);
  });

  it("accepts an entry with manual actions", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        decisions: [
          {
            diagnosticCode: "MANUAL_REVIEW",
            decision: "approved",
          },
        ],
        appliedDiagnosticCodes: [],
        manualDiagnosticCodes: ["MANUAL_REVIEW"],
        status: "completed_with_manual_actions",
      }).success,
    ).toBe(true);
  });

  it("accepts an entry with no changes", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        decisions: [],
        appliedDiagnosticCodes: [],
        status: "no_changes",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid workflow fingerprint", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        workflowFingerprint: "invalid",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid resulting fingerprint", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        resultingFingerprint: "invalid",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid timestamp", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        timestamp: "not-a-date",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown property", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty diagnostic code", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        appliedDiagnosticCodes: [""],
      }).success,
    ).toBe(false);
  });

  it("rejects a diagnostic classified in multiple categories", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        rejectedDiagnosticCodes: ["MISSING_WORKFLOW_NAME"],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate human decisions", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        decisions: [
          ...validAuditEntry.decisions,
          ...validAuditEntry.decisions,
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a decision without an audit classification", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        appliedDiagnosticCodes: [],
        status: "no_changes",
      }).success,
    ).toBe(false);
  });

  it("rejects an approved decision classified as rejected", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        appliedDiagnosticCodes: [],
        rejectedDiagnosticCodes: ["MISSING_WORKFLOW_NAME"],
        status: "no_changes",
      }).success,
    ).toBe(false);
  });

  it("rejects a completed status without applied corrections", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        appliedDiagnosticCodes: [],
        status: "completed",
      }).success,
    ).toBe(false);
  });

  it("rejects a no_changes status with applied corrections", () => {
    expect(
      AuditEntrySchema.safeParse({
        ...validAuditEntry,
        status: "no_changes",
      }).success,
    ).toBe(false);
  });
});
