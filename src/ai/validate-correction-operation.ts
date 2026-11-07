
import {
  CorrectionProposalSchema,
  type CorrectionProposal,
} from "./schemas/correction.schema.js";

type AutomaticOperation = "add" | "replace" | "remove";

export type CorrectionOperationValidation =
  | {
      valid: true;
      applicable: true;
      operation: AutomaticOperation;
      path: string;
    }
  | {
      valid: true;
      applicable: false;
      operation: "manual";
      reason: string;
    }
  | {
      valid: false;
      applicable: false;
      reason: string;
    };

type PropertyReadResult =
  | {
      valid: true;
      exists: boolean;
      value?: unknown;
    }
  | {
      valid: false;
      reason: string;
    };

const FORBIDDEN_PATH_SEGMENTS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function decodePointerSegment(segment: string): string {
  return segment
    .replace(/~1/g, "/")
    .replace(/~0/g, "~");
}

function readOwnDataProperty(
  container: Record<string, unknown> | unknown[],
  key: string,
): PropertyReadResult {
  const descriptor = Object.getOwnPropertyDescriptor(container, key);

  if (!descriptor) {
    return {
      valid: true,
      exists: false,
    };
  }

  if (!("value" in descriptor)) {
    return {
      valid: false,
      reason: `Accessor properties are not allowed: ${key}`,
    };
  }

  return {
    valid: true,
    exists: true,
    value: descriptor.value,
  };
}

function parseArrayIndex(
  segment: string,
  allowEnd: boolean,
  arrayLength: number,
): number | null {
  if (!/^(0|[1-9]\d*)$/.test(segment)) {
    return null;
  }

  const index = Number(segment);

  if (!Number.isSafeInteger(index)) {
    return null;
  }

  const maximum = allowEnd ? arrayLength : arrayLength - 1;

  if (index < 0 || index > maximum) {
    return null;
  }

  return index;
}

function resolveParent(
  root: Record<string, unknown>,
  segments: string[],
): {
  parent: Record<string, unknown> | unknown[];
  target: string;
} | {
  error: string;
} {
  let current: unknown = root;

  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(current)) {
      const index = parseArrayIndex(
        segment,
        false,
        current.length,
      );

      if (index === null) {
        return {
          error: `Invalid array index in path: ${segment}`,
        };
      }

      const result = readOwnDataProperty(current, String(index));

      if (!result.valid) {
        return { error: result.reason };
      }

      if (!result.exists) {
        return {
          error: `Path does not exist at segment: ${segment}`,
        };
      }

      current = result.value;
      continue;
    }

    if (!isPlainRecord(current)) {
      return {
        error: `Cannot traverse a non-object value at segment: ${segment}`,
      };
    }

    const result = readOwnDataProperty(current, segment);

    if (!result.valid) {
      return { error: result.reason };
    }

    if (!result.exists) {
      return {
        error: `Path does not exist at segment: ${segment}`,
      };
    }

    current = result.value;
  }

  if (!Array.isArray(current) && !isPlainRecord(current)) {
    return {
      error: "The parent of the target path must be an object or array.",
    };
  }

  return {
    parent: current,
    target: segments[segments.length - 1],
  };
}

function validateAutomaticOperation(
  workflow: unknown,
  proposal: Exclude<CorrectionProposal, { operation: "manual" }>,
): CorrectionOperationValidation {
  if (!isPlainRecord(workflow)) {
    return {
      valid: false,
      applicable: false,
      reason: "The workflow root must be a plain JSON object.",
    };
  }

  const segments = proposal.change.path
    .slice(1)
    .split("/")
    .map(decodePointerSegment);

  if (
    segments.some((segment) =>
      FORBIDDEN_PATH_SEGMENTS.has(segment),
    )
  ) {
    return {
      valid: false,
      applicable: false,
      reason: "The path contains a forbidden property segment.",
    };
  }

  const resolution = resolveParent(workflow, segments);

  if ("error" in resolution) {
    return {
      valid: false,
      applicable: false,
      reason: resolution.error,
    };
  }

  const { parent, target } = resolution;

  if (Array.isArray(parent)) {
    if (proposal.operation === "add" && target === "-") {
      return {
        valid: true,
        applicable: true,
        operation: proposal.operation,
        path: proposal.change.path,
      };
    }

    const index = parseArrayIndex(
      target,
      proposal.operation === "add",
      parent.length,
    );

    if (index === null) {
      return {
        valid: false,
        applicable: false,
        reason: `Invalid target array index: ${target}`,
      };
    }

    if (proposal.operation !== "add") {
      const result = readOwnDataProperty(parent, String(index));

      if (!result.valid) {
        return {
          valid: false,
          applicable: false,
          reason: result.reason,
        };
      }

      if (!result.exists) {
        return {
          valid: false,
          applicable: false,
          reason: `Target array index does not exist: ${index}`,
        };
      }
    }

    return {
      valid: true,
      applicable: true,
      operation: proposal.operation,
      path: proposal.change.path,
    };
  }

  const result = readOwnDataProperty(parent, target);

  if (!result.valid) {
    return {
      valid: false,
      applicable: false,
      reason: result.reason,
    };
  }

  if (proposal.operation === "add" && result.exists) {
    return {
      valid: false,
      applicable: false,
      reason: `Cannot add an existing property: ${target}`,
    };
  }

  if (
    proposal.operation !== "add" &&
    !result.exists
  ) {
    return {
      valid: false,
      applicable: false,
      reason: `Target property does not exist: ${target}`,
    };
  }

  return {
    valid: true,
    applicable: true,
    operation: proposal.operation,
    path: proposal.change.path,
  };
}

export function validateCorrectionOperation(
  workflow: unknown,
  rawProposal: unknown,
): CorrectionOperationValidation {
  const parsed = CorrectionProposalSchema.safeParse(rawProposal);

  if (!parsed.success) {
    return {
      valid: false,
      applicable: false,
      reason: "The correction proposal does not match the expected schema.",
    };
  }

  const proposal = parsed.data;

  if (proposal.operation === "manual") {
    return {
      valid: true,
      applicable: false,
      operation: "manual",
      reason: "This correction requires manual intervention.",
    };
  }

  return validateAutomaticOperation(workflow, proposal);
}
