
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  Command,
  END,
  interrupt,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import * as z from "zod";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

const ApprovalResponseSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reviewer: z.string().min(1),
});

const ApprovalState = new StateSchema({
  workflowName: z.string().default(""),
  decision: z.enum(["approve", "reject"]).nullable().default(null),
  reviewer: z.string().default(""),
  outcome: z.string().default("pending"),
});

type ApprovalCallbacks = {
  onApprovalNodeExecution: () => void;
};

function createApprovalGraph(
  checkpointer: PostgresSaver,
  callbacks: ApprovalCallbacks,
) {
  return new StateGraph(ApprovalState)
    .addNode("requestApproval", (state) => {
      callbacks.onApprovalNodeExecution();

      const response = ApprovalResponseSchema.parse(
        interrupt({
          type: "workflow_approval_required",
          workflowName: state.workflowName,
          question: "Do you approve this workflow?",
          options: ["approve", "reject"],
        }),
      );

      return {
        decision: response.decision,
        reviewer: response.reviewer,
      };
    })
    .addNode("applyDecision", (state) => {
      return {
        outcome:
          state.decision === "approve"
            ? "approved"
            : "rejected",
      };
    })
    .addEdge(START, "requestApproval")
    .addEdge("requestApproval", "applyDecision")
    .addEdge("applyDecision", END)
    .compile({ checkpointer });
}

