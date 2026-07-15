import type { ISwapSpeedQuoteSessionIdentity } from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapSpeedQuoteAbortController,
  SwapSpeedQuoteSessionRegistry,
} from './ServiceSwapSpeedQuoteSession';

function buildIdentity(
  requestId: string,
  surfaceId: string,
  intentRevision: number,
): ISwapSpeedQuoteSessionIdentity {
  return { surfaceId, requestId, intentRevision };
}

function buildAbortController(): ISwapSpeedQuoteAbortController & {
  abort: jest.Mock;
} {
  return { abort: jest.fn() };
}

describe('SwapSpeedQuoteSessionRegistry', () => {
  it('keeps requests from different surfaces independent', () => {
    const registry = new SwapSpeedQuoteSessionRegistry();
    const swapProLease = registry.reserve(
      buildIdentity('swap-pro-1', 'main:swap-pro', 1),
    );
    const marketLease = registry.reserve(
      buildIdentity('market-1', 'main:market', 1),
    );
    const swapProController = buildAbortController();
    const marketController = buildAbortController();

    registry.attachAbortController(swapProLease, swapProController);
    registry.attachAbortController(marketLease, marketController);

    expect(registry.getActiveSessionCount()).toBe(2);
    expect(swapProController.abort).not.toHaveBeenCalled();
    expect(marketController.abort).not.toHaveBeenCalled();
  });

  it('lets the newer intent win within the same surface', () => {
    const registry = new SwapSpeedQuoteSessionRegistry();
    const staleLease = registry.reserve(
      buildIdentity('request-1', 'main:swap-pro', 1),
    );
    const staleController = buildAbortController();
    registry.attachAbortController(staleLease, staleController);

    const currentLease = registry.reserve(
      buildIdentity('request-2', 'main:swap-pro', 2),
    );

    expect(staleController.abort).toHaveBeenCalledTimes(1);
    expect(staleLease.status).toBe('cancelled');
    expect(registry.isCurrent(staleLease)).toBe(false);
    expect(registry.isCurrent(currentLease)).toBe(true);
  });

  it('ignores stale completion after a newer request takes ownership', () => {
    const registry = new SwapSpeedQuoteSessionRegistry();
    const staleLease = registry.reserve(
      buildIdentity('request-1', 'main:swap-pro', 1),
    );
    const currentLease = registry.reserve(
      buildIdentity('request-2', 'main:swap-pro', 2),
    );

    expect(registry.finish(staleLease)).toBe(false);
    expect(registry.isCurrent(currentLease)).toBe(true);
    expect(registry.finish(currentLease)).toBe(true);
    expect(currentLease.status).toBe('settled');
  });

  it('cancels only the exact surface and request identity', () => {
    const registry = new SwapSpeedQuoteSessionRegistry();
    const lease = registry.reserve(
      buildIdentity('request-2', 'main:swap-pro', 2),
    );
    const controller = buildAbortController();
    registry.attachAbortController(lease, controller);

    expect(
      registry.cancelExact({
        surfaceId: 'main:swap-pro',
        requestId: 'request-1',
      }),
    ).toBe(false);
    expect(controller.abort).not.toHaveBeenCalled();
    expect(registry.isCurrent(lease)).toBe(true);

    expect(
      registry.cancelExact({
        surfaceId: 'main:swap-pro',
        requestId: 'request-2',
      }),
    ).toBe(true);
    expect(controller.abort).toHaveBeenCalledTimes(1);
    expect(lease.status).toBe('cancelled');
  });

  it('rejects duplicate intent revisions without replacing the current lease', () => {
    const registry = new SwapSpeedQuoteSessionRegistry();
    const currentLease = registry.reserve(
      buildIdentity('request-1', 'main:swap-pro', 2),
    );
    const currentController = buildAbortController();
    registry.attachAbortController(currentLease, currentController);

    const duplicateLease = registry.reserve(
      buildIdentity('request-2', 'main:swap-pro', 2),
    );

    expect(duplicateLease.status).toBe('cancelled');
    expect(registry.isCurrent(currentLease)).toBe(true);
    expect(currentController.abort).not.toHaveBeenCalled();
  });

  it('aborts a controller attached after its lease was superseded', () => {
    const registry = new SwapSpeedQuoteSessionRegistry();
    const staleLease = registry.reserve(
      buildIdentity('request-1', 'main:swap-pro', 1),
    );
    registry.reserve(buildIdentity('request-2', 'main:swap-pro', 2));
    const staleController = buildAbortController();

    expect(registry.attachAbortController(staleLease, staleController)).toBe(
      false,
    );
    expect(staleController.abort).toHaveBeenCalledTimes(1);
  });
});
