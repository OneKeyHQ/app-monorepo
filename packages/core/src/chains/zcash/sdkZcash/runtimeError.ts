// The runtime puts `code` / `params` / `detail` on the Error and again under
// `payload`: the extension and web-embed bridges forward `payload` but drop
// `params`/`detail`, while desktop keeps the flat fields. Read through here so
// every platform sees the same fields.

export type IZcashRuntimeError = {
  code: string;
  params: Record<string, unknown>;
  detail?: string;
};

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === 'object' && v !== null
    ? (v as Record<string, unknown>)
    : undefined;
}

/** Reads a runtime failure, or `null` if this is not one. */
export function readZcashRuntimeError(e: unknown): IZcashRuntimeError | null {
  const err = asRecord(e);
  if (!err) return null;

  const bag = asRecord(err.payload) ?? err;
  const code = bag.code ?? err.code;
  if (typeof code !== 'string') return null;

  return {
    code,
    params: asRecord(bag.params) ?? {},
    detail: typeof bag.detail === 'string' ? bag.detail : undefined,
  };
}

/** True when the failure carries this exact runtime error code. */
export function isZcashRuntimeError(e: unknown, code: string): boolean {
  return readZcashRuntimeError(e)?.code === code;
}

/**
 * A numeric (zatoshi) field from the failure's params. `null`, not 0, when
 * missing: 0 would read as "you have nothing" in a shortfall message.
 */
export function zcashErrorAmount(e: unknown, field: string): number | null {
  const v = readZcashRuntimeError(e)?.params[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
