export function isRetryableSupabaseAuthError(error: unknown): boolean {
  return (
    (error as { name?: string } | undefined)?.name === 'AuthRetryableFetchError'
  );
}
