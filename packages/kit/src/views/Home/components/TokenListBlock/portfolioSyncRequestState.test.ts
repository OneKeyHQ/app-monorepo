import {
  buildPortfolioSyncTargetKey,
  resolvePortfolioSyncRequestTransition,
} from './portfolioSyncRequestState';

import type { IPortfolioSyncRequest } from './portfolioSyncRequestState';

/*
yarn jest packages/kit/src/views/Home/components/TokenListBlock/portfolioSyncRequestState.test.ts
*/

const TARGET_KEY = buildPortfolioSyncTargetKey({
  deviceDbId: 'device-1',
  indexedAccountId: 'hd-1--1',
  networkId: 'evm--1',
  walletId: 'hd-1',
});

function requestAt(
  id: number,
  phase: IPortfolioSyncRequest['phase'],
): IPortfolioSyncRequest {
  return { id, phase, targetKey: TARGET_KEY };
}

describe('buildPortfolioSyncTargetKey', () => {
  it('separates targets that differ in any single field', () => {
    const target = {
      deviceDbId: 'device-1',
      indexedAccountId: 'hd-1--1',
      networkId: 'evm--1',
      walletId: 'hd-1',
    };

    expect(buildPortfolioSyncTargetKey(target)).toBe(
      'hd-1|hd-1--1|evm--1|device-1',
    );
    expect(
      buildPortfolioSyncTargetKey({ ...target, networkId: 'evm--56' }),
    ).not.toBe(buildPortfolioSyncTargetKey(target));
    expect(
      buildPortfolioSyncTargetKey({ ...target, deviceDbId: 'device-2' }),
    ).not.toBe(buildPortfolioSyncTargetKey(target));
  });
});

describe('resolvePortfolioSyncRequestTransition', () => {
  it('advances the phase of the request the report belongs to', () => {
    const transition = resolvePortfolioSyncRequestTransition({
      request: requestAt(1, 'queued'),
      requestId: 1,
      phase: 'refreshing',
    });

    expect(transition.accepted).toBe(true);
    expect(transition.nextRequest).toEqual(requestAt(1, 'refreshing'));
  });

  it('claims communication only once when two refreshes finish for the same tap', () => {
    const claimed = resolvePortfolioSyncRequestTransition({
      request: requestAt(1, 'refreshing'),
      requestId: 1,
      phase: 'communicating',
    });
    expect(claimed.accepted).toBe(true);
    expect(claimed.nextRequest?.phase).toBe('communicating');

    const second = resolvePortfolioSyncRequestTransition({
      request: claimed.nextRequest,
      requestId: 1,
      phase: 'communicating',
    });
    const late = resolvePortfolioSyncRequestTransition({
      request: claimed.nextRequest,
      requestId: 1,
      phase: 'settled',
    });

    expect(second.accepted).toBe(false);
    expect(late.accepted).toBe(false);
    expect(late.nextRequest?.phase).toBe('communicating');
  });

  it('does not let a stale refresh claim a newer request', () => {
    const newerRequest = requestAt(2, 'refreshing');

    const stale = resolvePortfolioSyncRequestTransition({
      request: newerRequest,
      requestId: 1,
      phase: 'communicating',
    });
    const current = resolvePortfolioSyncRequestTransition({
      request: newerRequest,
      requestId: 2,
      phase: 'communicating',
    });

    expect(stale.accepted).toBe(false);
    expect(stale.nextRequest).toBe(newerRequest);
    expect(current.accepted).toBe(true);
    expect(current.nextRequest?.id).toBe(2);
  });

  it('rejects any report once the tap has been finished', () => {
    expect(
      resolvePortfolioSyncRequestTransition({
        request: undefined,
        requestId: 1,
        phase: 'refreshing',
      }),
    ).toEqual({
      accepted: false,
      nextRequest: undefined,
      clearFallbackTimer: false,
    });
  });

  it('keeps the fallback timer armed for settled and disarms it otherwise', () => {
    const settled = resolvePortfolioSyncRequestTransition({
      request: requestAt(1, 'refreshing'),
      requestId: 1,
      phase: 'settled',
    });
    const refreshing = resolvePortfolioSyncRequestTransition({
      request: requestAt(1, 'queued'),
      requestId: 1,
      phase: 'refreshing',
    });

    expect(settled.clearFallbackTimer).toBe(false);
    expect(refreshing.clearFallbackTimer).toBe(true);
  });

  it('never mutates the request it was handed', () => {
    const request = requestAt(1, 'queued');

    resolvePortfolioSyncRequestTransition({
      request,
      requestId: 1,
      phase: 'communicating',
    });

    expect(request.phase).toBe('queued');
  });

  it('carries the all-networks generation floor across a transition', () => {
    const transition = resolvePortfolioSyncRequestTransition({
      request: { ...requestAt(1, 'queued'), minimumAllNetworksGeneration: 7 },
      requestId: 1,
      phase: 'refreshing',
    });

    expect(transition.nextRequest?.minimumAllNetworksGeneration).toBe(7);
  });
});
