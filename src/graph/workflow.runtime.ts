import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { createWorkflowGraph } from "./workflow.graph.js";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "Missing PostgreSQL connection string. Configure DATABASE_URL_UNPOOLED or DATABASE_URL.",
  );
}

export const workflowCheckpointer =
  PostgresSaver.fromConnString(connectionString);

export const workflowGraph =
  createWorkflowGraph(workflowCheckpointer);

let setupPromise: Promise<void> | undefined;

export function initializeWorkflowPersistence(): Promise<void> {
  setupPromise ??= workflowCheckpointer.setup();
  return setupPromise;
}

export async function closeWorkflowPersistence(): Promise<void> {
  await workflowCheckpointer.end();
}