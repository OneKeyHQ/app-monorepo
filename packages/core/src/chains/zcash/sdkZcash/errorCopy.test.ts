import { toUserFacingZcashError, zcashUserMessage } from './errorCopy';

function runtimeError(code: string, params: Record<string, unknown>) {
  return Object.assign(new Error(code), {
    code,
    params,
    payload: { code, params },
  });
}

describe('zcashUserMessage', () => {
  it('words a shortfall with the amount in ZEC', () => {
    expect(
      zcashUserMessage(
        runtimeError('INSUFFICIENT_FUNDS', { shortfallZat: 66_000_000 }),
      ),
    ).toBe('Insufficient spendable balance — 0.66 ZEC short.');
  });

  it('points FUNDS_NEED_SHIELDING at the transparent pool', () => {
    expect(
      zcashUserMessage(
        runtimeError('FUNDS_NEED_SHIELDING', { transparentZat: 130_000_000 }),
      ),
    ).toContain('1.3 ZEC is in the transparent pool');
  });

  it('leaves caller-bug codes alone', () => {
    // These can only come from a wrong call, never from anything the user did,
    // so a friendly sentence would bury the one detail worth reporting.
    expect(
      zcashUserMessage(runtimeError('INVALID_DB_NAME', { operation: 'x' })),
    ).toBeNull();
    expect(
      zcashUserMessage(runtimeError('INVALID_BATCH_SIZE', { operation: 'x' })),
    ).toBeNull();
    expect(zcashUserMessage(new Error('plain'))).toBeNull();
  });

  it('explains a broken local cache instead of showing its code', () => {
    // DATABASE_ERROR used to be treated as internal. It is reachable in normal
    // use (corrupt or full storage) and it HAS a recovery action -- the wallet
    // db is a rebuildable cache (docs/05 D4) and Rescan rebuilds it -- so the
    // user gets the action. The machine-readable `code` still rides along on
    // the error object for diagnostics.
    const message = zcashUserMessage(
      runtimeError('DATABASE_ERROR', { operation: 'x' }),
    );
    expect(message).toContain('Rescan');
    expect(message).toContain('funds and keys are unaffected');
  });
});

describe('toUserFacingZcashError', () => {
  it('rewrites the message but keeps the machine-readable fields', () => {
    const original = runtimeError('NOT_SYNCED', { stage: 'proposeTransfer' });
    const out = toUserFacingZcashError(original) as Error &
      Record<string, unknown>;
    expect(out.message).toContain('Still syncing');
    expect(out.code).toBe('NOT_SYNCED');
    expect(out.payload).toEqual(original.payload);
  });

  it('returns unmapped errors unchanged (same reference)', () => {
    const e = new Error('boom');
    expect(toUserFacingZcashError(e)).toBe(e);
  });
});
