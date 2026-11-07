export class TransientNodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientNodeError";
  }
}

export function isRetryableNodeError(
  error: unknown,
): error is TransientNodeError {
  return error instanceof TransientNodeError;
}