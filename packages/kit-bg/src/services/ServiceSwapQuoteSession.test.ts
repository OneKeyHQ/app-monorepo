import type { ISwapQuoteSessionIdentity } from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapQuoteSessionConnection,
  SwapQuoteSessionRegistry,
} from './ServiceSwapQuoteSession';

function buildIdentity(
  requestId: string,
  surfaceId = 'main:swap',
  intentRevision = Number(requestId.replace(/\D/g, '')) || 1,
): ISwapQuoteSessionIdentity {
  return {
    surfaceId,
    requestId,
    fingerprint: `fingerprint:${requestId}`,
    intentRevision,
  };
}

function buildConnection(): ISwapQuoteSessionConnection & {
  close: jest.Mock;
  removeAllListeners: jest.Mock;
} {
  return {
    close: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

describe('SwapQuoteSessionRegistry', () => {
  it('installs a newer request synchronously and disposes the captured old connection', () => {
    const registry = new SwapQuoteSessionRegistry();
    const firstLease = registry.reserve(buildIdentity('request-1'));
    const firstConnection = buildConnection();
    expect(registry.attachConnection(firstLease, firstConnection)).toBe(true);

    const secondLease = registry.reserve(buildIdentity('request-2'));

    expect(firstConnection.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(firstConnection.close).toHaveBeenCalledTimes(1);
    expect(firstLease.status).toBe('cancelled');
    expect(secondLease.bgGeneration).toBe(2);
    expect(registry.isCurrent(firstLease)).toBe(false);
    expect(registry.isCurrent(secondLease)).toBe(true);
  });

  it('disposes a connection that finishes preparing after its lease was superseded', () => {
    const registry = new SwapQuoteSessionRegistry();
    const staleLease = registry.reserve(buildIdentity('request-1'));
    const currentLease = registry.reserve(buildIdentity('request-2'));
    const staleConnection = buildConnection();

    expect(registry.attachConnection(staleLease, staleConnection)).toBe(false);
    expect(staleConnection.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(staleConnection.close).toHaveBeenCalledTimes(1);
    expect(registry.isCurrent(currentLease)).toBe(true);
  });

  it('keeps different surfaces independent', () => {
    const registry = new SwapQuoteSessionRegistry();
    const tabLease = registry.reserve(buildIdentity('request-1', 'main:swap'));
    const modalLease = registry.reserve(
      buildIdentity('request-1', 'main:swapModal'),
    );

    expect(tabLease.bgGeneration).toBe(1);
    expect(modalLease.bgGeneration).toBe(2);
    expect(registry.getActiveSessionCount()).toBe(2);
    expect(registry.isCurrent(tabLease)).toBe(true);
    expect(registry.isCurrent(modalLease)).toBe(true);
  });

  it('cancels only an exact surface and request identity', () => {
    const registry = new SwapQuoteSessionRegistry();
    const oldLease = registry.reserve(buildIdentity('request-1'));
    registry.reserve(buildIdentity('request-2'));
    const currentConnection = buildConnection();
    const currentLease = registry.reserve(buildIdentity('request-3'));
    registry.attachConnection(currentLease, currentConnection);
    const onCancel = jest.fn();

    expect(
      registry.cancelExact(
        {
          surfaceId: oldLease.session.surfaceId,
          requestId: oldLease.session.requestId,
        },
        onCancel,
      ),
    ).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
    expect(currentConnection.close).not.toHaveBeenCalled();
    expect(registry.isCurrent(currentLease)).toBe(true);

    expect(
      registry.cancelExact(
        {
          surfaceId: currentLease.session.surfaceId,
          requestId: currentLease.session.requestId,
        },
        onCancel,
      ),
    ).toBe(true);
    expect(onCancel).toHaveBeenCalledWith({
      lease: currentLease,
      sequence: 1,
    });
    expect(currentConnection.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(currentConnection.close).toHaveBeenCalledTimes(1);
    expect(currentLease.status).toBe('cancelled');
  });

  it('rejects late callbacks and keeps event sequence monotonic', () => {
    const registry = new SwapQuoteSessionRegistry();
    const firstLease = registry.reserve(buildIdentity('request-1'));

    expect(registry.nextSequence(firstLease)).toBe(1);
    expect(registry.nextSequence(firstLease)).toBe(2);

    const secondLease = registry.reserve(buildIdentity('request-2'));
    expect(registry.nextSequence(firstLease)).toBeUndefined();
    expect(registry.nextSequence(secondLease)).toBe(1);
  });

  it('does not let an older client intent supersede a newer surface lease', () => {
    const registry = new SwapQuoteSessionRegistry();
    const currentLease = registry.reserve(
      buildIdentity('request-current', 'main:swap', 2),
    );
    const currentConnection = buildConnection();
    registry.attachConnection(currentLease, currentConnection);

    const staleLease = registry.reserve(
      buildIdentity('request-stale', 'main:swap', 1),
    );

    expect(staleLease.status).toBe('cancelled');
    expect(registry.isCurrent(staleLease)).toBe(false);
    expect(registry.isCurrent(currentLease)).toBe(true);
    expect(currentConnection.close).not.toHaveBeenCalled();
  });

  it('does not let a duplicate client intent replace the current surface lease', () => {
    const registry = new SwapQuoteSessionRegistry();
    const currentLease = registry.reserve(
      buildIdentity('request-current', 'main:swap', 2),
    );
    const currentConnection = buildConnection();
    registry.attachConnection(currentLease, currentConnection);

    const duplicateLease = registry.reserve(
      buildIdentity('request-duplicate', 'main:swap', 2),
    );

    expect(duplicateLease.status).toBe('cancelled');
    expect(registry.isCurrent(duplicateLease)).toBe(false);
    expect(registry.isCurrent(currentLease)).toBe(true);
    expect(currentConnection.removeAllListeners).not.toHaveBeenCalled();
    expect(currentConnection.close).not.toHaveBeenCalled();
  });

  it('remembers the latest client intent after its transport settles', () => {
    const registry = new SwapQuoteSessionRegistry();
    const currentLease = registry.reserve(
      buildIdentity('request-current', 'main:swap', 2),
    );
    expect(registry.finish(currentLease)).toBe(true);

    const staleLease = registry.reserve(
      buildIdentity('request-stale', 'main:swap', 1),
    );

    expect(staleLease.status).toBe('cancelled');
    expect(registry.getActiveSessionCount()).toBe(0);
    expect(registry.getRetiredSurfaceCount()).toBe(1);
  });

  it('retains exact-cancel authority while bounding retired surfaces', () => {
    const registry = new SwapQuoteSessionRegistry(2);
    const firstLease = registry.reserve(
      buildIdentity('request-current', 'main:first', 2),
    );
    expect(
      registry.cancelExact({
        surfaceId: firstLease.session.surfaceId,
        requestId: firstLease.session.requestId,
      }),
    ).toBe(true);

    const staleFirstLease = registry.reserve(
      buildIdentity('request-stale', 'main:first', 1),
    );
    expect(staleFirstLease.status).toBe('cancelled');

    const secondLease = registry.reserve(
      buildIdentity('request-1', 'main:second', 1),
    );
    const thirdLease = registry.reserve(
      buildIdentity('request-1', 'main:third', 1),
    );
    expect(registry.finish(secondLease)).toBe(true);
    expect(registry.finish(thirdLease)).toBe(true);

    expect(registry.getRetiredSurfaceCount()).toBe(2);
    expect(registry.nextSequence(firstLease)).toBeUndefined();
    expect(registry.nextSequence(secondLease)).toBeUndefined();
    expect(registry.nextSequence(thirdLease)).toBeUndefined();
  });

  it('moves a retired surface back to active ownership only for a newer intent', () => {
    const registry = new SwapQuoteSessionRegistry();
    const settledLease = registry.reserve(
      buildIdentity('request-2', 'main:swap', 2),
    );
    expect(registry.finish(settledLease)).toBe(true);
    expect(registry.getRetiredSurfaceCount()).toBe(1);

    const currentLease = registry.reserve(
      buildIdentity('request-3', 'main:swap', 3),
    );

    expect(registry.isCurrent(currentLease)).toBe(true);
    expect(registry.getRetiredSurfaceCount()).toBe(0);
    expect(registry.nextSequence(settledLease)).toBeUndefined();
  });

  it('finishes only the currently captured lease', () => {
    const registry = new SwapQuoteSessionRegistry();
    const staleLease = registry.reserve(buildIdentity('request-1'));
    const currentLease = registry.reserve(buildIdentity('request-2'));
    const currentConnection = buildConnection();
    registry.attachConnection(currentLease, currentConnection);

    expect(registry.finish(staleLease)).toBe(false);
    expect(currentConnection.close).not.toHaveBeenCalled();
    expect(registry.finish(currentLease)).toBe(true);
    expect(currentConnection.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(currentConnection.close).toHaveBeenCalledTimes(1);
    expect(currentLease.status).toBe('terminal');
    expect(registry.getActiveSessionCount()).toBe(0);
  });

  it('makes terminal cleanup idempotent and rejects callbacks after finish', () => {
    const registry = new SwapQuoteSessionRegistry();
    const lease = registry.reserve(buildIdentity('request-1'));
    const connection = buildConnection();
    registry.attachConnection(lease, connection);

    expect(registry.nextSequence(lease)).toBe(1);
    expect(registry.finish(lease)).toBe(true);
    expect(registry.nextSequence(lease)).toBeUndefined();
    expect(registry.finish(lease)).toBe(false);
    expect(connection.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it('still closes when listener cleanup throws', () => {
    const registry = new SwapQuoteSessionRegistry();
    const lease = registry.reserve(buildIdentity('request-1'));
    const connection = buildConnection();
    connection.removeAllListeners.mockImplementation(() => {
      JSON.parse('invalid JSON');
    });
    registry.attachConnection(lease, connection);

    expect(registry.finish(lease)).toBe(true);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });
});
