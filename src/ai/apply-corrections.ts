
import type { CorrectionProposal } from "./schemas/correction.schema.js";
import type { GeneratedCorrectionSet } from "./generate-corrections.js";
import type { AuditEntry } from "./schemas/audit.schema.js";

import { createAuditEntry } from "./create-audit-entry.js";
import { createWorkflowFingerprint } from "./workflow-fingerprint.js";
import { validateCorrectionOperation } from "./validate-correction-operation.js";
import { validateHumanApproval } from "./validate-human-approval.js";

export class CorrectionApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorrectionApplicationError";
  }
}

export class StaleWorkflowError extends CorrectionApplicationError {
  constructor() {
    super(
      "The workflow has changed since the corrections were generated. Generate new corrections before applying them.",
    );
    this.name = "StaleWorkflowError";
  }
}

export type ApplyCorrectionsResult = {
  workflow: Record<string, unknown>;
  originalFingerprint: string;
  resultingFingerprint: string;
  appliedDiagnosticCodes: string[];
  rejectedDiagnosticCodes: string[];
  manualDiagnosticCodes: string[];
  auditEntry: AuditEntry;
};

function cloneJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (typeof value === "object") {
    const result = Object.create(null) as Record<string, unknown>;

    for (const key of Object.keys(value)) {
      Object.defineProperty(result, key, {
        value: cloneJsonValue(
          Object.getOwnPropertyDescriptor(value, key)!.value,
        ),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }

    return result;
  }

  throw new CorrectionApplicationError(
    "Cannot clone a non-JSON workflow value.",
  );
}

function decodePointerSegment(segment: string): string {
  return segment
    .replace(/~1/g, "/")
    .replace(/~0/g, "~");
}

function applyAutomaticCorrection(
  workflow: Record<string, unknown>,
  proposal: Exclude<CorrectionProposal, { operation: "manual" }>,
): void {
  const validation = validateCorrectionOperation(
    workflow,
    proposal,
  );

  if (!validation.valid || !validation.applicable) {
    throw new CorrectionApplicationError(
      `Cannot apply correction ${proposal.diagnosticCode}: ${validation.reason}`,
    );
  }

  const segments = validation.path
    .slice(1)
    .split("/")
    .map(decodePointerSegment);

  const target = segments.pop();

  if (target === undefined) {
    throw new CorrectionApplicationError(
      "The correction path does not contain a target.",
    );
  }

  let parent: unknown = workflow;

  for (const segment of segments) {
    if (Array.isArray(parent)) {
      parent = parent[Number(segment)];
    } else {
      parent = (parent as Record<string, unknown>)[segment];
    }
  }

  if (parent === null || typeof parent !== "object") {
    throw new CorrectionApplicationError(
      "The correction target parent is not an object or array.",
    );
  }

  if (Array.isArray(parent)) {
    const index = target === "-" ? parent.length : Number(target);

    switch (proposal.operation) {
      case "add":
        parent.splice(
          index,
          0,
          cloneJsonValue(proposal.change.value),
        );
        return;

      case "replace":
        parent[index] = cloneJsonValue(proposal.change.value);
        return;

      case "remove":
        parent.splice(index, 1);
        return;
    }
  }

  const record = parent as Record<string, unknown>;

  switch (proposal.operation) {
    case "add":
    case "replace":
      Object.defineProperty(record, target, {
        value: cloneJsonValue(proposal.change.value),
        enumerable: true,
        configurable: true,
        writable: true,
      });
      return;

    case "remove":
      if (!delete record[target]) {
        throw new CorrectionApplicationError(
          `Could not remove property: ${target}`,
        );
      }
      return;
  }
}

export function applyCorrections(
  workflow: unknown,
  generated: GeneratedCorrectionSet,
  rawApproval: unknown,
): ApplyCorrectionsResult {
  const currentFingerprint = createWorkflowFingerprint(workflow);

  if (currentFingerprint !== generated.workflowFingerprint) {
    throw new StaleWorkflowError();
  }

  const approvalValidation = validateHumanApproval(
    generated.corrections,
    rawApproval,
  );

  if (!approvalValidation.valid) {
    throw new CorrectionApplicationError(
      `Human approval validation failed: ${approvalValidation.reason}`,
    );
  }

  // Use only the validated Zod output from this point onward.
  const validatedCorrections = approvalValidation.corrections;

  const approvedCodes = new Set(
    approvalValidation.approvedDiagnosticCodes,
  );

  const rejectedDiagnosticCodes =
    approvalValidation.rejectedDiagnosticCodes;

  const candidate = cloneJsonValue(workflow) as Record<string, unknown>;

  const appliedDiagnosticCodes: string[] = [];
  const manualDiagnosticCodes: string[] = [];\n  const appliedOperations: Array<{ diagnosticCode: string; operation: "add" | "replace" | "remove"; path: string }> = [];

  for (const proposal of validatedCorrections.proposals) {
    if (!approvedCodes.has(proposal.diagnosticCode)) {
      continue;
    }

    if (proposal.operation === "manual") {
      manualDiagnosticCodes.push(proposal.diagnosticCode);
      continue;
    }

    applyAutomaticCorrection(candidate, proposal);

    appliedDiagnosticCodes.push(proposal.diagnosticCode);\n    appliedOperations.push({ diagnosticCode: proposal.diagnosticCode, operation: proposal.operation, path: proposal.change.path });
  }

  const resultingFingerprint = createWorkflowFingerprint(candidate);

  const auditEntry = createAuditEntry({
    workflowFingerprint: currentFingerprint,
    resultingFingerprint,
    rawApproval,
    appliedDiagnosticCodes,
    rejectedDiagnosticCodes,
    manualDiagnosticCodes,
  });

  return {
    workflow: candidate,
    originalFingerprint: currentFingerprint,
    resultingFingerprint,
    appliedDiagnosticCodes,
    rejectedDiagnosticCodes,
    manualDiagnosticCodes,
    auditEntry,
  };
}
