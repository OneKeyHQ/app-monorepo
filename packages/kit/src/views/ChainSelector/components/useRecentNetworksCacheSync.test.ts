/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppSWRCacheScopes } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { buildRecentNetworksSwrKey } from './recentNetworksCache';
import { useRecentNetworksCacheSync } from './useRecentNetworksCacheSync';

const network = (id: string): IServerNetwork =>
  ({ id, name: id }) as unknown as IServerNetwork;

const slotKey = buildRecentNetworksSwrKey({
  scope: EAppSWRCacheScopes.editableChainSelector,
  showAllNetwork: true,
  walletId: 'hd-1',
  accountId: "hd-1--m/44'/60'/0'/0/0",
});

const ids = () =>
  swrCacheUtils.get<IServerNetwork[]>(slotKey)?.map((n) => n.id);

describe('useRecentNetworksCacheSync', () => {
  beforeEach(() => {
    swrCacheUtils.clearAll();
    swrCacheUtils.set(slotKey, [network('sol--101'), network('btc--0')]);
  });

  afterAll(() => {
    swrCacheUtils.flushNow();
  });

  it('prepends a network recorded by any runtime into the home selector slot', () => {
    renderHook(() =>
      useRecentNetworksCacheSync({
        enabled: true,
        walletId: 'hd-1',
        accountId: "hd-1--m/44'/60'/0'/0/0",
      }),
    );
    act(() => {
      appEventBus.emit(EAppEventBusNames.RecentNetworkRecorded, {
        network: network('evm--1'),
      });
    });
    expect(ids()).toEqual(['evm--1', 'sol--101', 'btc--0']);
  });

  it('stops listening after unmount', () => {
    const { unmount } = renderHook(() =>
      useRecentNetworksCacheSync({
        enabled: true,
        walletId: 'hd-1',
        accountId: undefined,
      }),
    );
    unmount();
    act(() => {
      appEventBus.emit(EAppEventBusNames.RecentNetworkRecorded, {
        network: network('evm--1'),
      });
    });
    expect(ids()).toEqual(['sol--101', 'btc--0']);
  });

  it('does nothing when disabled or without a wallet', () => {
    renderHook(() =>
      useRecentNetworksCacheSync({
        enabled: false,
        walletId: 'hd-1',
        accountId: undefined,
      }),
    );
    renderHook(() =>
      useRecentNetworksCacheSync({
        enabled: true,
        walletId: undefined,
        accountId: undefined,
      }),
    );
    act(() => {
      appEventBus.emit(EAppEventBusNames.RecentNetworkRecorded, {
        network: network('evm--1'),
      });
    });
    expect(ids()).toEqual(['sol--101', 'btc--0']);
  });
});
