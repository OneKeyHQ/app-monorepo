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
    earnAccount: 'earnAccount',
    borrowReserves: 'borrowReserves',
    borrowHealthFactor: 'borrowHealthFactor',
    borrowRewards: 'borrowRewards',
    borrowEModeStatus: 'borrowEModeStatus',
  },
  swrCacheUtils: {
    remove: jest.fn(),
    removeByPrefix: jest.fn(),
    flushNow: jest.fn(),
    flushNowAndPersist: jest.fn(() => Promise.resolve(true)),
    clearUiOwnedNamespaces: jest.fn(),
  },
  swrKeys: {
    accountSelectorValues: jest.fn(
      ({ walletId }: { walletId: string }) => `accSelValues:v1:${walletId}`,
    ),
  },
}));

const mockRemovalNotPersisted = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      perf: {
        swrCacheRemovalNotPersisted: (params: unknown) => {
          mockRemovalNotPersisted(params);
        },
      },
    },
  },
}));

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

import {
  dropSwrCacheForRemovedAccount,
  dropSwrCacheForRemovedWallet,
  registerSwrCacheMutationInvalidation,
} from './swrCacheMutationInvalidation';

const BULK_PREFIXES = [
  'bulkCopyWallets:',
  'bulkCopyNetIds:',
  'bulkCopyAccounts:',
  'bulkSendSeed:',
];
const ACCOUNT_SCOPED_PREFIXES = [
  'earnAccount:',
  'borrowReserves:',
  'borrowHealthFactor:',
  'borrowRewards:',
  'borrowEModeStatus:',
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
    // `clearAllMocks` drops the recorded calls but keeps an implementation a
    // previous case installed, so the committed case is restored here.
    (swrCacheUtils.flushNowAndPersist as jest.Mock).mockResolvedValue(true);
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
      ...ACCOUNT_SCOPED_PREFIXES,
    ]);
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(1);
  });

  it('drops account-scoped snapshots when an account is updated', () => {
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);

    expect(droppedPrefixes()).toEqual([
      'walletList:',
      'accSelList:',
      ...BULK_PREFIXES,
      ...ACCOUNT_SCOPED_PREFIXES,
    ]);
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(1);
  });

  it('leaves the displayed balances alone when an account is renamed', () => {
    appEventBus.emit(EAppEventBusNames.RenameDBAccounts, { accounts: [] });

    // The sidebar does not show account names.
    expect(droppedPrefixes()).toEqual(['accSelList:', ...BULK_PREFIXES]);
  });

  it('wipes every namespace this runtime owns when the wallet db is cleared', () => {
    appEventBus.emit(EAppEventBusNames.WalletClear, undefined);

    // Not a list of wallet-shaped prefixes: a reset re-uses wallet ids, so a
    // namespace keyed by one would carry the previous profile's snapshot.
    expect(swrCacheUtils.clearUiOwnedNamespaces).toHaveBeenCalledTimes(1);
    expect(droppedPrefixes()).toEqual([]);
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

  it.each([
    ['a removed wallet', () => dropSwrCacheForRemovedWallet('hd-1')],
    ['a removed account', () => dropSwrCacheForRemovedAccount()],
  ])('waits for the store to commit its deletes for %s', async (_, drop) => {
    // An extension popup closed right after the deletion takes the snapshot
    // store's own debounce timer with it, and the generic app-background flush
    // does not cover extension surfaces — so the caller has to be able to wait
    // for the commit, not just for the intent.
    let commit = () => {};
    (swrCacheUtils.flushNowAndPersist as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          commit = resolve;
        }),
    );

    let returned = false;
    const pending = drop().then(() => {
      returned = true;
    });

    // The removals are recorded before the wait, and the wait is real.
    expect(droppedPrefixes()).toContain('walletList:');
    await Promise.resolve();
    expect(returned).toBe(false);

    commit();
    await pending;
    expect(returned).toBe(true);
  });

  it.each([
    ['removedWallet', () => dropSwrCacheForRemovedWallet('hd-1')],
    ['removedAccount', () => dropSwrCacheForRemovedAccount()],
  ])(
    'records a removal the store could not commit for %s',
    async (reason, drop) => {
      // The store re-queues a batch it could not write and retries it on a timer
      // — which an extension popup, closing right after the deletion, takes with
      // it. Nothing here can mend that, so the outcome is recorded rather than
      // thrown, and the caller still returns.
      (swrCacheUtils.flushNowAndPersist as jest.Mock).mockResolvedValue(false);

      await expect(drop()).resolves.toBeUndefined();

      expect(mockRemovalNotPersisted).toHaveBeenCalledWith({ reason });
    },
  );

  it('records nothing when the store committed', async () => {
    await dropSwrCacheForRemovedAccount();

    expect(mockRemovalNotPersisted).not.toHaveBeenCalled();
  });

  it('registers once, however many times it is called', () => {
    registerSwrCacheMutationInvalidation();
    registerSwrCacheMutationInvalidation();

    appEventBus.emit(EAppEventBusNames.WalletRemove, { walletId: 'hd-1' });

    expect(swrCacheUtils.remove).toHaveBeenCalledTimes(1);
    expect(swrCacheUtils.flushNow).toHaveBeenCalledTimes(1);
  });
});