describe.skipIf(!connectionString)(
  "PostgreSQL interrupt integration",
  () => {
    const activeCheckpointers: PostgresSaver[] = [];

    async function createCheckpointer() {
      const checkpointer =
        PostgresSaver.fromConnString(connectionString!);

      activeCheckpointers.push(checkpointer);
      await checkpointer.setup();

      return checkpointer;
    }

    async function closeCheckpointer(
      checkpointer: PostgresSaver,
    ) {
      await checkpointer.end();

      const index = activeCheckpointers.indexOf(checkpointer);

      if (index !== -1) {
        activeCheckpointers.splice(index, 1);
      }
    }

    function createConfig(threadId: string) {
      return {
        configurable: {
          thread_id: threadId,
        },
      };
    }

    function createCallbacks() {
      let executions = 0;

      return {
        callbacks: {
          onApprovalNodeExecution: () => {
            executions += 1;
          },
        },
        getExecutions: () => executions,
      };
    }

    async function expectApprovalInterrupt(
      graph: ReturnType<typeof createApprovalGraph>,
      config: ReturnType<typeof createConfig>,
      workflowName: string,
    ) {
      const result = await graph.invoke(
        { workflowName },
        config,
      );

      const interrupts = (
        result as unknown as {
          __interrupt__?: Array<{ value: unknown }>;
        }
      ).__interrupt__;

      expect(interrupts).toHaveLength(1);

      expect(interrupts?.[0]?.value).toEqual({
        type: "workflow_approval_required",
        workflowName,
        question: "Do you approve this workflow?",
        options: ["approve", "reject"],
      });

      return result;
    }

    afterAll(async () => {
      await Promise.all(
        activeCheckpointers.map((checkpointer) =>
          checkpointer.end(),
        ),
      );
    });

    it("pauses for human approval and resumes after PostgreSQL reconnection", async () => {
      const threadId = `postgres-interrupt-${randomUUID()}`;
      const config = createConfig(threadId);

      const { callbacks, getExecutions } = createCallbacks();

      const firstCheckpointer = await createCheckpointer();

      try {
        const firstGraph = createApprovalGraph(
          firstCheckpointer,
          callbacks,
        );

        // 1. Première exécution : le graphe doit être suspendu.
        await expectApprovalInterrupt(
          firstGraph,
          config,
          "Customer onboarding",
        );

        expect(getExecutions()).toBe(1);

        // 2. Vérification de l'état sauvegardé.
        const interruptedSnapshot =
          await firstGraph.getState(config);

        expect(interruptedSnapshot.next).toEqual([
          "requestApproval",
        ]);

        expect(interruptedSnapshot.values.outcome).toBe(
          "pending",
        );

        expect(interruptedSnapshot.values.decision).toBeNull();

        // 3. Fermeture de la première connexion.
        await closeCheckpointer(firstCheckpointer);

        // 4. Nouvelle connexion et nouvelle instance du graphe.
        const secondCheckpointer = await createCheckpointer();

        try {
          const secondGraph = createApprovalGraph(
            secondCheckpointer,
            callbacks,
          );

          // 5. Transmission de la décision humaine.
          const resumedResult = await secondGraph.invoke(
            new Command({
              resume: {
                decision: "approve",
                reviewer: "Hakim",
              },
            }),
            config,
          );

          // 6. Vérification du résultat final.
          expect(resumedResult.decision).toBe("approve");
          expect(resumedResult.reviewer).toBe("Hakim");
          expect(resumedResult.outcome).toBe("approved");

          // Le nœud interrompu redémarre depuis son début.
          expect(getExecutions()).toBe(2);

          const finalSnapshot =
            await secondGraph.getState(config);

          expect(finalSnapshot.next).toEqual([]);
          expect(finalSnapshot.values.outcome).toBe(
            "approved",
          );
        } finally {
          await secondCheckpointer.deleteThread(threadId);
          await closeCheckpointer(secondCheckpointer);
        }
      } finally {
        if (activeCheckpointers.includes(firstCheckpointer)) {
          await closeCheckpointer(firstCheckpointer);
        }
      }
    });

    it("applies the rejection decision correctly", async () => {
      const threadId = `postgres-rejection-${randomUUID()}`;
      const config = createConfig(threadId);

      const { callbacks, getExecutions } = createCallbacks();

      const checkpointer = await createCheckpointer();

      try {
        const graph = createApprovalGraph(
          checkpointer,
          callbacks,
        );

        // 1. Le workflow attend une décision.
        await expectApprovalInterrupt(
          graph,
          config,
          "Payment processing",
        );

        expect(getExecutions()).toBe(1);

        // 2. Le reviewer refuse la proposition.
        const result = await graph.invoke(
          new Command({
            resume: {
              decision: "reject",
              reviewer: "Reviewer A",
            },
          }),
          config,
        );

        // 3. Vérification de la décision appliquée.
        expect(result.decision).toBe("reject");
        expect(result.reviewer).toBe("Reviewer A");
        expect(result.outcome).toBe("rejected");

        expect(getExecutions()).toBe(2);

        const snapshot = await graph.getState(config);

        expect(snapshot.next).toEqual([]);
        expect(snapshot.values.outcome).toBe("rejected");
      } finally {
        await checkpointer.deleteThread(threadId);
        await closeCheckpointer(checkpointer);
      }
    });

    it("isolates approval decisions between independent threads", async () => {
      const threadIdA = `postgres-isolation-a-${randomUUID()}`;
      const threadIdB = `postgres-isolation-b-${randomUUID()}`;

      const configA = createConfig(threadIdA);
      const configB = createConfig(threadIdB);

      const { callbacks, getExecutions } = createCallbacks();

      const checkpointer = await createCheckpointer();

      try {
        const graph = createApprovalGraph(
          checkpointer,
          callbacks,
        );

        // 1. Deux workflows sont interrompus indépendamment.
        await expectApprovalInterrupt(
          graph,
          configA,
          "Workflow A",
        );

        await expectApprovalInterrupt(
          graph,
          configB,
          "Workflow B",
        );

        expect(getExecutions()).toBe(2);

        // 2. Vérification de l'isolation initiale.
        const snapshotA = await graph.getState(configA);
        const snapshotB = await graph.getState(configB);

        expect(snapshotA.values.workflowName).toBe("Workflow A");
        expect(snapshotB.values.workflowName).toBe("Workflow B");

        expect(snapshotA.values.decision).toBeNull();
        expect(snapshotB.values.decision).toBeNull();

        expect(snapshotA.next).toEqual(["requestApproval"]);
        expect(snapshotB.next).toEqual(["requestApproval"]);

        // 3. Le workflow A est approuvé.
        const resultA = await graph.invoke(
          new Command({
            resume: {
              decision: "approve",
              reviewer: "Reviewer A",
            },
          }),
          configA,
        );

        expect(resultA.outcome).toBe("approved");
        expect(resultA.reviewer).toBe("Reviewer A");

        // 4. Le workflow B doit toujours être en attente.
        const snapshotBAfterApproval =
          await graph.getState(configB);

        expect(snapshotBAfterApproval.values.decision).toBeNull();
        expect(snapshotBAfterApproval.values.outcome).toBe(
          "pending",
        );

        expect(snapshotBAfterApproval.next).toEqual([
          "requestApproval",
        ]);

        // 5. Le workflow B est refusé indépendamment.
        const resultB = await graph.invoke(
          new Command({
            resume: {
              decision: "reject",
              reviewer: "Reviewer B",
            },
          }),
          configB,
        );

        expect(resultB.outcome).toBe("rejected");
        expect(resultB.reviewer).toBe("Reviewer B");

        // 6. Vérification de l'indépendance des résultats.
        const finalSnapshotA = await graph.getState(configA);
        const finalSnapshotB = await graph.getState(configB);

        expect(finalSnapshotA.values.decision).toBe("approve");
        expect(finalSnapshotA.values.outcome).toBe("approved");

        expect(finalSnapshotB.values.decision).toBe("reject");
        expect(finalSnapshotB.values.outcome).toBe("rejected");

        expect(finalSnapshotA.next).toEqual([]);
        expect(finalSnapshotB.next).toEqual([]);

        expect(getExecutions()).toBe(4);
      } finally {
        await checkpointer.deleteThread(threadIdA);
        await checkpointer.deleteThread(threadIdB);
        await closeCheckpointer(checkpointer);
      }
    });
  },
);
