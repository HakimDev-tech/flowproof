
import { describe, expect, it, vi } from "vitest";

import {
  generateCorrections,
  type GenerateCorrectionsInput,
} from "../../src/ai/generate-corrections.js";

import type { AnalysisResult } from "../../src/ai/schemas/analysis.schema.js";

import type { CorrectionResult } from "../../src/ai/schemas/correction.schema.js";

import { createWorkflowFingerprint } from "../../src/ai/workflow-fingerprint.js";

const diagnostics = [
  {
    code: "MISSING_WORKFLOW_NAME",
    severity: "warning" as const,
    message: "Workflow name is missing",
  },
  {
    code: "INVALID_WORKFLOW_ROOT",
    severity: "error" as const,
    message: "Workflow must be a JSON object",
  },
];

const analysis: AnalysisResult = {
  summary: "The workflow contains two structural issues.",
  overallAssessment: "critical",
  findings: [
    {
      diagnosticCode: "MISSING_WORKFLOW_NAME",
      explanation: "The workflow name is missing.",
      suggestedAction: "Provide a meaningful workflow name.",
      confidence: "high",
    },
    {
      diagnosticCode: "INVALID_WORKFLOW_ROOT",
      explanation: "The workflow root is not a JSON object.",
      suggestedAction: "Use a JSON object as the workflow root.",
      confidence: "high",
    },
  ],
  unaddressedDiagnosticCodes: [],
};

function createCorrectionResult(
  diagnosticCodes: string[],
): CorrectionResult {
  return {
    summary: "Correction proposals generated.",
    proposals: diagnosticCodes.map((diagnosticCode) => ({
      diagnosticCode,
      title: "Review workflow configuration",
      description: "The workflow contains a configuration issue.",
      proposedChange: "Review and correct the configuration manually.",
      operation: "manual",
      confidence: "high",
      risk: "low",
      requiresHumanApproval: true,
    })),
    unaddressedDiagnosticCodes: [],
  };
}

function createInput(
  overrides: Partial<GenerateCorrectionsInput> = {},
): GenerateCorrectionsInput {
  return {
    workflowName: "FlowProof test workflow",
    workflow: {
      nodes: [],
      connections: {},
    },
    diagnostics,
    analysis,
    ...overrides,
  };
}

