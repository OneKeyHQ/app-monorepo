import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import { defaultLogger } from '../../logger/logger';
import platformEnv from '../../platformEnv';

function errorLabel(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value)
    ? value
    : undefined;
}

export function logMarketWidgetEvent(
  event: string,
  details: Record<string, string | number | boolean | undefined> = {},
  session?: string,
  error?: unknown,
) {
  try {
    const failure = error as { name?: unknown; code?: unknown } | undefined;
    defaultLogger.app.marketWidget.event(event, {
      ...details,
      platform: platformEnv.appPlatform,
      runtime: platformEnv.isNativeBackgroundThread ? 'bg' : 'main',
      sessionRef: session
        ? bytesToHex(sha256(session)).slice(0, 16)
        : undefined,
      errorName: errorLabel(failure?.name),
      errorCode: errorLabel(failure?.code),
    });
  } catch {
    // Logging must not affect editing, including during runtime teardown.
  }
}
