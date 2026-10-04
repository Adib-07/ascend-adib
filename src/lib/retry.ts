export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: ((error: unknown) => boolean) | RegExp[];
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryableErrors,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      const isRetryable = retryableErrors
        ? retryableErrors.some((r) => (r instanceof RegExp ? r.test(String(error)) : r(error)))
        : isDefaultRetryable(error);

      if (!isRetryable) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs);

      if (onRetry) {
        onRetry(attempt, error);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function isDefaultRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("503") ||
      message.includes("504") ||
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("temporary")
    );
  }
  return false;
}

export async function withAIRetry<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, "retryableErrors"> = {},
): Promise<T> {
  return withRetry(fn, {
    ...options,
    maxAttempts: options.maxAttempts ?? 3,
    baseDelayMs: options.baseDelayMs ?? 2000,
    retryableErrors: [
      /network/i,
      /timeout/i,
      /503/,
      /504/,
      /429/,
      /rate limit/i,
      /overloaded/i,
      /unavailable/i,
    ],
    ...options,
  });
}

export async function withDBRetry<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, "retryableErrors"> = {},
): Promise<T> {
  return withRetry(fn, {
    ...options,
    maxAttempts: options.maxAttempts ?? 3,
    baseDelayMs: options.baseDelayMs ?? 500,
    retryableErrors: [
      /connection/i,
      /timeout/i,
      /pool/i,
      /prepared statement/i,
      /deadlock/i,
      /serialization/i,
    ],
    ...options,
  });
}
