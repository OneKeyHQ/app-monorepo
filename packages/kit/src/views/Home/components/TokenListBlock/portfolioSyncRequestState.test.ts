import {
  buildPortfolioSyncTargetKey,
  resolvePortfolioSyncRequestTransition,
  shouldPortfolioSyncStandDownOnStageOff,
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
  it('claims a preparing request for the hardware handoff', () => {
    const transition = resolvePortfolioSyncRequestTransition({
      request: requestAt(1, 'preparing'),
      requestId: 1,
      phase: 'communicating',
    });

    expect(transition.accepted).toBe(true);
    expect(transition.nextRequest).toEqual(requestAt(1, 'communicating'));
    expect(transition.clearFallbackTimer).toBe(true);
  });

  it('claims communication only once for the same tap', () => {
    const claimed = resolvePortfolioSyncRequestTransition({
      request: requestAt(1, 'preparing'),
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

    expect(second.accepted).toBe(false);
    expect(second.nextRequest?.phase).toBe('communicating');
  });

  it('does not let a stale report claim a newer request', () => {
    const newerRequest = requestAt(2, 'preparing');

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
        phase: 'communicating',
      }),
    ).toEqual({
      accepted: false,
      nextRequest: undefined,
      clearFallbackTimer: false,
    });
  });

  it('never mutates the request it was handed', () => {
    const request = requestAt(1, 'preparing');

    resolvePortfolioSyncRequestTransition({
      request,
      requestId: 1,
      phase: 'communicating',
    });

    expect(request.phase).toBe('preparing');
  });
});

describe('shouldPortfolioSyncStandDownOnStageOff', () => {
  it('ends the request whose own stage hold the exit closes', () => {
    expect(
      shouldPortfolioSyncStandDownOnStageOff({
        request: requestAt(2, 'communicating'),
        stageHold: { requestId: 2, burstId: 5 },
        offBurstId: 5,
      }),
    ).toBe(true);
  });

  it("keeps a request when the exit is an earlier burst's (OK-64696)", () => {
    // A Sync tapped as the previous attempt's ✗ retires under the live
    // page: on split runtimes that exit can land after the new hold opened.
    expect(
      shouldPortfolioSyncStandDownOnStageOff({
        request: requestAt(2, 'communicating'),
        stageHold: { requestId: 2, burstId: 5 },
        offBurstId: 4,
      }),
    ).toBe(false);
  });

  it('keeps a request whose hold has not opened a stage', () => {
    // Not yet answered (the hold is still the previous request's), or
    // minted while the stage was silenced.
    expect(
      shouldPortfolioSyncStandDownOnStageOff({
        request: requestAt(2, 'communicating'),
        stageHold: { requestId: 1, burstId: 4 },
        offBurstId: 4,
      }),
    ).toBe(false);
    expect(
      shouldPortfolioSyncStandDownOnStageOff({
        request: requestAt(2, 'communicating'),
        stageHold: { requestId: 2, burstId: undefined },
        offBurstId: undefined,
      }),
    ).toBe(false);
  });

  it('has nothing to end without a request', () => {
    expect(
      shouldPortfolioSyncStandDownOnStageOff({
        request: undefined,
        stageHold: { requestId: 1, burstId: 4 },
        offBurstId: 4,
      }),
    ).toBe(false);
  });
});
