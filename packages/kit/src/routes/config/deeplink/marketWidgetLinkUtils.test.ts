import { createMarketWidgetLinkHandler } from './marketWidgetLinkUtils';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('market widget navigation lifecycle', () => {
  it('waits for unlock and navigation readiness before resolving an asset', async () => {
    const unlock = deferred<void>();
    let ready = false;
    const navigate = jest.fn();
    const resolve = jest.fn(async () => 'bitcoin');
    const handler = createMarketWidgetLinkHandler({
      waitForUnlock: () => unlock.promise,
      isReady: () => ready,
      wait: async () => {
        ready = true;
      },
      isAllowed: () => true,
      resolve,
      navigate,
      onError: jest.fn(),
    });
    const task = handler({ kind: 'asset', assetId: 'bitcoin' }, () => true);
    await Promise.resolve();
    expect(resolve).not.toHaveBeenCalled();
    unlock.resolve();
    await task;
    expect(navigate).toHaveBeenCalledWith('bitcoin');
  });

  it('prevents a slow older asset request from replacing the newer destination', async () => {
    const old = deferred<string>();
    const navigate = jest.fn();
    const handler = createMarketWidgetLinkHandler({
      waitForUnlock: async () => undefined,
      isReady: () => true,
      wait: async () => undefined,
      isAllowed: () => true,
      resolve: async (target) =>
        target.kind === 'asset' && target.assetId === 'bitcoin'
          ? old.promise
          : 'ethereum',
      navigate,
      onError: jest.fn(),
    });
    const first = handler({ kind: 'asset', assetId: 'bitcoin' }, () => true);
    await Promise.resolve();
    await handler({ kind: 'asset', assetId: 'ethereum' }, () => true);
    old.resolve('bitcoin');
    await first;
    expect(navigate.mock.calls).toEqual([['ethereum']]);
  });

  it('drops a widget request superseded by another deep link or travel mode', async () => {
    const old = deferred<string>();
    let current = true;
    const navigate = jest.fn();
    const handler = createMarketWidgetLinkHandler({
      waitForUnlock: async () => undefined,
      isReady: () => true,
      wait: async () => undefined,
      isAllowed: () => true,
      resolve: () => old.promise,
      navigate,
      onError: jest.fn(),
    });
    const first = handler({ kind: 'asset', assetId: 'bitcoin' }, () => current);
    await Promise.resolve();
    current = false;
    old.resolve('bitcoin');
    await first;
    expect(navigate).not.toHaveBeenCalled();
  });
});
