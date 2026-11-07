import * as z from "zod";

export const AnalysisFindingSchema = z.object({
  diagnosticCode: z.string().min(1),
  explanation: z.string().min(1),
  suggestedAction: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
});

export const AnalysisResultSchema = z.object({
  summary: z.string().min(1),
  overallAssessment: z.enum([
    "healthy",
    "warning",
    "critical",
  ]),
  findings: z.array(AnalysisFindingSchema),
  unaddressedDiagnosticCodes: z.array(z.string().min(1)),
});

export type AnalysisFinding = z.infer<
  typeof AnalysisFindingSchema
>;

export type AnalysisResult = z.infer<
  typeof AnalysisResultSchema
>;