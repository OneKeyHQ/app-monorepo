import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type {
  ILocalWalletSyncErrorKind,
  ILocalWalletSyncProgress,
} from '../../../vaults/localWallet/types';

export type IPrivacyChainScanState = {
  progress: Record<string, ILocalWalletSyncProgress>;
  boostingNetworkIds: string[];
  // Networks that want the foreground pace but wait for metered-data consent.
  dataBlockedNetworkIds: string[];
  pausedNetworkIds: string[];
  // Networks whose runtime cannot store its database here (outdated WebView);
  // not retried this session.
  storageUnsupportedNetworkIds: string[];
  syncErrorByNetworkId: Record<string, ILocalWalletSyncErrorKind>;
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
      syncErrorByNetworkId: {},
    },
  });
