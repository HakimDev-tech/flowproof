import * as z from "zod";
import { DiagnosticSchema } from "../../graph/state.js";

export const RevalidationStatusSchema = z.enum(["valid", "invalid", "error"]);

export const RevalidationCountsSchema = z.object({
  initial: z.number().int().nonnegative(),
  final: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
  unresolved: z.number().int().nonnegative(),
  newlyIntroduced: z.number().int().nonnegative(),
}).strict();

export const RevalidationResultSchema = z.object({
  status: RevalidationStatusSchema,
  timestamp: z.string().datetime(),
  originalFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  resultingFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  initialDiagnostics: z.array(DiagnosticSchema),
  finalDiagnostics: z.array(DiagnosticSchema),
  resolvedDiagnostics: z.array(DiagnosticSchema),
  unresolvedDiagnostics: z.array(DiagnosticSchema),
  newDiagnostics: z.array(DiagnosticSchema),
  counts: RevalidationCountsSchema,
  error: z.string().min(1).optional(),
}).strict().superRefine((result, context) => {
  if (result.status === "error" && !result.error) {
    context.addIssue({ code: "custom", message: "Error status requires an error description." });
  }
  if (result.status !== "error" && result.error !== undefined) {
    context.addIssue({ code: "custom", message: "Only error status may contain an error description." });
  }
  if (result.counts.initial !== result.initialDiagnostics.length ||
      result.counts.final !== result.finalDiagnostics.length ||
      result.counts.resolved !== result.resolvedDiagnostics.length ||
      result.counts.unresolved !== result.unresolvedDiagnostics.length ||
      result.counts.newlyIntroduced !== result.newDiagnostics.length) {
    context.addIssue({ code: "custom", message: "Revalidation diagnostic counts are inconsistent." });
  }
  if (result.status === "valid" && result.finalDiagnostics.some(d => d.severity === "error")) {
    context.addIssue({ code: "custom", message: "A valid result cannot contain error-severity diagnostics." });
  }
  if (result.status === "valid" && result.finalDiagnostics.length > 0) {
    context.addIssue({ code: "custom", message: "A valid result cannot contain remaining diagnostics." });
  }
});

export type RevalidationResult = z.infer<typeof RevalidationResultSchema>;
