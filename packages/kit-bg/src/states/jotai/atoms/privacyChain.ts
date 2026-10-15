import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { ILocalWalletSyncProgress } from '../../../vaults/localWallet/types';

// Live scan state for privacy chains, published once per pass by the scheduler; not persisted (derived, rebuildable).

export type IPrivacyChainScanState = {
  // Keyed `${networkId}:${accountId}`.
  progress: Record<string, ILocalWalletSyncProgress>;
  // Which networks are running at the foreground pace; drives the always-on light and in-page banners so they can't drift apart.
  boostingNetworkIds: string[];
  // Networks that want the foreground pace but can't until the user allows metered data; published
  // separately from `boostingNetworkIds` since the two drive different UI (hold-awake+pause vs. consent).
  dataBlockedNetworkIds: string[];
  // Networks the user paused; published so the light can show a paused state instead of disappearing.
  pausedNetworkIds: string[];
  // Networks whose runtime cannot store its database on this device (outdated WebView); never retried this session.
  storageUnsupportedNetworkIds: string[];
};

export const { target: privacyChainAtom, use: usePrivacyChainAtom } =
  globalAtom<IPrivacyChainScanState>({
    persist: false,
    name: EAtomNames.privacyChainAtom,
    initialValue: {
      progress: {},
      boostingNetworkIds: [],
      dataBlockedNetworkIds: [],
      pausedNetworkIds: [],
      storageUnsupportedNetworkIds: [],
    },
  });
