import {
  isZcashRuntimeError,
  readZcashRuntimeError,
  zcashErrorAmount,
} from './runtimeError';

// The fields the host's bridge serializer forwards when an error crosses a
// carrier boundary (JsBridgeBase.toPlainError / toPlainErrorObject). Everything
// else is dropped -- which is why the runtime puts a second copy in `payload`.
const BRIDGE_KEPT_FIELDS = [
  'name',
  'message',
  'code',
  'data',
  'info',
  'key',
  'className',
  'payload',
  'autoToast',
  'stack',
];

/** What a carrier hop does to a thrown error. */
function acrossBridge(e: unknown): Error {
  const src = e as Record<string, unknown>;
  const out = new Error(String(src.message ?? '')) as Error &
    Record<string, unknown>;
  for (const f of BRIDGE_KEPT_FIELDS) {
    if (src[f] !== undefined) out[f] = src[f];
  }
  return out;
}

/** The shape the runtime throws: flat fields plus the same again in payload. */
function runtimeError() {
  const params = {
    shortfallZat: 660_000,
    transparentZat: 1_300_000,
    shieldedAvailableZat: 1_980_000,
    stage: 'proposeTransfer',
  };
  return Object.assign(new Error('FUNDS_NEED_SHIELDING'), {
    code: 'FUNDS_NEED_SHIELDING',
    params,
    detail: 'some detail',
    payload: { code: 'FUNDS_NEED_SHIELDING', params, detail: 'some detail' },
  });
}

describe('readZcashRuntimeError', () => {
  it('reads the same values before and after a carrier hop', () => {
    const direct = readZcashRuntimeError(runtimeError());
    const bridged = readZcashRuntimeError(acrossBridge(runtimeError()));
    expect(direct).toEqual(bridged);
    expect(bridged?.code).toBe('FUNDS_NEED_SHIELDING');
    expect(bridged?.params.shortfallZat).toBe(660_000);
    expect(bridged?.detail).toBe('some detail');
  });

  it('shows why the payload copy is needed', () => {
    // Without it the hop keeps only the code, and a message that should read
    // "short 0.0066, you have 0.013 in the transparent pool" degrades to a
    // bare error name.
    const noPayload = Object.assign(new Error('X'), {
      code: 'X',
      params: { shortfallZat: 1 },
    });
    const crossed = acrossBridge(noPayload) as unknown as Record<
      string,
      unknown
    >;
    expect(crossed.code).toBe('X');
    expect(crossed.params).toBeUndefined();
  });

  it('still reads flat fields when there is no payload (direct call)', () => {
    const flat = Object.assign(new Error('NOT_SYNCED'), {
      code: 'NOT_SYNCED',
      params: { a: 1 },
    });
    expect(readZcashRuntimeError(flat)).toEqual({
      code: 'NOT_SYNCED',
      params: { a: 1 },
      detail: undefined,
    });
  });

  it('returns null for things that are not runtime failures', () => {
    expect(readZcashRuntimeError(new Error('plain'))).toBeNull();
    expect(readZcashRuntimeError('a string')).toBeNull();
    expect(readZcashRuntimeError(null)).toBeNull();
    expect(readZcashRuntimeError({ code: 42 })).toBeNull();
  });

  it('matches a code across the boundary', () => {
    expect(
      isZcashRuntimeError(acrossBridge(runtimeError()), 'FUNDS_NEED_SHIELDING'),
    ).toBe(true);
    expect(isZcashRuntimeError(acrossBridge(runtimeError()), 'OTHER')).toBe(
      false,
    );
  });

  it('reads amounts, and reports a missing one as null rather than zero', () => {
    const e = acrossBridge(runtimeError());
    expect(zcashErrorAmount(e, 'shortfallZat')).toBe(660_000);
    // `stage` is a string, not an amount.
    expect(zcashErrorAmount(e, 'stage')).toBeNull();
    // 0 here would read as "you have nothing", which is a different claim.
    expect(zcashErrorAmount(e, 'notThere')).toBeNull();
  });
});
