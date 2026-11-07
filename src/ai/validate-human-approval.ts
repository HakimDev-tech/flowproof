
import {
  CorrectionResultSchema,
  type CorrectionProposal,
  type CorrectionResult,
} from "./schemas/correction.schema.js";

import {
  HumanApprovalSchema,
} from "./schemas/approval.schema.js";

export type HumanApprovalValidation =
  | {
      valid: true;
      corrections: CorrectionResult;
      approvedDiagnosticCodes: string[];
      rejectedDiagnosticCodes: string[];
    }
  | {
      valid: false;
      reason: string;
    };

function invalid(reason: string): HumanApprovalValidation {
  return { valid: false, reason };
}

export function validateHumanApproval(
  rawCorrectionResult: unknown,
  rawApproval: unknown,
): HumanApprovalValidation {
  const correctionResult = CorrectionResultSchema.safeParse(
    rawCorrectionResult,
  );

  if (!correctionResult.success) {
    return invalid(
      "The correction result does not match the expected schema.",
    );
  }

  const approval = HumanApprovalSchema.safeParse(rawApproval);

  if (!approval.success) {
    return invalid(
      "The human approval does not match the expected schema.",
    );
  }

  // From this point onward, use only Zod-validated data.
  const validatedCorrections = correctionResult.data;
  const validatedApproval = approval.data;

  const proposals: CorrectionProposal[] =
    validatedCorrections.proposals;

  const proposalCodes = proposals.map(
    (proposal) => proposal.diagnosticCode,
  );

  const proposalCodeSet = new Set(proposalCodes);

  if (proposalCodeSet.size !== proposalCodes.length) {
    return invalid(
      "The correction result contains duplicate proposal diagnostic codes.",
    );
  }

  const unaddressedCodes =
    validatedCorrections.unaddressedDiagnosticCodes;

  const unaddressedCodeSet = new Set(unaddressedCodes);

  if (unaddressedCodeSet.size !== unaddressedCodes.length) {
    return invalid(
      "The correction result contains duplicate unaddressed diagnostic codes.",
    );
  }

  if (proposalCodes.some((code) => unaddressedCodeSet.has(code))) {
    return invalid(
      "A diagnostic code cannot have both a proposal and an unaddressed status.",
    );
  }

  const decisions = validatedApproval.decisions;

  const decisionCodes = decisions.map(
    (decision) => decision.diagnosticCode,
  );

  const decisionCodeSet = new Set(decisionCodes);

  if (decisionCodeSet.size !== decisionCodes.length) {
    return invalid(
      "A proposal cannot receive multiple human decisions.",
    );
  }

  const unknownCodes = decisionCodes.filter(
    (code) => !proposalCodeSet.has(code),
  );

  if (unknownCodes.length > 0) {
    return invalid(
      `Human decisions reference unknown proposals: ${unknownCodes.join(", ")}`,
    );
  }

  const missingCodes = proposalCodes.filter(
    (code) => !decisionCodeSet.has(code),
  );

  if (missingCodes.length > 0) {
    return invalid(
      `Some proposals have no human decision: ${missingCodes.join(", ")}`,
    );
  }

  const approvedDiagnosticCodes = decisions
    .filter((decision) => decision.decision === "approved")
    .map((decision) => decision.diagnosticCode);

  const rejectedDiagnosticCodes = decisions
    .filter((decision) => decision.decision === "rejected")
    .map((decision) => decision.diagnosticCode);

  return {
    valid: true,
    corrections: validatedCorrections,
    approvedDiagnosticCodes,
    rejectedDiagnosticCodes,
  };
}
