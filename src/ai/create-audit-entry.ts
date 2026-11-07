
import {
  AuditEntrySchema,
  type AuditEntry,
} from "./schemas/audit.schema.js";

import { HumanApprovalSchema } from "./schemas/approval.schema.js";

export type CreateAuditEntryInput = {
  workflowFingerprint: string;
  resultingFingerprint: string;
  rawApproval: unknown;
  appliedDiagnosticCodes: string[];
  rejectedDiagnosticCodes: string[];
  manualDiagnosticCodes: string[];
  timestamp?: string;
};

export function createAuditEntry(
  input: CreateAuditEntryInput,
): AuditEntry {
  const approval = HumanApprovalSchema.parse(
    input.rawApproval,
  );

  const status =
    input.manualDiagnosticCodes.length > 0
      ? "completed_with_manual_actions"
      : input.appliedDiagnosticCodes.length > 0
        ? "completed"
        : "no_changes";

  return AuditEntrySchema.parse({
    workflowFingerprint: input.workflowFingerprint,
    resultingFingerprint: input.resultingFingerprint,
    timestamp: input.timestamp ?? new Date().toISOString(),
    decisions: approval.decisions,
    appliedDiagnosticCodes: input.appliedDiagnosticCodes,
    rejectedDiagnosticCodes: input.rejectedDiagnosticCodes,
    manualDiagnosticCodes: input.manualDiagnosticCodes,
    status,
  });
}
