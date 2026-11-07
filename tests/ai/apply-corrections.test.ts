
import { describe, expect, it } from "vitest";

import {
  applyCorrections,
  CorrectionApplicationError,
  StaleWorkflowError,
} from "../../src/ai/apply-corrections.js";

import type { GeneratedCorrectionSet } from "../../src/ai/generate-corrections.js";
import type { CorrectionProposal } from "../../src/ai/schemas/correction.schema.js";

import {
  AuditEntrySchema,
} from "../../src/ai/schemas/audit.schema.js";

import { createWorkflowFingerprint } from "../../src/ai/workflow-fingerprint.js";

const originalWorkflow = {
  name: "Test workflow",
  settings: {
    oldProperty: true,
    executionOrder: "v1",
  },
};

function createGeneratedSet(
  workflow: unknown,
  proposals: CorrectionProposal[],
): GeneratedCorrectionSet {
  return {
    workflowFingerprint: createWorkflowFingerprint(workflow),
    corrections: {
      summary: "Test corrections",
      proposals,
      unaddressedDiagnosticCodes: [],
    },
  };
}

function createApproval(
  proposals: CorrectionProposal[],
  rejectedCodes: string[] = [],
) {
  return {
    decisions: proposals.map((proposal) => ({
      diagnosticCode: proposal.diagnosticCode,
      decision: rejectedCodes.includes(proposal.diagnosticCode)
        ? ("rejected" as const)
        : ("approved" as const),
    })),
  };
}

function createReplaceProposal(
  diagnosticCode: string,
  path: string,
  value: unknown,
): CorrectionProposal {
  return {
    diagnosticCode,
    title: "Replace property",
    description: "Replace an existing property.",
    proposedChange: "Replace the specified value.",
    confidence: "high",
    risk: "low",
    requiresHumanApproval: true,
    operation: "replace",
    change: {
      path,
      value,
    },
  };
}

function createAddProposal(
  diagnosticCode: string,
  path: string,
  value: unknown,
): CorrectionProposal {
  return {
    diagnosticCode,
    title: "Add property",
    description: "Add a new property.",
    proposedChange: "Add the specified value.",
    confidence: "high",
    risk: "low",
    requiresHumanApproval: true,
    operation: "add",
    change: {
      path,
      value,
    },
  };
}

function createRemoveProposal(
  diagnosticCode: string,
  path: string,
): CorrectionProposal {
  return {
    diagnosticCode,
    title: "Remove property",
    description: "Remove the specified property.",
    proposedChange: "Remove the specified property.",
    confidence: "high",
    risk: "low",
    requiresHumanApproval: true,
    operation: "remove",
    change: {
      path,
    },
  };
}

function createManualProposal(
  diagnosticCode: string,
): CorrectionProposal {
  return {
    diagnosticCode,
    title: "Manual correction",
    description: "This correction requires manual intervention.",
    proposedChange: "Review and correct the workflow manually.",
    confidence: "medium",
    risk: "medium",
    requiresHumanApproval: true,
    operation: "manual",
  };
}

