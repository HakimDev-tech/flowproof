
import * as z from "zod";

/**
 * A human decision associated with one correction proposal.
 *
 * The diagnostic code identifies the proposal because
 * correction generation already guarantees one proposal
 * or one unaddressed entry per diagnostic code.
 */
export const HumanDecisionSchema = z
  .object({
    diagnosticCode: z.string().min(1),

    decision: z.enum([
      "approved",
      "rejected",
    ]),

    reason: z.string().min(1).optional(),
  })
  .strict();

/**
 * Complete human review of a correction result.
 *
 * Every proposal must receive exactly one decision.
 * This completeness rule will be enforced by a
 * dedicated validation function.
 */
export const HumanApprovalSchema = z
  .object({
    decisions: z.array(HumanDecisionSchema),
  })
  .strict();

export type HumanDecision = z.infer<
  typeof HumanDecisionSchema
>;

export type HumanApproval = z.infer<
  typeof HumanApprovalSchema
>;
