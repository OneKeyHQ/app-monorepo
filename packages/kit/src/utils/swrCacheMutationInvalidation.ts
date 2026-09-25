/**
 * The UI runtime drops its own snapshot entries when an entity changes.
 *
 * These namespaces hold what a screen last displayed — wallet and account
 * names, the selector's sections, the bulk-address seeds — so a create,
 * rename or delete makes them wrong, and a screen that is not mounted has no
 * hook to refresh. The entries belong to this runtime's hooks, so the drop
 * belongs here too.
 *
 * bg used to do it and announce the removal across the runtime boundary. That
 * put a second writer on files this runtime owns, and the announcement had to
 * be answered by whoever performed the delete, which with more than one
 * foreground open (an extension popup and a side panel) became a loop between
 * them. The mutation events already reach every runtime, so nothing has to
 * cross for the cache's sake.
 *
 * `flushNow` rather than the debounce: a force-kill between the drop and the
 * next flush would leave a deleted wallet in the store, to be primed and
 * painted on the next cold open.
 */
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  prefixOf,
  swrCacheNamespaces,
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';

const dropWalletListSwr = () =>
  swrCacheUtils.removeByPrefix(prefixOf(swrCacheNamespaces.walletListSideBar));

const dropAccountSelectorListSwr = () =>
  swrCacheUtils.removeByPrefix(
    prefixOf(swrCacheNamespaces.accountSelectorList),
  );

// Displayed balances are keyed by wallet and account ids and do not depend on
// names or list structure, so only removals drop them.
const dropAccountSelectorValuesSwr = () =>
  swrCacheUtils.removeByPrefix(
    prefixOf(swrCacheNamespaces.accountSelectorValues),
  );

// Bulk copy / bulk send snapshot wallet objects, account groups and the seeded
// sender (names, addresses, xpubs) with no TTL, so they follow the same
// contract: a mutation drops the namespaces and the next mount repopulates,
// instead of painting (and exporting) a deleted or renamed entity.
const dropBulkAddressSwr = () => {
  swrCacheUtils.removeByPrefix(
    prefixOf(swrCacheNamespaces.bulkCopyAddressesWallets),
  );
  swrCacheUtils.removeByPrefix(
    prefixOf(swrCacheNamespaces.bulkCopyAddressesNetworkIds),
  );
  swrCacheUtils.removeByPrefix(
    prefixOf(swrCacheNamespaces.bulkCopyAddressesAccounts),
  );
  swrCacheUtils.removeByPrefix(
    prefixOf(swrCacheNamespaces.bulkSendAddressesInputSeed),
  );
};

const dropDiscoveryBookmarksSwr = () =>
  swrCacheUtils.removeByPrefix(
    prefixOf(swrCacheNamespaces.discoveryHomeBookmarks),
  );

const dropAccountScopedSwr = () => {
  [
    swrCacheNamespaces.earnAccount,
    swrCacheNamespaces.borrowReserves,
    swrCacheNamespaces.borrowHealthFactor,
    swrCacheNamespaces.borrowRewards,
    swrCacheNamespaces.borrowEModeStatus,
  ].forEach((namespace) => {
    swrCacheUtils.removeByPrefix(prefixOf(namespace));
  });
};

/**
 * Wait for the removal to reach disk, and record it when it did not.
 *
 * Awaited, not fire-and-forget: on web and the extension the snapshot store
 * commits its deletes behind a debounce of its own, and an extension popup
 * closed right after the deletion takes that timer with it.
 *
 * A store that could not write says so rather than throwing, and there is
 * nothing here that can mend it — the wallet is already gone from the
 * database, and failing the deletion over a display cache would be worse than
 * the stale frame it would prevent. So the outcome is recorded and the caller
 * continues; the store retries on its own while this surface lives.
 */
async function persistRemoval(reason: 'removedWallet' | 'removedAccount') {
  const persisted = await swrCacheUtils.flushNowAndPersist();
  if (!persisted) {
    defaultLogger.app.perf.swrCacheRemovalNotPersisted({ reason });
  }
}

