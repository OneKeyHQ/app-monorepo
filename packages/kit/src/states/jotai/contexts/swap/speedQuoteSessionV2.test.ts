import type { IFetchSpeedSwapQuoteV2Result } from '@onekeyhq/shared/types/swap/types';

import {
  SWAP_SPEED_QUOTE_SESSION_V2_INITIAL_STATE,
  buildSwapSpeedQuoteCancelParams,
  invalidateSwapSpeedQuoteSession,
  isCurrentSwapSpeedQuoteResult,
  prepareSwapSpeedQuoteSession,
  settleSwapSpeedQuoteSession,
} from './speedQuoteSessionV2';

describe('speedQuoteSessionV2', () => {
  it('creates an owner-scoped request and advances its intent revision', () => {
    const prepared = prepareSwapSpeedQuoteSession(
      SWAP_SPEED_QUOTE_SESSION_V2_INITIAL_STATE,
    );

    expect(prepared.surfaceId).toBeTruthy();
    expect(prepared.intentRevision).toBe(1);
    expect(prepared.activeSession).toEqual(
      expect.objectContaining({
        surfaceId: prepared.surfaceId,
        intentRevision: 1,
      }),
    );
  });

  it('rejects a stale completion after a newer request starts', () => {
    const first = prepareSwapSpeedQuoteSession(
      SWAP_SPEED_QUOTE_SESSION_V2_INITIAL_STATE,
    );
    const second = prepareSwapSpeedQuoteSession(first);
    const staleResult: IFetchSpeedSwapQuoteV2Result = {
      accepted: true,
      session: first.activeSession!,
      bgGeneration: 1,
      quotes: [],
    };

    expect(
      isCurrentSwapSpeedQuoteResult({ state: second, result: staleResult }),
    ).toBe(false);
    expect(
      settleSwapSpeedQuoteSession({
        state: second,
        session: first.activeSession!,
      }),
    ).toBe(second);
  });

  it('invalidates the active request and builds an exact cancel identity', () => {
    const prepared = prepareSwapSpeedQuoteSession(
      SWAP_SPEED_QUOTE_SESSION_V2_INITIAL_STATE,
    );
    const cancelParams = buildSwapSpeedQuoteCancelParams(
      prepared.activeSession!,
    );
    const invalidated = invalidateSwapSpeedQuoteSession(prepared);

    expect(cancelParams).toEqual({
      surfaceId: prepared.activeSession?.surfaceId,
      requestId: prepared.activeSession?.requestId,
    });
    expect(invalidated.activeSession).toBeUndefined();
    expect(invalidated.intentRevision).toBe(2);
  });
});
