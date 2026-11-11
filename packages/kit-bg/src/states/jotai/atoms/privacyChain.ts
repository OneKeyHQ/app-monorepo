import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type {
  ILocalWalletSyncErrorKind,
  ILocalWalletSyncProgress,
} from '../../../vaults/localWallet/types';

export type IPrivacyChainScanState = {
  progress: Record<string, ILocalWalletSyncProgress>;
  // Completion is authoritative even when a best-effort position read fails.
  completedScanByAccount?: Record<
    string,
    { sessionId: string; sequence: number }
  >;
  boostingNetworkIds: string[];
  // Networks that want the foreground pace but wait for metered-data consent.
  dataBlockedNetworkIds: string[];
  // Paused by the user for the whole chain; the server's switch shows as unavailable instead.
  pausedNetworkIds: string[];
  // `networkId:accountId` the user started (Sync, enable) that have not published a position since.
  preparingAccountKeys: string[];
  // Networks whose runtime cannot store its database here (outdated WebView);
  // not retried this session.
  storageUnsupportedNetworkIds: string[];
  syncErrorByNetworkId: Record<string, ILocalWalletSyncErrorKind>;
  // Metered-data consent, the same for every chain; unknown until the stored answer is read.
  allowCellularSync?: boolean;
  // The scheduling gate also applies to quiet refreshes without a foreground boost.
  scanAllowed?: boolean;
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
      preparingAccountKeys: [],
      storageUnsupportedNetworkIds: [],
      syncErrorByNetworkId: {},
    },
  });
