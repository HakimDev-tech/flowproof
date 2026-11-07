
import * as z from "zod";

/**
 * JSON-compatible values only.
 *
 * This prevents arbitrary JavaScript values from entering
 * correction operations.
 */
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

/**
 * JSON Pointer (RFC 6901).
 *
 * Examples:
 * /name
 * /nodes/0/name
 * /settings/executionOrder
 *
 * The root document itself cannot be targeted.
 */
export const JsonPointerSchema = z
  .string()
  .regex(
    /^(?:\/(?:[^/~]|~[01])*)+$/,
    "Invalid JSON Pointer.",
  );

const CorrectionProposalBaseSchema = {
  diagnosticCode: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  proposedChange: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
  risk: z.enum(["low", "medium", "high"]),
  requiresHumanApproval: z.literal(true),
};

/**
 * Manual proposal:
 * no automatic operation can be safely determined.
 */
const ManualCorrectionProposalSchema = z
  .object({
    ...CorrectionProposalBaseSchema,
    operation: z.literal("manual"),
  })
  .strict();

/**
 * Add proposal:
 * target path must be absent when applying the operation.
 */
const AddCorrectionProposalSchema = z
  .object({
    ...CorrectionProposalBaseSchema,
    operation: z.literal("add"),
    change: z
      .object({
        path: JsonPointerSchema,
        value: JsonValueSchema,
      })
      .strict(),
  })
  .strict();

/**
 * Replace proposal:
 * target path must already exist when applying.
 */
const ReplaceCorrectionProposalSchema = z
  .object({
    ...CorrectionProposalBaseSchema,
    operation: z.literal("replace"),
    change: z
      .object({
        path: JsonPointerSchema,
        value: JsonValueSchema,
      })
      .strict(),
  })
  .strict();

/**
 * Remove proposal:
 * target path must already exist when applying.
 */
const RemoveCorrectionProposalSchema = z
  .object({
    ...CorrectionProposalBaseSchema,
    operation: z.literal("remove"),
    change: z
      .object({
        path: JsonPointerSchema,
      })
      .strict(),
  })
  .strict();

export const CorrectionProposalSchema = z.discriminatedUnion(
  "operation",
  [
    ManualCorrectionProposalSchema,
    AddCorrectionProposalSchema,
    ReplaceCorrectionProposalSchema,
    RemoveCorrectionProposalSchema,
  ],
);

export const CorrectionResultSchema = z
  .object({
    summary: z.string().min(1),
    proposals: z.array(CorrectionProposalSchema),
    unaddressedDiagnosticCodes: z.array(z.string().min(1)),
  })
  .strict();

export type CorrectionProposal = z.infer<
  typeof CorrectionProposalSchema
>;

export type CorrectionResult = z.infer<
  typeof CorrectionResultSchema
>;
