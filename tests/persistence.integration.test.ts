
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  END,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import * as z from "zod";

import { createWorkflowGraph } from "../src/graph/workflow.graph.js";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

const RecoveryState = new StateSchema({
  prepared: z.boolean().default(false),
  result: z.string().default(""),
});

type RecoveryCallbacks = {
  onPrepare: () => void;
  onUnstable: () => void;
  getAttempts: () => number;
};

function createRecoveryGraph(
  checkpointer: PostgresSaver,
  callbacks: RecoveryCallbacks,
) {
  return new StateGraph(RecoveryState)
    .addNode("prepare", () => {
      callbacks.onPrepare();

      return { prepared: true };
    })
    .addNode(
      "unstable",
      () => {
        callbacks.onUnstable();

        if (callbacks.getAttempts() === 1) {
          throw new Error("Temporary failure");
        }

        return { result: "recovered" };
      },
      {
        retryPolicy: {
          maxAttempts: 1,
        },
      },
    )
    .addEdge(START, "prepare")
    .addEdge(START, "unstable")
    .addEdge("prepare", END)
    .addEdge("unstable", END)
    .compile({ checkpointer });
}

describe.skipIf(!connectionString)(
  "PostgreSQL persistence integration",
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

    afterAll(async () => {
      await Promise.all(
        activeCheckpointers.map((checkpointer) =>
          checkpointer.end(),
        ),
      );
    });

    it("restores workflow state after reopening the connection", async () => {
      const threadId = `postgres-persistence-${randomUUID()}`;

      const config = {
        configurable: {
          thread_id: threadId,
        },
      };

      const firstCheckpointer = await createCheckpointer();

      const firstGraph = createWorkflowGraph(firstCheckpointer);

      try {
        await firstGraph.invoke(
          {
            rawInput: JSON.stringify({
              name: "Persistent workflow",
            }),
          },
          config,
        );

        await closeCheckpointer(firstCheckpointer);

        const secondCheckpointer = await createCheckpointer();

        try {
          const secondGraph =
            createWorkflowGraph(secondCheckpointer);

          const snapshot = await secondGraph.getState(config);

          expect(snapshot.values.parsedWorkflow).toEqual({
            name: "Persistent workflow",
          });

          expect(snapshot.values.diagnostics).toEqual([]);
          expect(snapshot.next).toEqual([]);
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

    it("does not rerun a successful parallel node after a failure and reconnection", async () => {
      const threadId = `postgres-recovery-${randomUUID()}`;

      const config = {
        configurable: {
          thread_id: threadId,
        },
      };

      let prepareExecutions = 0;
      let unstableAttempts = 0;

      const callbacks: RecoveryCallbacks = {
        onPrepare: () => {
          prepareExecutions += 1;
        },
        onUnstable: () => {
          unstableAttempts += 1;
        },
        getAttempts: () => unstableAttempts,
      };

      const firstCheckpointer = await createCheckpointer();

      try {
        const firstGraph = createRecoveryGraph(
          firstCheckpointer,
          callbacks,
        );

        await expect(
          firstGraph.invoke({}, config),
        ).rejects.toThrow("Temporary failure");

        expect(prepareExecutions).toBe(1);
        expect(unstableAttempts).toBe(1);

        const interruptedSnapshot =
          await firstGraph.getState(config);

        // Seul le nœud en échec reste à exécuter.
        expect(interruptedSnapshot.next).toEqual(["unstable"]);

        // Simule la fermeture de l'application et de sa connexion.
        await closeCheckpointer(firstCheckpointer);

        // Nouvelle connexion et nouvelle instance du graphe.
        const secondCheckpointer = await createCheckpointer();

        try {
          const secondGraph = createRecoveryGraph(
            secondCheckpointer,
            callbacks,
          );

          const result = await secondGraph.invoke(null, config);

          expect(result.prepared).toBe(true);
          expect(result.result).toBe("recovered");

          // Le nœud réussi ne doit pas être exécuté une deuxième fois.
          expect(prepareExecutions).toBe(1);

          // Le nœud en échec doit être réessayé.
          expect(unstableAttempts).toBe(2);

          const finalSnapshot =
            await secondGraph.getState(config);

          expect(finalSnapshot.next).toEqual([]);
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
  },
);
