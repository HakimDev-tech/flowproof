
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

import { createWorkflowGraph } from "../src/graph/workflow.graph.js";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

describe.skipIf(!connectionString)("PostgreSQL persistence integration", () => {
  let activeCheckpointers: PostgresSaver[] = [];

  afterAll(async () => {
    await Promise.all(
      activeCheckpointers.map((checkpointer) => checkpointer.end()),
    );
  });

  it("restores workflow state after reopening the connection", async () => {
    if (!connectionString) {
      throw new Error("PostgreSQL connection string is missing");
    }

    const threadId = `postgres-persistence-${randomUUID()}`;

    const config = {
      configurable: {
        thread_id: threadId,
      },
    };

    const firstCheckpointer =
      PostgresSaver.fromConnString(connectionString);

    activeCheckpointers.push(firstCheckpointer);

    await firstCheckpointer.setup();

    const firstGraph = createWorkflowGraph(firstCheckpointer);

    await firstGraph.invoke(
      {
        rawInput: JSON.stringify({
          name: "Persistent workflow",
        }),
      },
      config,
    );

    await firstCheckpointer.end();
    activeCheckpointers = activeCheckpointers.filter(
      (item) => item !== firstCheckpointer,
    );

    // Simule un redémarrage avec une nouvelle connexion PostgreSQL.
    const secondCheckpointer =
      PostgresSaver.fromConnString(connectionString);

    activeCheckpointers.push(secondCheckpointer);

    const secondGraph = createWorkflowGraph(secondCheckpointer);

    const snapshot = await secondGraph.getState(config);

    expect(snapshot.values.parsedWorkflow).toEqual({
      name: "Persistent workflow",
    });

    expect(snapshot.values.diagnostics).toEqual([]);
    expect(snapshot.next).toEqual([]);

    // Nettoyage du thread de test, sans supprimer les tables partagées.
    await secondCheckpointer.deleteThread(threadId);
  });
});
