// Reading a runtime failure, from either side of a carrier boundary.
//
// The runtime attaches `code` / `params` / `detail` to the thrown Error, and the
// same three again under `payload`. The duplication is not redundancy: when an
// error crosses into the extension background or out of the mobile web-embed,
// the host's serializer forwards a fixed set of fields and `params`/`detail` are
// not in it. `payload` is, so that is the copy that survives the trip.
//
// Desktop calls the implementation directly with no carrier in between and keeps
// the flat fields. Reading through here means callers do not have to know which
// platform they are on -- the bug this prevents is a UI that shows the amounts
// on desktop and a bare error code everywhere else.

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

  // `payload` first: it is the copy that survives a carrier hop, so preferring
  // it means every platform reads the same thing.
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
 * A numeric field from the failure's params, or `null`.
 *
 * The runtime reports zatoshi as JSON numbers; the maximum supply is well
 * inside the safe-integer range, so a plain number is enough here. Returns
 * `null` rather than 0 for a missing field: 0 would read as "you have nothing"
 * in a message about how much is short.
 */
export function zcashErrorAmount(e: unknown, field: string): number | null {
  const v = readZcashRuntimeError(e)?.params[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
