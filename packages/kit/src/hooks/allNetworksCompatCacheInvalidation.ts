import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { swrCacheNamespaces } from '@onekeyhq/shared/src/utils/swrCacheNamespaceNames';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';

/**
 * Drops every cached "enabled networks compatible with this account" result.
 * The entries are keyed per wallet/account but computed from the global
 * enabled-network set, so a change to that set leaves every other account's
 * entry describing the previous selection. The Home network chip serves the
 * entry synchronously on an account switch (SWR), which showed the old
 * selection until the query re-ran.
 */
export function invalidateAllNetworksCompatCache() {
  swrCacheUtils.removeByPrefix(`${swrCacheNamespaces.allNetworksCompatible}:`);
}

let registered = false;

/** Idempotent: wires the invalidation to the enabled-set change event. */
export function registerAllNetworksCompatCacheInvalidation() {
  if (registered) {
    return;
  }
  registered = true;
  appEventBus.on(
    EAppEventBusNames.EnabledNetworksChanged,
    invalidateAllNetworksCompatCache,
  );
}
