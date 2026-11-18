import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  CAPTCHA_DIAGNOSTIC_MAX_EVENTS,
  sanitizeCaptchaCode,
} from '@onekeyhq/shared/src/utils/captchaDiagnostics';
import type {
  ICaptchaDiagnosticSource,
  ICaptchaDiagnosticStatus,
} from '@onekeyhq/shared/src/utils/captchaDiagnostics';

function readTime(monotonic: boolean): number | undefined {
  try {
    const value = monotonic ? globalThis.performance?.now?.() : Date.now();
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export function createCaptchaDiagnostic(requestId: string) {
  const monotonicStartedAt = readTime(true);
  const monotonic = monotonicStartedAt !== undefined;
  const startedAt = monotonicStartedAt ?? readTime(false);
  let started = false;
  let readyElapsedMs: number | null = null;
  let closed = false;
  let sequence = 0;
  let suppressedEvents = 0;
  let lastElapsedMs = 0;
  const seen = new Set<string>();
  const suppress = () => {
    suppressedEvents = Math.min(Number.MAX_SAFE_INTEGER, suppressedEvents + 1);
  };
  return (
    status: ICaptchaDiagnosticStatus,
    source: ICaptchaDiagnosticSource,
    rawCode?: string,
    terminal = false,
  ) => {
    if (closed || sequence >= CAPTCHA_DIAGNOSTIC_MAX_EVENTS) return;
    if (status === 'start') {
      if (started) {
        suppress();
        return;
      }
      started = true;
    }
    // Keep one clock origin for the attempt. A failed read must not switch a
    // running monotonic clock to wall time or produce NaN in the final summary.
    const now = readTime(monotonic);
    const elapsedMs =
      now === undefined || startedAt === undefined
        ? lastElapsedMs
        : Math.min(
            2_147_483_647,
            Math.max(lastElapsedMs, Math.floor(now - startedAt)),
          );
    lastElapsedMs = elapsedMs;
    const firstReady = status === 'ready' && readyElapsedMs === null;
    if (firstReady) readyElapsedMs = elapsedMs;
    const code = sanitizeCaptchaCode(rawCode);
    const signature = `${status}:${source}:${code || ''}`;
    // Reserve a terminal slot even for repeated starts or reentrant logger
    // calls. Only eight distinct intermediate signatures are retained.
    if (!terminal) {
      if (
        sequence >= CAPTCHA_DIAGNOSTIC_MAX_EVENTS - 1 ||
        (status === 'ready' && !firstReady) ||
        (status !== 'start' &&
          !firstReady &&
          (seen.has(signature) ||
            seen.size >= CAPTCHA_DIAGNOSTIC_MAX_EVENTS - 3))
      ) {
        suppress();
        return;
      }
      if (status !== 'start' && !firstReady) seen.add(signature);
    }
    closed = terminal;
    sequence += 1;
    // Consume the attempt budget and close before calling the sink: failures
    // and recursive calls must neither flood logs nor affect authentication.
    try {
      defaultLogger.prime.subscription.emailOtpCaptchaDiagnostic({
        requestId,
        status,
        source,
        code,
        elapsedMs,
        readyReceived: readyElapsedMs !== null,
        readyElapsedMs,
        terminal,
        sequence,
        suppressedEvents,
      });
    } catch {
      // Never log the logger's exception; it may contain sensitive text.
    }
  };
}
