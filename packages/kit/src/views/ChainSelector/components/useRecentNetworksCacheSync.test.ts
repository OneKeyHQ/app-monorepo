/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppSWRCacheScopes } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { buildRecentNetworksSwrKey } from './recentNetworksCache';
import { useRecentNetworksCacheSync } from './useRecentNetworksCacheSync';

type ICompatibleNetworksResp = {
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
};

const mockGetCompatibleNetworks = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getChainSelectorNetworksCompatibleWithAccountId: (
        params: unknown,
      ): Promise<ICompatibleNetworksResp> =>
        mockGetCompatibleNetworks(params) as Promise<ICompatibleNetworksResp>,
    },
  },
}));

const network = (id: string): IServerNetwork =>
  ({ id, name: id }) as unknown as IServerNetwork;

const walletId = 'hd-1';
const accountId = "hd-1--m/44'/60'/0'/0/0";

const slotKey = buildRecentNetworksSwrKey({
  scope: EAppSWRCacheScopes.editableChainSelector,
  showAllNetwork: true,
  walletId,
  accountId,
});

const ids = () =>
  swrCacheUtils.get<IServerNetwork[]>(slotKey)?.map((n) => n.id);

const emitRecorded = (recorded: IServerNetwork) =>
  act(() => {
    appEventBus.emit(EAppEventBusNames.RecentNetworkRecorded, {
      network: recorded,
    });
  });

// The compatibility lookup resolves off the event; drain it so a negative
// assertion is not just racing the pending promise.
const flushLookup = () => act(async () => Promise.resolve());

describe('useRecentNetworksCacheSync', () => {
  beforeEach(() => {
    mockGetCompatibleNetworks.mockReset();
    swrCacheUtils.clearAll();
    swrCacheUtils.set(slotKey, [network('sol--101'), network('btc--0')]);
  });

  afterAll(() => {
    swrCacheUtils.flushNow();
  });

  it('prepends a network the wallet can use, recorded by any runtime, into the home selector slot', async () => {
    mockGetCompatibleNetworks.mockResolvedValue({
      mainnetItems: [network('evm--1')],
      testnetItems: [],
    });
    renderHook(() =>
      useRecentNetworksCacheSync({ enabled: true, walletId, accountId }),
    );
    emitRecorded(network('evm--1'));
    await waitFor(() =>
      expect(ids()).toEqual(['evm--1', 'sol--101', 'btc--0']),
    );
    expect(mockGetCompatibleNetworks).toHaveBeenCalledWith({
      accountId,
      walletId,
      networkIds: ['evm--1'],
    });
  });

  it('ignores a recorded network the current wallet cannot use', async () => {
    mockGetCompatibleNetworks.mockResolvedValue({
      mainnetItems: [],
      testnetItems: [],
    });
    renderHook(() =>
      useRecentNetworksCacheSync({ enabled: true, walletId, accountId }),
    );
    emitRecorded(network('tron--0x2b6653dc'));
    await waitFor(() =>
      expect(mockGetCompatibleNetworks).toHaveBeenCalledTimes(1),
    );
    await flushLookup();
    expect(ids()).toEqual(['sol--101', 'btc--0']);
  });

  it('leaves the slot alone when the compatibility lookup fails', async () => {
    mockGetCompatibleNetworks.mockRejectedValue(new Error('offline'));
    renderHook(() =>
      useRecentNetworksCacheSync({ enabled: true, walletId, accountId }),
    );
    emitRecorded(network('evm--1'));
    await waitFor(() =>
      expect(mockGetCompatibleNetworks).toHaveBeenCalledTimes(1),
    );
    await flushLookup();
    expect(ids()).toEqual(['sol--101', 'btc--0']);
  });

  it('prepends All Networks without a compatibility round-trip', async () => {
    const allNetworkId = getNetworkIdsMap().onekeyall;
    renderHook(() =>
      useRecentNetworksCacheSync({ enabled: true, walletId, accountId }),
    );
    emitRecorded(network(allNetworkId));
    await waitFor(() =>
      expect(ids()).toEqual([allNetworkId, 'sol--101', 'btc--0']),
    );
    expect(mockGetCompatibleNetworks).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', async () => {
    const { unmount } = renderHook(() =>
      useRecentNetworksCacheSync({ enabled: true, walletId, accountId }),
    );
    unmount();
    emitRecorded(network('evm--1'));
    await flushLookup();
    expect(mockGetCompatibleNetworks).not.toHaveBeenCalled();
    expect(ids()).toEqual(['sol--101', 'btc--0']);
  });

  it('does nothing when disabled or without a wallet', async () => {
    renderHook(() =>
      useRecentNetworksCacheSync({ enabled: false, walletId, accountId }),
    );
    renderHook(() =>
      useRecentNetworksCacheSync({
        enabled: true,
        walletId: undefined,
        accountId,
      }),
    );
    emitRecorded(network('evm--1'));
    await flushLookup();
    expect(mockGetCompatibleNetworks).not.toHaveBeenCalled();
    expect(ids()).toEqual(['sol--101', 'btc--0']);
  });
});
