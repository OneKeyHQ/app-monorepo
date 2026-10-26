import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { sanitizeCaptchaCode } from '@onekeyhq/shared/src/utils/captchaDiagnostics';
import type {
  ICaptchaDiagnosticSource,
  ICaptchaDiagnosticStatus,
} from '@onekeyhq/shared/src/utils/captchaDiagnostics';

export function createCaptchaDiagnostic(requestId: string) {
  const startedAt = Date.now();
  let readyElapsedMs: number | null = null;
  let closed = false;
  let sequence = 0;
  let suppressedEvents = 0;
  let lastElapsedMs = 0;
  const seen = new Set<string>();
  return (
    status: ICaptchaDiagnosticStatus,
    source: ICaptchaDiagnosticSource,
    rawCode?: string,
    terminal = false,
  ) => {
    if (closed) return;
    const elapsedMs = Math.min(
      2_147_483_647,
      Math.max(lastElapsedMs, Date.now() - startedAt),
    );
    lastElapsedMs = elapsedMs;
    const firstReady = status === 'ready' && readyElapsedMs === null;
    if (firstReady) readyElapsedMs = elapsedMs;
    const code = sanitizeCaptchaCode(rawCode);
    const signature = `${status}:${source}:${code || ''}`;
    // Reserve start, first ready and settlement. Recovery callbacks can be
    // arbitrarily frequent; retain at most eight distinct intermediate events.
    if (!terminal && status !== 'start' && !firstReady) {
      if (status === 'ready' || seen.has(signature) || seen.size >= 8) {
        suppressedEvents = Math.min(
          Number.MAX_SAFE_INTEGER,
          suppressedEvents + 1,
        );
        return;
      }
      seen.add(signature);
    }
    closed = terminal;
    sequence += 1;
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
  };
}
