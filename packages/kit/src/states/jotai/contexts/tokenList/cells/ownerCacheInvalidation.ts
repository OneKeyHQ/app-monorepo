import { registerOwnerWorthCacheInvalidation } from '@onekeyhq/kit/src/views/Home/components/TokenListBlock/ownerWorthCache';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { tokenListOwnerSlimCache } from '@onekeyhq/shared/src/storage/uiSnapshotCaches';

import { clearOwnerReplayCache } from './ownerFrameReplayCache';

let registered = false;

/**
 * Drop the home token list's per-owner caches when a wallet or account is
 * removed, or the wallet is cleared, so a re-created owner (ids are reused
 * after deletion / clear) never replays the snapshot it had before. The replay
 * sources must go in both layers: the main-heap frames AND the persisted
 * per-owner slim slots, which outlive the process (iOS/Android: native MMKV
 * shared with `bg`, which never reads them, so the clear from `main` is
 * sufficient; extension: per-runtime storage; desktop/web: single runtime).
 * Whole-namespace clear: the next switch to any surviving owner re-fills both
 * layers from the PULL. The per-owner header worth goes with them.
 *
 * `Bootstrap` registers this at startup. Registering on the home token list's
 * first use missed a removal made before then, which left the persisted slots
 * behind for up to their retention (PR #13695 review).
 */
export function registerHomeTokenListOwnerCacheInvalidation(): void {
  registerOwnerWorthCacheInvalidation();
  if (registered) {
    return;
  }
  registered = true;
  const clear = () => {
    clearOwnerReplayCache();
    try {
      tokenListOwnerSlimCache.clear();
    } catch {
      /* best-effort */
    }
  };
  appEventBus.on(EAppEventBusNames.WalletRemove, clear);
  appEventBus.on(EAppEventBusNames.AccountRemove, clear);
  appEventBus.on(EAppEventBusNames.WalletClear, clear);
}
