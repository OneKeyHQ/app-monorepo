// Structural typing on purpose: `@onekeyhq/shared` must not depend on
// @supabase/auth-js. Supabase AuthError instances carry a `name` and a
// numeric HTTP `status` (undefined for non-HTTP failures).
export function isRetryableSupabaseAuthError(error: unknown): boolean {
  const authError = error as
    | { name?: string; status?: number }
    | undefined
    | null;
  if (!authError) {
    return false;
  }
  // Thrown by @supabase/auth-js only for fetch-level failures and
  // HTTP 502/503/504.
  if (authError.name === 'AuthRetryableFetchError') {
    return true;
  }
  // Other transient infrastructure failures (rate limit, timeout, other
  // 5xx) surface as AuthApiError with a numeric `status`. Treat them as
  // retryable too, so callers do not misread a recoverable session as
  // "no session" (which would burn throttles or force re-login).
  const status = authError.status;
  if (typeof status === 'number') {
    return (status >= 500 && status < 600) || status === 408 || status === 429;
  }
  return false;
}
