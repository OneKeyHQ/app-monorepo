export const GAS_ACCOUNT_ADMISSION_OVERLOADED_CODE = 90_212;
export const MAX_GAS_ACCOUNT_RETRY_ATTEMPTS = 3;
// Handoff §4.3: retryAfterSec beyond this threshold is treated as system-level
// congestion rather than transient admission load. We refuse to park the user
// on a disabled confirm screen for longer than this and let the error surface
// as Refresh (re-estimate) instead.
export const MAX_GAS_ACCOUNT_RETRY_AFTER_SEC = 60;

export const GAS_ACCOUNT_SUBMIT_CANCELLED_ERROR_NAME =
  'GasAccountSubmitCancelledError';

// Thrown by the background retry loop when the user aborts via Cancel while a
// 90212 sleep is in flight. Kept as a plain Error so it crosses the background
// bridge cleanly; identity is checked by `name` rather than `instanceof`.
export class GasAccountSubmitCancelledError extends Error {
  override name = GAS_ACCOUNT_SUBMIT_CANCELLED_ERROR_NAME;

  constructor(message = 'Gas account submission cancelled by user.') {
    super(message);
  }
}

export function isGasAccountSubmitCancelledError(error: unknown): boolean {
  return (
    (error as { name?: string } | undefined)?.name ===
    GAS_ACCOUNT_SUBMIT_CANCELLED_ERROR_NAME
  );
}

// Promise-based sleep that rejects with GasAccountSubmitCancelledError as soon
// as `signal` is aborted. If `signal` is omitted this behaves like a plain
// timeout.
export function abortableWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new GasAccountSubmitCancelledError());
      return;
    }
    // Use a holder so `onAbort` can clear the timeout without a forward
    // reference, and so the timer id can be reassigned once setTimeout
    // returns without tripping prefer-const on a bind-once pattern.
    const handle: { timer?: ReturnType<typeof setTimeout> } = {};
    const onAbort = () => {
      if (handle.timer !== undefined) clearTimeout(handle.timer);
      reject(new GasAccountSubmitCancelledError());
    };
    handle.timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Prime's generic error wrapper (HTTP 200 body, code = err.status ?? 400,
// no messageId); the Wallet BFF fills the missing messageId with
// `error__common_unknown`. On a Gas Account send this is result-unknown
// (OK-64746 / OK-64758): the tx may already be broadcast.
export const GAS_ACCOUNT_UNCLASSIFIED_SERVER_ERROR_CODE = 400;
export const GAS_ACCOUNT_UNKNOWN_ERROR_MESSAGE_ID = 'error__common_unknown';

type IGasAccountErrorShape = {
  code?: unknown;
  retryAfterSec?: unknown;
  data?: {
    code?: unknown;
    messageId?: unknown;
    retryAfterSec?: unknown;
    args?: { retryAfterSec?: unknown };
    data?: {
      code?: unknown;
      messageId?: unknown;
      retryAfterSec?: unknown;
      args?: { retryAfterSec?: unknown };
      res?: { error?: { code?: unknown } };
    };
  };
};

function toNumericCode(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function getGasAccountErrorCode(error: unknown): number | undefined {
  // OneKey RPC errors surface as `{ data: { data: { res: { error: { code } } } } }`
  // (see `IOneKeyRpcError` in shared/errors/types). Older non-RPC paths expose
  // `.code` directly or at `.data.code` / `.data.data.code`, so probe all four.
  const e = error as IGasAccountErrorShape | undefined;
  const candidates = [
    e?.code,
    e?.data?.code,
    e?.data?.data?.code,
    e?.data?.data?.res?.error?.code,
  ];
  for (const candidate of candidates) {
    const parsed = toNumericCode(candidate);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
}

// The server body is kept verbatim under `data` on OneKeyServerApiError (and
// survives background-bridge serialization), so the BFF messageId lives at
// `data.messageId`; `data.data.messageId` covers one extra wrapping layer.
export function getGasAccountErrorMessageId(
  error: unknown,
): string | undefined {
  const e = error as IGasAccountErrorShape | undefined;
  const candidates = [e?.data?.messageId, e?.data?.data?.messageId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) {
      return candidate;
    }
  }
  return undefined;
}

// A generic 400 whose messageId is the BFF's unknown-error filler. Only this
// exact shape is narrowed; any other 400 keeps its ordinary handling.
export function isGasAccountUnclassifiedServerError(error: unknown): boolean {
  return (
    getGasAccountErrorCode(error) ===
      GAS_ACCOUNT_UNCLASSIFIED_SERVER_ERROR_CODE &&
    getGasAccountErrorMessageId(error) === GAS_ACCOUNT_UNKNOWN_ERROR_MESSAGE_ID
  );
}

function toIntegerSecond(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return undefined;
  if (!Number.isInteger(value)) return undefined;
  return value;
}

// Canonical source per BFF handoff §3.1 is top-level `retryAfterSec`.
// `data.args.retryAfterSec` is only an i18n interpolation mirror; read it as a
// fallback in case transport layers strip the top-level field.
export function getGasAccountRetryAfterSec(error: unknown): number | undefined {
  const e = error as IGasAccountErrorShape | undefined;
  const candidates = [
    e?.retryAfterSec,
    e?.data?.retryAfterSec,
    e?.data?.data?.retryAfterSec,
    e?.data?.args?.retryAfterSec,
    e?.data?.data?.args?.retryAfterSec,
  ];
  for (const candidate of candidates) {
    const parsed = toIntegerSecond(candidate);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
}

// Gate from BFF handoff §3.3 + §4.3: only retry 90212 with a finite integer
// retryAfterSec in [1, MAX_GAS_ACCOUNT_RETRY_AFTER_SEC]. BFF already absorbed
// the [0, 5] window; we cap the upper bound so a malformed or anomalous Prime
// value can't park the user on a disabled confirm screen for minutes.
export function shouldDeepRetryGasAccount(params: {
  code: number | undefined;
  retryAfterSec: number | undefined;
}): boolean {
  const { code, retryAfterSec } = params;
  if (code !== GAS_ACCOUNT_ADMISSION_OVERLOADED_CODE) return false;
  if (typeof retryAfterSec !== 'number') return false;
  if (!Number.isFinite(retryAfterSec)) return false;
  if (!Number.isInteger(retryAfterSec)) return false;
  if (retryAfterSec < 1) return false;
  if (retryAfterSec > MAX_GAS_ACCOUNT_RETRY_AFTER_SEC) return false;
  return true;
}
