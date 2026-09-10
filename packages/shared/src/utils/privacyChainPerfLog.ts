// Temporary performance tracing for client-scanned (privacy) chains. One
// prefix across UI, background, carrier and wasm so a single console filter
// shows the whole path of a user action. No-op in production.
const LOG_PREFIX = '[PRIV-PERF]';

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

export function isPrivacyChainPerfLogEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function privacyChainPerfLog(label: string, value?: unknown) {
  if (!isPrivacyChainPerfLogEnabled()) {
    return;
  }
  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${label}${valueText}`);
}

// Wraps an async step and logs its duration plus a small summary of the
// result. `summarize` must return scalars only (counts, booleans).
export async function privacyChainPerfSpan<T>(
  label: string,
  run: () => Promise<T>,
  summarize?: (result: T) => Record<string, unknown>,
): Promise<T> {
  if (!isPrivacyChainPerfLogEnabled()) {
    return run();
  }
  const startedAt = Date.now();
  try {
    const result = await run();
    privacyChainPerfLog(label, {
      ms: Date.now() - startedAt,
      ...(summarize ? summarize(result) : {}),
    });
    return result;
  } catch (error) {
    privacyChainPerfLog(`${label} failed`, {
      ms: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function summarizeResultSize(result: unknown): Record<string, unknown> {
  if (Array.isArray(result)) {
    return { items: result.length };
  }
  if (typeof result === 'string') {
    return { chars: result.length };
  }
  return { type: result === null ? 'null' : typeof result };
}
