import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapPositionPrefetchScopes,
  createSwapPositionPrefetchScheduler,
} from './swapPositionPrefetchUtils';

const swapNetwork: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
};
const stockNetwork: ISwapNetwork = {
  networkId: 'evm--8453',
  name: 'Base',
  symbol: 'ETH',
};
const proNetwork: IMarketBasicConfigNetwork = {
  networkId: 'evm--42161',
  index: 0,
  name: 'Arbitrum',
  logoUrl: '',
  explorerUrl: '',
  chainId: '42161',
};

describe('buildSwapPositionPrefetchScopes', () => {
  it('starts Pro independently when Swap networks are not ready', () => {
    expect(
      buildSwapPositionPrefetchScopes({
        swapNetworksReady: false,
        proNetworksReady: true,
        swapNetworkList: [swapNetwork],
        stockNetworkList: [stockNetwork],
        proNetworkList: [proNetwork],
      }),
    ).toEqual([{ key: 'pro', networkList: [proNetwork], stockOnly: false }]);
  });

  it('does not block Swap and Stock on slow or failed Pro configuration', () => {
    expect(
      buildSwapPositionPrefetchScopes({
        swapNetworksReady: true,
        proNetworksReady: false,
        swapNetworkList: [swapNetwork],
        stockNetworkList: [stockNetwork],
        proNetworkList: [],
      }),
    ).toEqual([
      { key: 'swap', networkList: [swapNetwork], stockOnly: false },
      { key: 'stock', networkList: [stockNetwork], stockOnly: true },
    ]);
  });

  it('does not start either source before it is ready', () => {
    expect(
      buildSwapPositionPrefetchScopes({
        swapNetworksReady: false,
        proNetworksReady: false,
        swapNetworkList: [swapNetwork],
        stockNetworkList: [stockNetwork],
        proNetworkList: [proNetwork],
      }),
    ).toEqual([]);
  });

  it('uses one stable tab-independent scope order', () => {
    const scopes = buildSwapPositionPrefetchScopes({
      swapNetworksReady: true,
      proNetworksReady: true,
      swapNetworkList: [swapNetwork],
      stockNetworkList: [stockNetwork],
      proNetworkList: [proNetwork],
    });

    expect(scopes.map((scope) => scope.key)).toEqual(['swap', 'stock', 'pro']);
    expect(scopes.map((scope) => scope.stockOnly)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('omits unsupported empty scopes without reordering the others', () => {
    const scopes = buildSwapPositionPrefetchScopes({
      swapNetworksReady: true,
      proNetworksReady: true,
      swapNetworkList: [swapNetwork],
      stockNetworkList: [],
      proNetworkList: [proNetwork],
    });

    expect(scopes.map((scope) => scope.key)).toEqual(['swap', 'pro']);
  });
});

describe('createSwapPositionPrefetchScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads at once while the swap surface is focused', () => {
    const scheduler = createSwapPositionPrefetchScheduler();
    const run = jest.fn();

    scheduler.request(run, true);

    expect(run).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps only the latest hidden account pending until focus', () => {
    const scheduler = createSwapPositionPrefetchScheduler();
    const firstAccount = jest.fn();
    const secondAccount = jest.fn();
    const lastAccount = jest.fn();

    scheduler.request(firstAccount, false);
    jest.advanceTimersByTime(60_000);
    scheduler.request(secondAccount, false);
    jest.advanceTimersByTime(60_000);
    scheduler.request(lastAccount, false);
    expect(lastAccount).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60_000);

    expect(firstAccount).not.toHaveBeenCalled();
    expect(secondAccount).not.toHaveBeenCalled();
    expect(lastAccount).not.toHaveBeenCalled();

    scheduler.flush();
    scheduler.flush();

    expect(firstAccount).not.toHaveBeenCalled();
    expect(secondAccount).not.toHaveBeenCalled();
    expect(lastAccount).toHaveBeenCalledTimes(1);
  });

  it('replaces a pending hidden account with the current focused account', () => {
    const scheduler = createSwapPositionPrefetchScheduler();
    const hiddenAccount = jest.fn();
    const focusedAccount = jest.fn();

    scheduler.request(hiddenAccount, false);
    scheduler.request(focusedAccount, true);
    scheduler.flush();
    jest.advanceTimersByTime(60_000);

    expect(hiddenAccount).not.toHaveBeenCalled();
    expect(focusedAccount).toHaveBeenCalledTimes(1);
  });

  it('flushes a waiting load as soon as the surface regains focus', () => {
    const scheduler = createSwapPositionPrefetchScheduler();
    const run = jest.fn();

    scheduler.request(run, false);
    scheduler.flush();

    expect(run).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not load on focus when nothing is waiting', () => {
    const scheduler = createSwapPositionPrefetchScheduler();
    const run = jest.fn();

    scheduler.request(run, true);
    scheduler.flush();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('drops a waiting load when cancelled on unmount', () => {
    const scheduler = createSwapPositionPrefetchScheduler();
    const run = jest.fn();

    scheduler.request(run, false);
    scheduler.cancel();
    jest.advanceTimersByTime(60_000);
    scheduler.flush();

    expect(run).not.toHaveBeenCalled();
  });
});