describe("generateCorrections", () => {
  it("returns corrections bound to the original workflow fingerprint", async () => {
    const input = createInput();

    const expectedCorrections = createCorrectionResult([
      "MISSING_WORKFLOW_NAME",
      "INVALID_WORKFLOW_ROOT",
    ]);

    const invokeCorrectionModel = vi.fn().mockResolvedValue(
      expectedCorrections,
    );

    const result = await generateCorrections(
      input,
      { invokeCorrectionModel },
    );

    expect(result).toEqual({
      workflowFingerprint: createWorkflowFingerprint(input.workflow),
      corrections: expectedCorrections,
    });

    expect(invokeCorrectionModel).toHaveBeenCalledTimes(1);
  });

  it("produces a different fingerprint when the workflow changes", async () => {
    const firstInput = createInput({
      workflow: {
        name: "Workflow A",
        nodes: [],
      },
    });

    const secondInput = createInput({
      workflow: {
        name: "Workflow B",
        nodes: [],
      },
    });

    const invokeCorrectionModel = vi.fn().mockResolvedValue(
      createCorrectionResult([
        "MISSING_WORKFLOW_NAME",
        "INVALID_WORKFLOW_ROOT",
      ]),
    );

    const firstResult = await generateCorrections(
      firstInput,
      { invokeCorrectionModel },
    );

    const secondResult = await generateCorrections(
      secondInput,
      { invokeCorrectionModel },
    );

    expect(firstResult.workflowFingerprint).not.toBe(
      secondResult.workflowFingerprint,
    );
  });

  it("does not allow the model to control the workflow fingerprint", async () => {
    const invalidResult = {
      ...createCorrectionResult([
        "MISSING_WORKFLOW_NAME",
        "INVALID_WORKFLOW_ROOT",
      ]),
      workflowFingerprint: "model-controlled-fingerprint",
    };

    const invokeCorrectionModel = vi.fn().mockResolvedValue(
      invalidResult,
    );

    await expect(
      generateCorrections(
        createInput(),
        { invokeCorrectionModel },
      ),
    ).rejects.toThrow();

  });

  it("rejects an unknown diagnostic code", async () => {
    const invalidResult = createCorrectionResult([
      "MISSING_WORKFLOW_NAME",
      "UNKNOWN_DIAGNOSTIC",
    ]);

    const invokeCorrectionModel = vi.fn().mockResolvedValue(
      invalidResult,
    );

    await expect(
      generateCorrections(
        createInput(),
        { invokeCorrectionModel },
      ),
    ).rejects.toThrow(
      "Unknown diagnostic code returned: UNKNOWN_DIAGNOSTIC",
    );
  });

  it("rejects an omitted diagnostic code", async () => {
    const incompleteResult = createCorrectionResult([
      "MISSING_WORKFLOW_NAME",
    ]);

    const invokeCorrectionModel = vi.fn().mockResolvedValue(
      incompleteResult,
    );

    await expect(
      generateCorrections(
        createInput(),
        { invokeCorrectionModel },
      ),
    ).rejects.toThrow(
      "Diagnostic code was not classified: INVALID_WORKFLOW_ROOT",
    );
  });

  it("rejects duplicate diagnostic classifications", async () => {
    const duplicateResult = createCorrectionResult([
      "MISSING_WORKFLOW_NAME",
      "MISSING_WORKFLOW_NAME",
      "INVALID_WORKFLOW_ROOT",
    ]);

    const invokeCorrectionModel = vi.fn().mockResolvedValue(
      duplicateResult,
    );

    await expect(
      generateCorrections(
        createInput(),
        { invokeCorrectionModel },
      ),
    ).rejects.toThrow(
      "A diagnostic code was classified more than once.",
    );
  });

  it("rejects an analysis that references unknown diagnostics", async () => {
    const inconsistentAnalysis: AnalysisResult = {
      ...analysis,
      findings: [
        {
          diagnosticCode: "UNKNOWN_DIAGNOSTIC",
          explanation: "Unknown diagnostic.",
          suggestedAction: "Review it.",
          confidence: "low",
        },
        analysis.findings[1],
      ],
    };

    const invokeCorrectionModel = vi.fn();

    await expect(
      generateCorrections(
        createInput({ analysis: inconsistentAnalysis }),
        { invokeCorrectionModel },
      ),
    ).rejects.toThrow(
      "Gemini returned an unknown diagnostic code: UNKNOWN_DIAGNOSTIC",
    );

    expect(invokeCorrectionModel).not.toHaveBeenCalled();
  });

  it("rejects a response that does not match the correction schema", async () => {
    const invalidResult = {
      summary: "Invalid result",
      proposals: [
        {
          diagnosticCode: "MISSING_WORKFLOW_NAME",
          title: "Add workflow name",
        },
      ],
      unaddressedDiagnosticCodes: [],
    };

    const invokeCorrectionModel = vi.fn().mockResolvedValue(
      invalidResult,
    );

    await expect(
      generateCorrections(
        createInput(),
        { invokeCorrectionModel },
      ),
    ).rejects.toThrow();
  });

  it("rejects a correction that does not require human approval", async () => {
    const validResult = createCorrectionResult([
      "MISSING_WORKFLOW_NAME",
      "INVALID_WORKFLOW_ROOT",
    ]);

    const invalidResult = {
      ...validResult,
      proposals: validResult.proposals.map((proposal) => ({
        ...proposal,
        requiresHumanApproval: false,
      })),
    };

    const invokeCorrectionModel = vi.fn().mockResolvedValue(
      invalidResult,
    );

    await expect(
      generateCorrections(
        createInput(),
        { invokeCorrectionModel },
      ),
    ).rejects.toThrow();
  });

  it("does not invoke the model when there are no diagnostics", async () => {
    const input = createInput({
      diagnostics: [],
      analysis: {
        summary: "No diagnostics were found.",
        overallAssessment: "healthy",
        findings: [],
        unaddressedDiagnosticCodes: [],
      },
    });

    const invokeCorrectionModel = vi.fn();

    const result = await generateCorrections(
      input,
      { invokeCorrectionModel },
    );

    expect(result).toEqual({
      workflowFingerprint: createWorkflowFingerprint(input.workflow),
      corrections: {
        summary:
          "No corrections are required because no diagnostics were produced.",
        proposals: [],
        unaddressedDiagnosticCodes: [],
      },
    });

    expect(invokeCorrectionModel).not.toHaveBeenCalled();
  });

  it("rejects an empty workflow name before invoking the model", async () => {
    const invokeCorrectionModel = vi.fn();

    await expect(
      generateCorrections(
        createInput({ workflowName: "   " }),
        { invokeCorrectionModel },
      ),
    ).rejects.toThrow("Workflow name cannot be empty.");

    expect(invokeCorrectionModel).not.toHaveBeenCalled();
  });

  it("rejects a workflow that cannot be fingerprinted", async () => {
    const circularWorkflow: Record<string, unknown> = {};
    circularWorkflow.self = circularWorkflow;

    const invokeCorrectionModel = vi.fn();

    await expect(
      generateCorrections(
        createInput({ workflow: circularWorkflow }),
        { invokeCorrectionModel },
      ),
    ).rejects.toThrow(
      "Workflow contains a circular reference.",
    );

    expect(invokeCorrectionModel).not.toHaveBeenCalled();
  });
});
