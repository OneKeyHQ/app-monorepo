/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  prefixOf: jest.fn((namespace: string) => `${namespace}:`),
  swrCacheNamespaces: {
    walletListSideBar: 'walletList',
    accountSelectorList: 'accSelList',
    accountSelectorValues: 'accSelValues',
    bulkCopyAddressesWallets: 'bulkCopyWallets',
    bulkCopyAddressesNetworkIds: 'bulkCopyNetIds',
    bulkCopyAddressesAccounts: 'bulkCopyAccounts',
    bulkSendAddressesInputSeed: 'bulkSendSeed',
    discoveryHomeBookmarks: 'disHomeBookmarks',
  },
  swrCacheUtils: {
    remove: jest.fn(),
    removeByPrefix: jest.fn(),
    flushNow: jest.fn(),
  },
  swrKeys: {
    accountSelectorValues: jest.fn(
      ({ walletId }: { walletId: string }) => `accSelValues:v1:${walletId}`,
    ),
  },
}));

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import { registerSwrCacheMutationInvalidation } from './swrCacheMutationInvalidation';

const BULK_PREFIXES = [
  'bulkCopyWallets:',
  'bulkCopyNetIds:',
  'bulkCopyAccounts:',
  'bulkSendSeed:',
];

function droppedPrefixes() {
  return (swrCacheUtils.removeByPrefix as jest.Mock).mock.calls.map(
    ([prefix]) => prefix as string,
  );
}

describe('swrCacheMutationInvalidation', () => {
  beforeAll(() => {
    registerSwrCacheMutationInvalidation();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drops the shape namespaces when a wallet is renamed', () => {
    appEventBus.emit(EAppEventBusNames.WalletRename, { walletId: 'hd-1' });

    expect(droppedPrefixes()).toEqual([
      'walletList:',
      'accSelList:',
      ...BULK_PREFIXES,
    ]);
    // Immediately, so a force-kill cannot leave the renamed wallet in the
    // store for the next cold open to paint.
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(1);
  });

  it('drops only the displayed balances of the removed wallet', () => {
    appEventBus.emit(EAppEventBusNames.WalletRemove, { walletId: 'hd-1' });

    expect(swrCacheUtils.remove).toHaveBeenCalledWith('accSelValues:v1:hd-1');
    expect(droppedPrefixes()).toEqual([]);
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(1);
  });

  it('drops the displayed balances too when an account is removed', () => {
    appEventBus.emit(EAppEventBusNames.AccountRemove, undefined);

    expect(droppedPrefixes()).toEqual([
      'walletList:',
      'accSelList:',
      'accSelValues:',
      ...BULK_PREFIXES,
    ]);
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(1);
  });

  it('leaves the displayed balances alone when an account is renamed', () => {
    appEventBus.emit(EAppEventBusNames.RenameDBAccounts, { accounts: [] });

    // The sidebar does not show account names.
    expect(droppedPrefixes()).toEqual(['accSelList:', ...BULK_PREFIXES]);
  });

  it('drops the bookmark namespace on either bookmark announcement', () => {
    appEventBus.emit(EAppEventBusNames.RefreshBookmarkList, undefined);
    appEventBus.emit(
      EAppEventBusNames.InvalidateDiscoveryHomeBookmarksPrefetch,
      undefined,
    );

    expect(droppedPrefixes()).toEqual([
      'disHomeBookmarks:',
      'disHomeBookmarks:',
    ]);
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(2);
  });

  it('registers once, however many times it is called', () => {
    registerSwrCacheMutationInvalidation();
    registerSwrCacheMutationInvalidation();

    appEventBus.emit(EAppEventBusNames.WalletRemove, { walletId: 'hd-1' });

    expect(swrCacheUtils.remove).toHaveBeenCalledTimes(1);
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(1);
  });
});
