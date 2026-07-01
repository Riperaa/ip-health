export class ProviderLookupError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = "ProviderLookupError";
  }
}

export function isProviderLookupError(
  error: unknown,
): error is ProviderLookupError {
  return error instanceof ProviderLookupError;
}
