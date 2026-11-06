import { ReducedValue, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

// 1. Structure d'un diagnostic
export const DiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string().min(1),
  path: z.string().optional(),
});

export type Diagnostic = z.infer<typeof DiagnosticSchema>;

// 2. État partagé du moteur
export const FlowProofState = new StateSchema({
  rawInput: z.string(),

  parsedWorkflow: z.unknown().nullable().default(null),

  diagnostics: new ReducedValue(
    z.array(DiagnosticSchema).default([]),
    {
      reducer: (current, update) => [...current, ...update],
    },
  ),

  report: z.unknown().nullable().default(null),
});

export type FlowProofStateType = typeof FlowProofState.State;