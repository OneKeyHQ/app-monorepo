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

const compatible = (...ids: string[]): ICompatibleNetworksResp => ({
  mainnetItems: ids.map(network),
  testnetItems: [],
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

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

const emitCleared = () =>
  act(() => {
    appEventBus.emit(EAppEventBusNames.RecentNetworksCleared, undefined);
  });

// The compatibility lookup resolves off the event; drain it so a negative
// assertion is not just racing the pending promise.
const flushLookup = () => act(async () => Promise.resolve());

const mountSync = () =>
  renderHook(() =>
    useRecentNetworksCacheSync({ enabled: true, walletId, accountId }),
  );

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
    mockGetCompatibleNetworks.mockResolvedValue(compatible('evm--1'));
    mountSync();
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
    mockGetCompatibleNetworks.mockResolvedValue(compatible());
    mountSync();
    emitRecorded(network('tron--0x2b6653dc'));
    await waitFor(() =>
      expect(mockGetCompatibleNetworks).toHaveBeenCalledTimes(1),
    );
    await flushLookup();
    expect(ids()).toEqual(['sol--101', 'btc--0']);
  });

  it('leaves the slot alone when the compatibility lookup fails', async () => {
    mockGetCompatibleNetworks.mockRejectedValue(new Error('offline'));
    mountSync();
    emitRecorded(network('evm--1'));
    await waitFor(() =>
      expect(mockGetCompatibleNetworks).toHaveBeenCalledTimes(1),
    );
    await flushLookup();
    expect(ids()).toEqual(['sol--101', 'btc--0']);
  });

  it('never writes All Networks: the home selector chips cannot return it', async () => {
    mountSync();
    emitRecorded(network(getNetworkIdsMap().onekeyall));
    await flushLookup();
    expect(mockGetCompatibleNetworks).not.toHaveBeenCalled();
    expect(ids()).toEqual(['sol--101', 'btc--0']);
  });

  it('keeps recording order when an earlier lookup resolves last', async () => {
    const first = deferred<ICompatibleNetworksResp>();
    mockGetCompatibleNetworks
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve(compatible('evm--56')));
    mountSync();
    emitRecorded(network('evm--1'));
    emitRecorded(network('evm--56'));
    await flushLookup();
    // The second lookup waits for the first; nothing is written yet.
    expect(mockGetCompatibleNetworks).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(['sol--101', 'btc--0']);

    await act(async () => {
      first.resolve(compatible('evm--1'));
    });
    await waitFor(() =>
      expect(ids()).toEqual(['evm--56', 'evm--1', 'sol--101', 'btc--0']),
    );
  });

  it('drops a lookup that was still in flight when the history was cleared', async () => {
    const pending = deferred<ICompatibleNetworksResp>();
    mockGetCompatibleNetworks.mockImplementationOnce(() => pending.promise);
    mountSync();
    emitRecorded(network('evm--1'));
    // Clear: bg announces it and the chips' fetch writes the empty list.
    emitCleared();
    swrCacheUtils.set(slotKey, []);

    await act(async () => {
      pending.resolve(compatible('evm--1'));
    });
    await flushLookup();
    expect(ids()).toEqual([]);
  });

  it('still records networks that arrive after a clear', async () => {
    mockGetCompatibleNetworks.mockResolvedValue(compatible('evm--1'));
    mountSync();
    emitCleared();
    swrCacheUtils.set(slotKey, []);
    emitRecorded(network('evm--1'));
    await waitFor(() => expect(ids()).toEqual(['evm--1']));
  });

  it('stops listening after unmount', async () => {
    const { unmount } = mountSync();
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