describe("applyCorrections", () => {
  it("applies approved add, replace and remove operations", () => {
    const proposals: CorrectionProposal[] = [
      createReplaceProposal(
        "REPLACE_NAME",
        "/name",
        "Updated workflow",
      ),
      createAddProposal(
        "ADD_SETTING",
        "/settings/newProperty",
        "enabled",
      ),
      createRemoveProposal(
        "REMOVE_OLD_SETTING",
        "/settings/oldProperty",
      ),
    ];

    const generated = createGeneratedSet(
      originalWorkflow,
      proposals,
    );

    const approval = createApproval(proposals);

    const result = applyCorrections(
      originalWorkflow,
      generated,
      approval,
    );

    expect(result.workflow).toEqual({
      name: "Updated workflow",
      settings: {
        executionOrder: "v1",
        newProperty: "enabled",
      },
    });

    expect(result.appliedDiagnosticCodes).toEqual([
      "REPLACE_NAME",
      "ADD_SETTING",
      "REMOVE_OLD_SETTING",
    ]);

    expect(result.rejectedDiagnosticCodes).toEqual([]);
    expect(result.manualDiagnosticCodes).toEqual([]);

    expect(result.resultingFingerprint).toBe(
      createWorkflowFingerprint(result.workflow),
    );

    expect(
      AuditEntrySchema.safeParse(result.auditEntry).success,
    ).toBe(true);

    expect(result.auditEntry).toMatchObject({
      workflowFingerprint: generated.workflowFingerprint,
      resultingFingerprint: result.resultingFingerprint,
      appliedDiagnosticCodes: [
        "REPLACE_NAME",
        "ADD_SETTING",
        "REMOVE_OLD_SETTING",
      ],
      rejectedDiagnosticCodes: [],
      manualDiagnosticCodes: [],
      status: "completed",
    });

    expect(result.auditEntry.decisions).toEqual(
      approval.decisions,
    );
  });

  it("does not apply rejected proposals", () => {
    const proposals: CorrectionProposal[] = [
      createReplaceProposal(
        "REPLACE_NAME",
        "/name",
        "Updated workflow",
      ),
    ];

    const generated = createGeneratedSet(
      originalWorkflow,
      proposals,
    );

    const approval = createApproval(
      proposals,
      ["REPLACE_NAME"],
    );

    const result = applyCorrections(
      originalWorkflow,
      generated,
      approval,
    );

    expect(result.workflow).toEqual(originalWorkflow);
    expect(result.appliedDiagnosticCodes).toEqual([]);
    expect(result.rejectedDiagnosticCodes).toEqual([
      "REPLACE_NAME",
    ]);

    expect(result.auditEntry.rejectedDiagnosticCodes).toEqual([
      "REPLACE_NAME",
    ]);

    expect(result.auditEntry.appliedDiagnosticCodes).toEqual([]);

    expect(result.auditEntry.status).toBe("no_changes");

    expect(result.auditEntry.decisions).toEqual(
      approval.decisions,
    );
  });

  it("does not automatically apply approved manual proposals", () => {
    const proposals: CorrectionProposal[] = [
      createManualProposal("MANUAL_REVIEW"),
    ];

    const generated = createGeneratedSet(
      originalWorkflow,
      proposals,
    );

    const result = applyCorrections(
      originalWorkflow,
      generated,
      createApproval(proposals),
    );

    expect(result.workflow).toEqual(originalWorkflow);
    expect(result.appliedDiagnosticCodes).toEqual([]);
    expect(result.manualDiagnosticCodes).toEqual([
      "MANUAL_REVIEW",
    ]);

    expect(result.auditEntry.manualDiagnosticCodes).toEqual([
      "MANUAL_REVIEW",
    ]);

    expect(result.auditEntry.appliedDiagnosticCodes).toEqual([]);

    expect(result.auditEntry.status).toBe(
      "completed_with_manual_actions",
    );
  });

  it("rejects a workflow that changed after correction generation", () => {
    const proposals: CorrectionProposal[] = [
      createReplaceProposal(
        "REPLACE_NAME",
        "/name",
        "Updated workflow",
      ),
    ];

    const generated = createGeneratedSet(
      originalWorkflow,
      proposals,
    );

    const modifiedWorkflow = {
      ...originalWorkflow,
      name: "Modified externally",
    };

    expect(() =>
      applyCorrections(
        modifiedWorkflow,
        generated,
        createApproval(proposals),
      ),
    ).toThrow(StaleWorkflowError);
  });

  it("rejects incomplete human approval", () => {
    const proposals: CorrectionProposal[] = [
      createReplaceProposal(
        "REPLACE_NAME",
        "/name",
        "Updated workflow",
      ),
    ];

    const generated = createGeneratedSet(
      originalWorkflow,
      proposals,
    );

    expect(() =>
      applyCorrections(
        originalWorkflow,
        generated,
        { decisions: [] },
      ),
    ).toThrow(CorrectionApplicationError);
  });

  it("does not expose partially applied corrections when an operation fails", () => {
    const proposals: CorrectionProposal[] = [
      createReplaceProposal(
        "VALID_REPLACEMENT",
        "/name",
        "Updated workflow",
      ),
      createReplaceProposal(
        "INVALID_REPLACEMENT",
        "/settings/nonexistent",
        "invalid",
      ),
    ];

    const generated = createGeneratedSet(
      originalWorkflow,
      proposals,
    );

    const workflowBeforeApplication = structuredClone(
      originalWorkflow,
    );

    expect(() =>
      applyCorrections(
        originalWorkflow,
        generated,
        createApproval(proposals),
      ),
    ).toThrow(CorrectionApplicationError);

    expect(originalWorkflow).toEqual(
      workflowBeforeApplication,
    );
  });

  it("never mutates the original workflow", () => {
    const proposals: CorrectionProposal[] = [
      createReplaceProposal(
        "REPLACE_NAME",
        "/name",
        "Updated workflow",
      ),
      createAddProposal(
        "ADD_SETTING",
        "/settings/newProperty",
        true,
      ),
    ];

    const generated = createGeneratedSet(
      originalWorkflow,
      proposals,
    );

    const originalSnapshot = structuredClone(
      originalWorkflow,
    );

    const result = applyCorrections(
      originalWorkflow,
      generated,
      createApproval(proposals),
    );

    expect(originalWorkflow).toEqual(originalSnapshot);

    expect(result.workflow).not.toBe(originalWorkflow);

    expect(result.workflow.settings).not.toBe(
      originalWorkflow.settings,
    );
  });

  it("supports JSON Pointer escaped property names", () => {
    const workflow = {
      settings: {
        "execution/order": "v1",
      },
    };

    const proposals: CorrectionProposal[] = [
      createReplaceProposal(
        "REPLACE_EXECUTION_ORDER",
        "/settings/execution~1order",
        "v2",
      ),
    ];

    const generated = createGeneratedSet(
      workflow,
      proposals,
    );

    const result = applyCorrections(
      workflow,
      generated,
      createApproval(proposals),
    );

    expect(result.workflow).toEqual({
      settings: {
        "execution/order": "v2",
      },
    });

    expect(result.auditEntry.appliedDiagnosticCodes).toEqual([
      "REPLACE_EXECUTION_ORDER",
    ]);
  });

  it("records applied, rejected and manual decisions in the audit entry", () => {
    const proposals: CorrectionProposal[] = [
      createReplaceProposal(
        "REPLACE_NAME",
        "/name",
        "Updated workflow",
      ),
      createReplaceProposal(
        "REJECT_SETTING",
        "/settings/executionOrder",
        "v2",
      ),
      createManualProposal("MANUAL_REVIEW"),
    ];

    const generated = createGeneratedSet(
      originalWorkflow,
      proposals,
    );

    const approval = createApproval(
      proposals,
      ["REJECT_SETTING"],
    );

    const result = applyCorrections(
      originalWorkflow,
      generated,
      approval,
    );

    expect(result.auditEntry).toMatchObject({
      workflowFingerprint: generated.workflowFingerprint,
      resultingFingerprint: result.resultingFingerprint,
      appliedDiagnosticCodes: ["REPLACE_NAME"],
      rejectedDiagnosticCodes: ["REJECT_SETTING"],
      manualDiagnosticCodes: ["MANUAL_REVIEW"],
      status: "completed_with_manual_actions",
    });

    expect(result.auditEntry.decisions).toEqual(
      approval.decisions,
    );

    expect(
      AuditEntrySchema.safeParse(result.auditEntry).success,
    ).toBe(true);

    expect(result.workflow).toEqual({
      name: "Updated workflow",
      settings: {
        oldProperty: true,
        executionOrder: "v1",
      },
    });
  });

  it("applies only the value validated by Zod, not a later value from the original proposal", () => {
    const proposal = createReplaceProposal(
      "REPLACE_NAME",
      "/name",
      "Initial value",
    ) as Extract<CorrectionProposal, { operation: "replace" }>;

    let readCount = 0;

    Object.defineProperty(proposal.change, "value", {
      get() {
        readCount += 1;

        return readCount === 1
          ? "Validated value"
          : "Tampered value";
      },
      enumerable: true,
      configurable: true,
    });

    const proposals: CorrectionProposal[] = [proposal];

    const generated = createGeneratedSet(
      originalWorkflow,
      proposals,
    );

    const result = applyCorrections(
      originalWorkflow,
      generated,
      createApproval(proposals),
    );

    expect(readCount).toBeGreaterThan(0);

    expect(result.workflow).toEqual({
      name: "Validated value",
      settings: {
        oldProperty: true,
        executionOrder: "v1",
      },
    });

    expect(result.workflow.name).not.toBe("Tampered value");

    expect(result.appliedDiagnosticCodes).toEqual([
      "REPLACE_NAME",
    ]);
  });
});
