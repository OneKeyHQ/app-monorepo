export const CAPTCHA_DIAGNOSTIC_MAX_EVENTS = 11;

export type ICaptchaDiagnosticSource =
  | 'app_request'
  | 'app_watchdog'
  | 'app_cancel'
  | 'app_cleanup'
  | 'provider_message'
  | 'host_load_error'
  | 'host_watchdog';

export type ICaptchaDiagnosticStatus =
  | 'start'
  | 'ready'
  | 'success'
  | 'expired'
  | 'timeout'
  | 'error'
  | 'load-error'
  | 'cancel';

export type ICaptchaDiagnostic = {
  requestId: string;
  status: ICaptchaDiagnosticStatus;
  source: ICaptchaDiagnosticSource;
  code: string | null;
  elapsedMs: number;
  readyReceived: boolean;
  readyElapsedMs: number | null;
  terminal: boolean;
  sequence: number;
  suppressedEvents: number;
};

export function sanitizeCaptchaCode(code: unknown): string | null {
  return typeof code === 'string' && code.length === 6 && /^\d{6}$/.test(code)
    ? code
    : null;
}

const isCounter = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

// Construct a fresh scalar-only payload at the final logger boundary. Never
// spread a bridge message or Error here, even if its TypeScript type is safe.
export function sanitizeCaptchaDiagnostic(
  value: ICaptchaDiagnostic,
): ICaptchaDiagnostic | undefined {
  if (
    typeof value.requestId !== 'string' ||
    value.requestId.length !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.requestId,
    ) ||
    ![
      'start',
      'ready',
      'success',
      'expired',
      'timeout',
      'error',
      'load-error',
      'cancel',
    ].includes(value.status) ||
    ![
      'app_request',
      'app_watchdog',
      'app_cancel',
      'app_cleanup',
      'provider_message',
      'host_load_error',
      'host_watchdog',
    ].includes(value.source) ||
    !isCounter(value.elapsedMs) ||
    value.elapsedMs > 2_147_483_647 ||
    typeof value.readyReceived !== 'boolean' ||
    (value.readyElapsedMs !== null &&
      (!isCounter(value.readyElapsedMs) ||
        value.readyElapsedMs > value.elapsedMs)) ||
    typeof value.terminal !== 'boolean' ||
    !isCounter(value.sequence) ||
    value.sequence < 1 ||
    value.sequence > CAPTCHA_DIAGNOSTIC_MAX_EVENTS ||
    !isCounter(value.suppressedEvents)
  )
    return undefined;
  return {
    requestId: value.requestId,
    status: value.status,
    source: value.source,
    code: sanitizeCaptchaCode(value.code),
    elapsedMs: value.elapsedMs,
    readyReceived: value.readyReceived,
    readyElapsedMs: value.readyElapsedMs,
    terminal: value.terminal,
    sequence: value.sequence,
    suppressedEvents: value.suppressedEvents,
  };
}
