export const GAS_ACCOUNT_ADMISSION_OVERLOADED_CODE = 90_212;
export const MAX_GAS_ACCOUNT_RETRY_ATTEMPTS = 3;

type IGasAccountErrorShape = {
  code?: unknown;
  retryAfterSec?: unknown;
  data?: {
    code?: unknown;
    retryAfterSec?: unknown;
    args?: { retryAfterSec?: unknown };
    data?: {
      code?: unknown;
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

// Gate from BFF handoff §3.3: only retry 90212 with a finite integer
// retryAfterSec >= 1. BFF already absorbed the [0, 5] window, so no upper
// bound is enforced here; any larger wait is intentional congestion guidance
// from Prime.
export function shouldDeepRetryGasAccount(params: {
  code: number | undefined;
  retryAfterSec: number | undefined;
}): boolean {
  const { code, retryAfterSec } = params;
  if (code !== GAS_ACCOUNT_ADMISSION_OVERLOADED_CODE) return false;
  if (typeof retryAfterSec !== 'number') return false;
  if (!Number.isFinite(retryAfterSec)) return false;
  if (!Number.isInteger(retryAfterSec)) return false;
  return retryAfterSec >= 1;
}
