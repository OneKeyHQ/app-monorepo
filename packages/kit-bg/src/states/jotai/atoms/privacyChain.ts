import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { ILocalWalletSyncProgress } from '../../../vaults/localWallet/types';

// Live scan state published by the scheduler after each pass; not persisted.

export type IPrivacyChainScanState = {
  // Keyed `${networkId}:${accountId}`.
  progress: Record<string, ILocalWalletSyncProgress>;
  // Networks at the foreground pace; the light and in-page banners both read it.
  boostingNetworkIds: string[];
  // Networks that want the foreground pace but wait for metered-data consent.
  dataBlockedNetworkIds: string[];
  // Networks the user paused, so the light can show a paused state.
  pausedNetworkIds: string[];
  // Networks whose runtime cannot store its database here (outdated WebView);
  // not retried this session.
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