/**
 * The drop the runtime that asked for the deletion performs itself.
 *
 * The listener below already covers it, but only once bg's event has crossed
 * back. This runtime is the one that is certainly alive at this point — it is
 * awaiting the call — so doing it here means a process that goes down in
 * between cannot leave the deleted entity in the store. Both paths delete, and
 * a delete is idempotent.
 */
export async function dropSwrCacheForRemovedWallet(walletId: string) {
  swrCacheUtils.remove(swrKeys.accountSelectorValues({ walletId }));
  dropWalletListSwr();
  dropAccountSelectorListSwr();
  dropBulkAddressSwr();
  dropAccountScopedSwr();
  await persistRemoval('removedWallet');
}

export async function dropSwrCacheForRemovedAccount() {
  dropWalletListSwr();
  dropAccountSelectorListSwr();
  dropAccountSelectorValuesSwr();
  dropBulkAddressSwr();
  dropAccountScopedSwr();
  await persistRemoval('removedAccount');
}

let registered = false;

export function registerSwrCacheMutationInvalidation() {
  if (registered) {
    return;
  }
  registered = true;

  const dropAccountShapeSwr = () => {
    dropWalletListSwr();
    dropAccountSelectorListSwr();
    dropBulkAddressSwr();
  };

  const dropAccountShapeAndScopedSwr = () => {
    dropAccountShapeSwr();
    dropAccountScopedSwr();
    swrCacheUtils.flushNow();
  };

  appEventBus.on(EAppEventBusNames.WalletUpdate, dropAccountShapeAndScopedSwr);
  appEventBus.on(EAppEventBusNames.AccountUpdate, dropAccountShapeAndScopedSwr);
  appEventBus.on(EAppEventBusNames.WalletRename, () => {
    dropAccountShapeSwr();
    swrCacheUtils.flushNow();
  });
  appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, () => {
    dropAccountShapeSwr();
    swrCacheUtils.flushNow();
  });
  appEventBus.on(EAppEventBusNames.RenameDBAccounts, () => {
    // The sidebar does not show account names, only the right panel's
    // sectionData does.
    dropAccountSelectorListSwr();
    dropBulkAddressSwr();
    swrCacheUtils.flushNow();
  });
  appEventBus.on(EAppEventBusNames.AccountRemove, () => {
    // The sidebar depends on accounts too, via
    // ignoreEmptySingletonWalletAccounts.
    dropWalletListSwr();
    dropAccountSelectorListSwr();
    dropAccountSelectorValuesSwr();
    dropBulkAddressSwr();
    dropAccountScopedSwr();
    swrCacheUtils.flushNow();
  });
  appEventBus.on(EAppEventBusNames.WalletRemove, ({ walletId }) => {
    swrCacheUtils.remove(swrKeys.accountSelectorValues({ walletId }));
    swrCacheUtils.flushNow();
  });
  appEventBus.on(EAppEventBusNames.WalletClear, () => {
    // Not just the wallet-shaped namespaces: this wipes the wallet and account
    // database, and a reset re-uses wallet ids (`hd-1`), so any namespace
    // keyed by one — the network selector's, the token selectors', Earn,
    // Borrow — would carry the previous profile's snapshot into the new one.
    // bg's namespaces are left to bg; see `clearUiOwnedNamespaces`.
    swrCacheUtils.clearUiOwnedNamespaces();
  });

  // Both events are emitted by the bookmark mutation itself; which one depends
  // on whether mounted views are being refreshed.
  appEventBus.on(EAppEventBusNames.RefreshBookmarkList, () => {
    dropDiscoveryBookmarksSwr();
    swrCacheUtils.flushNow();
  });
  appEventBus.on(
    EAppEventBusNames.InvalidateDiscoveryHomeBookmarksPrefetch,
    () => {
      dropDiscoveryBookmarksSwr();
      swrCacheUtils.flushNow();
    },
  );
}
