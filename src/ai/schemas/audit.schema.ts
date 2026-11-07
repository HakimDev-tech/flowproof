
import * as z from "zod";

export const AuditDecisionSchema = z
  .object({
    diagnosticCode: z.string().min(1),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().min(1).optional(),
  })
  .strict();

export const AuditStatusSchema = z.enum([
  "completed",
  "completed_with_manual_actions",
  "no_changes",
]);

export const AuditEntrySchema = z
  .object({
    workflowFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/),

    resultingFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/),

    timestamp: z.string().datetime(),

    decisions: z.array(AuditDecisionSchema),

    appliedDiagnosticCodes: z.array(z.string().min(1)),

    rejectedDiagnosticCodes: z.array(z.string().min(1)),

    manualDiagnosticCodes: z.array(z.string().min(1)),

    status: AuditStatusSchema,
  })
  .strict()
  .superRefine((entry, context) => {
    const categories = [
      entry.appliedDiagnosticCodes,
      entry.rejectedDiagnosticCodes,
      entry.manualDiagnosticCodes,
    ];

    const classifiedCodes = categories.flat();

    const uniqueClassifiedCodes = new Set(classifiedCodes);

    if (uniqueClassifiedCodes.size !== classifiedCodes.length) {
      context.addIssue({
        code: "custom",
        message: "A diagnostic code cannot appear in multiple audit categories.",
      });
    }

    const decisionCodes = entry.decisions.map(
      (decision) => decision.diagnosticCode,
    );

    if (new Set(decisionCodes).size !== decisionCodes.length) {
      context.addIssue({
        code: "custom",
        message: "Each diagnostic code must have exactly one audit decision.",
      });
    }

    const classifiedSet = new Set(classifiedCodes);
    const decisionSet = new Set(decisionCodes);

    if (
      classifiedSet.size !== decisionSet.size ||
      [...decisionSet].some((code) => !classifiedSet.has(code))
    ) {
      context.addIssue({
        code: "custom",
        message: "Every human decision must have a corresponding audit classification.",
      });
    }

    for (const decision of entry.decisions) {
      const isApplied = entry.appliedDiagnosticCodes.includes(
        decision.diagnosticCode,
      );

      const isRejected = entry.rejectedDiagnosticCodes.includes(
        decision.diagnosticCode,
      );

      const isManual = entry.manualDiagnosticCodes.includes(
        decision.diagnosticCode,
      );

      if (
        decision.decision === "approved" &&
        !isApplied &&
        !isManual
      ) {
        context.addIssue({
          code: "custom",
          message: `Approved diagnostic ${decision.diagnosticCode} must be applied or marked for manual intervention.`,
        });
      }

      if (decision.decision === "rejected" && !isRejected) {
        context.addIssue({
          code: "custom",
          message: `Rejected diagnostic ${decision.diagnosticCode} must be classified as rejected.`,
        });
      }

      if (decision.decision === "approved" && isRejected) {
        context.addIssue({
          code: "custom",
          message: `Approved diagnostic ${decision.diagnosticCode} cannot be classified as rejected.`,
        });
      }

      if (decision.decision === "rejected" && (isApplied || isManual)) {
        context.addIssue({
          code: "custom",
          message: `Rejected diagnostic ${decision.diagnosticCode} cannot be applied or marked for manual intervention.`,
        });
      }
    }

    const expectedStatus =
      entry.manualDiagnosticCodes.length > 0
        ? "completed_with_manual_actions"
        : entry.appliedDiagnosticCodes.length > 0
          ? "completed"
          : "no_changes";

    if (entry.status !== expectedStatus) {
      context.addIssue({
        code: "custom",
        message: `Inconsistent audit status. Expected: ${expectedStatus}.`,
      });
    }
  });

export type AuditDecision = z.infer<
  typeof AuditDecisionSchema
>;

export type AuditStatus = z.infer<
  typeof AuditStatusSchema
>;

export type AuditEntry = z.infer<
  typeof AuditEntrySchema
>;
