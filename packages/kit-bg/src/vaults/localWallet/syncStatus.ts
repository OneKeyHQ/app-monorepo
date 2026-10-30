import { getPrivacyChainBlocksLeft } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

import type {
  ILocalWalletAccountState,
  ILocalWalletSyncErrorKind,
  ILocalWalletSyncProgress,
} from './types';
import type { IPrivacyChainScanState } from '../../states/jotai/atoms/privacyChain';

// The one sync status every surface shows, highest priority first.
export type ILocalWalletSyncStatus =
  | 'unavailable'
  | 'enabling'
  | 'accountPaused'
  | 'off'
  | 'chainPaused'
  | 'storageUnsupported'
  | 'waitingWifi'
  | 'error'
  | 'preparing'
  | 'syncing'
  | 'synced';

// Nothing scans the account in these; a balance it shows is only as new as its last scan.
const SCAN_STOPPED_STATUSES = new Set<ILocalWalletSyncStatus>([
  'unavailable',
  'enabling',
  'accountPaused',
  'off',
  'chainPaused',
  'storageUnsupported',
]);

export function isLocalWalletScanStopped(
  status: ILocalWalletSyncStatus,
): boolean {
  return SCAN_STOPPED_STATUSES.has(status);
}

export type ILocalWalletSyncStatusView = {
  status: ILocalWalletSyncStatus;
  // The furthest-behind position, for the figures beside the status.
  progress?: ILocalWalletSyncProgress;
  syncError?: ILocalWalletSyncErrorKind;
};

function getScanStatus({
  scan,
  networkId,
  progresses,
  preparing,
  syncedBelowBlocks,
}: {
  scan: IPrivacyChainScanState;
  networkId: string;
  progresses: ILocalWalletSyncProgress[];
  preparing: boolean;
  syncedBelowBlocks: number;
}): ILocalWalletSyncStatusView {
  // An account still queued (no position yet) must not hide work already advancing beside it.
  let progress: ILocalWalletSyncProgress | undefined;
  let mostBlocksLeft = -1;
  let hasUnknown = false;
  for (const item of progresses) {
    const left = getPrivacyChainBlocksLeft(item);
    if (left === null) {
      hasUnknown = true;
    } else if (left > mostBlocksLeft) {
      mostBlocksLeft = left;
      progress = item;
    }
  }
  if (scan.pausedNetworkIds.includes(networkId)) {
    return { status: 'chainPaused', progress };
  }
  if (scan.storageUnsupportedNetworkIds.includes(networkId)) {
    return { status: 'storageUnsupported' };
  }
  const isSynced =
    progress !== undefined && !hasUnknown && mostBlocksLeft < syncedBelowBlocks;
  if (scan.dataBlockedNetworkIds.includes(networkId) && !isSynced) {
    return { status: 'waitingWifi', progress };
  }
  const syncError = scan.syncErrorByNetworkId[networkId];
  if (syncError) {
    return { status: 'error', progress, syncError };
  }
  if (preparing || !progress) {
    return { status: 'preparing' };
  }
  return { status: isSynced ? 'synced' : 'syncing', progress };
}

// One account. `progress` covers an account no pass has published yet; a published one wins.
export function getLocalWalletAccountSyncStatus({
  scan,
  networkId,
  accountId,
  account,
  unavailable = false,
  progress,
  syncedBelowBlocks,
}: {
  scan: IPrivacyChainScanState;
  networkId: string;
  accountId: string;
  account: Pick<
    ILocalWalletAccountState,
    'enabled' | 'paused' | 'pendingOperation' | 'privacyDisabled'
  >;
  // A wallet that cannot scan here (temp, watch-only, unsupported hardware).
  unavailable?: boolean;
  progress?: ILocalWalletSyncProgress;
  syncedBelowBlocks: number;
}): ILocalWalletSyncStatusView {
  const key = `${networkId}:${accountId}`;
  const published = scan.progress[key] ?? progress;
  if (unavailable || account.privacyDisabled) return { status: 'unavailable' };
  if (account.pendingOperation === 'enable') return { status: 'enabling' };
  if (account.paused) return { status: 'accountPaused', progress: published };
  if (!account.enabled) return { status: 'off' };
  return getScanStatus({
    scan,
    networkId,
    progresses: published ? [published] : [],
    preparing: scan.preparingAccountKeys.includes(key),
    syncedBelowBlocks,
  });
}

// A whole chain, or the given accounts of it, from published state only.
export function getLocalWalletNetworkSyncStatus({
  scan,
  networkId,
  accountIds,
  syncedBelowBlocks,
}: {
  scan: IPrivacyChainScanState;
  networkId: string;
  accountIds?: string[];
  syncedBelowBlocks: number;
}): ILocalWalletSyncStatusView {
  const prefix = `${networkId}:`;
  const isIncluded = (key: string) =>
    key.startsWith(prefix) &&
    (!accountIds || accountIds.includes(key.slice(prefix.length)));
  return getScanStatus({
    scan,
    networkId,
    progresses: Object.keys(scan.progress)
      .filter(isIncluded)
      .map((key) => scan.progress[key]),
    preparing: scan.preparingAccountKeys.some(isIncluded),
    syncedBelowBlocks,
  });
}
