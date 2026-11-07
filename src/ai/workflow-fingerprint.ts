
import { createHash } from "node:crypto";

export class WorkflowFingerprintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowFingerprintError";
  }
}

function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

/**
 * Converts JSON-compatible data into a deterministic representation.
 *
 * Object keys are sorted recursively.
 * Array order is preserved.
 * Accessors, cycles, sparse arrays and non-JSON values are rejected.
 */
function canonicalize(
  value: unknown,
  ancestors: WeakSet<object>,
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new WorkflowFingerprintError(
        "Workflow contains a non-finite number.",
      );
    }

    return value;
  }

  if (typeof value !== "object") {
    throw new WorkflowFingerprintError(
      `Workflow contains a non-JSON value: ${typeof value}.`,
    );
  }

  if (ancestors.has(value)) {
    throw new WorkflowFingerprintError(
      "Workflow contains a circular reference.",
    );
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return canonicalizeArray(value, ancestors);
    }

    if (!isPlainRecord(value)) {
      throw new WorkflowFingerprintError(
        "Workflow contains a non-plain object.",
      );
    }

    return canonicalizeRecord(value, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

function canonicalizeArray(
  value: unknown[],
  ancestors: WeakSet<object>,
): unknown[] {
  // JSON.parse() creates arrays with Array.prototype.
  // Reject arrays whose prototype has been modified.
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new WorkflowFingerprintError(
      "Workflow contains an array with a custom prototype.",
    );
  }

  const ownKeys = Reflect.ownKeys(value);

  // A dense standard array has exactly one own property per
  // element, plus its non-enumerable "length" property.
  // This also rejects sparse arrays without iterating over
  // a potentially enormous length.
  if (ownKeys.length !== value.length + 1) {
    throw new WorkflowFingerprintError(
      "Workflow contains a sparse array or unexpected array properties.",
    );
  }

  const result: unknown[] = new Array(value.length);

  for (const key of ownKeys) {
    if (key === "length") {
      continue;
    }

    if (
      typeof key !== "string" ||
      !/^(0|[1-9]\d*)$/.test(key)
    ) {
      throw new WorkflowFingerprintError(
        "Workflow contains an array with unexpected properties.",
      );
    }

    const index = Number(key);

    // ECMAScript array indices range from 0 to 2^32 - 2.
    // Every actual element index must also be below length.
    if (
      !Number.isSafeInteger(index) ||
      index > 4_294_967_294 ||
      index >= value.length
    ) {
      throw new WorkflowFingerprintError(
        `Workflow contains an invalid array index: ${key}.`,
      );
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      value,
      key,
    );

    if (
      !descriptor ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    ) {
      throw new WorkflowFingerprintError(
        `Workflow contains an invalid array element at index ${index}.`,
      );
    }

    result[index] = canonicalize(
      descriptor.value,
      ancestors,
    );
  }

  return result;
}

function canonicalizeRecord(
  value: Record<string, unknown>,
  ancestors: WeakSet<object>,
): Record<string, unknown> {
  const ownKeys = Reflect.ownKeys(value);

  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new WorkflowFingerprintError(
      "Workflow contains symbol properties.",
    );
  }

  const keys = (ownKeys as string[]).sort();
  const result = Object.create(null) as Record<string, unknown>;

  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(
      value,
      key,
    );

    if (
      !descriptor ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    ) {
      throw new WorkflowFingerprintError(
        `Workflow contains an invalid property: ${key}.`,
      );
    }

    Object.defineProperty(result, key, {
      value: canonicalize(descriptor.value, ancestors),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  return result;
}

/**
 * Computes a SHA-256 fingerprint of a workflow.
 *
 * Equivalent JSON objects with different property insertion
 * orders produce the same fingerprint.
 *
 * Array order remains significant.
 */
export function createWorkflowFingerprint(
  workflow: unknown,
): string {
  if (!isPlainRecord(workflow)) {
    throw new WorkflowFingerprintError(
      "Workflow root must be a plain JSON object.",
    );
  }

  const canonicalWorkflow = canonicalize(
    workflow,
    new WeakSet<object>(),
  );

  const serialized = JSON.stringify(canonicalWorkflow);

  return createHash("sha256")
    .update(serialized, "utf8")
    .digest("hex");
}
