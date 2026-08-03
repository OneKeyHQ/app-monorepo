import { OneKeyLocalError } from '../../errors';

import type {
  ISniRequestCancelSettledResult,
  ISniRequestTransportSettledResult,
} from '../types/ipTable';

const SNI_ERROR_CODE_RE = /\b(SNI_[A-Z_]+)\b/;

export function getSniRequestErrorCode(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  if (code) return code;

  const message = error instanceof Error ? error.message : String(error);
  return SNI_ERROR_CODE_RE.exec(message)?.[1] ?? '';
}

export function getSniRequestCancelAckError(
  result: ISniRequestCancelSettledResult,
): string | undefined {
  if (result.status === 'rejected') {
    const message =
      result.error instanceof Error
        ? result.error.message
        : String(result.error);
    return `cancelRequest rejected for ${result.requestId}: ${message}`;
  }
  if (!result.success) {
    return `cancelRequest returned success=false for ${result.requestId}`;
  }
  return undefined;
}

export function getSniRequestTransportSettledError(
  result: ISniRequestTransportSettledResult,
): string | undefined {
  if (result.status === 'fulfilled') {
    return `transport fulfilled after abort for ${result.requestId}`;
  }
  const code = getSniRequestErrorCode(result.error);
  if (code !== 'SNI_CANCELLED') {
    const message =
      result.error instanceof Error
        ? result.error.message
        : String(result.error);
    return `transport rejected with ${code || 'unknown code'} for ${result.requestId}: ${message}`;
  }
  return undefined;
}

async function waitForDiagnosticResult<T>({
  ensureActive,
  pollIntervalMs,
  resultPromise,
  timeoutMessage,
  timeoutMs,
}: {
  ensureActive: () => void;
  pollIntervalMs: number;
  resultPromise: Promise<T>;
  timeoutMessage: string;
  timeoutMs: number;
}): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  const settledResult = resultPromise.then((result) => ({
    kind: 'result' as const,
    result,
  }));

  for (;;) {
    ensureActive();
    const next = await Promise.race([
      settledResult,
      new Promise<{ kind: 'poll' }>((resolve) =>
        setTimeout(() => resolve({ kind: 'poll' }), pollIntervalMs),
      ),
    ]);
    if (next.kind === 'result') {
      ensureActive();
      return next.result;
    }
    ensureActive();
    if (Date.now() >= deadline) {
      throw new OneKeyLocalError(timeoutMessage);
    }
  }
}

export function waitForSniRequestCancelAck({
  ack,
  ensureActive,
  pollIntervalMs,
  requestId,
  timeoutMs,
}: {
  ack: Promise<ISniRequestCancelSettledResult>;
  ensureActive: () => void;
  pollIntervalMs: number;
  requestId: string;
  timeoutMs: number;
}): Promise<ISniRequestCancelSettledResult> {
  return waitForDiagnosticResult({
    ensureActive,
    pollIntervalMs,
    resultPromise: ack,
    timeoutMessage: `cancelRequest acknowledgement timed out for ${requestId} after ${timeoutMs} ms`,
    timeoutMs,
  });
}

export function waitForSniRequestTransportSettled({
  ensureActive,
  pollIntervalMs,
  requestId,
  timeoutMs,
  transportSettled,
}: {
  ensureActive: () => void;
  pollIntervalMs: number;
  requestId: string;
  timeoutMs: number;
  transportSettled: Promise<ISniRequestTransportSettledResult>;
}): Promise<ISniRequestTransportSettledResult> {
  return waitForDiagnosticResult({
    ensureActive,
    pollIntervalMs,
    resultPromise: transportSettled,
    timeoutMessage: `transport outcome timed out for ${requestId} after ${timeoutMs} ms`,
    timeoutMs,
  });
}
