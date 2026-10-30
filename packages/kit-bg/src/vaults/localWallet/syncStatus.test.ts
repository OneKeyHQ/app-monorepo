import {
  getLocalWalletAccountSyncStatus,
  getLocalWalletNetworkSyncStatus,
} from './syncStatus';

import type { ILocalWalletSyncProgress } from './types';
import type { IPrivacyChainScanState } from '../../states/jotai/atoms/privacyChain';

const networkId = 'xmr--0';
const syncedBelowBlocks = 100;

const position = (blocksLeft: number): ILocalWalletSyncProgress => ({
  birthdayHeight: 1000,
  backfillScannedHeight: 10_000 - blocksLeft,
  backfillTargetHeight: 10_000,
  backfillProgress: 0.5,
  isBackfillComplete: blocksLeft === 0,
  tipScannedHeight: 10_000 - blocksLeft,
  chainTip: 10_000,
  tipLag: 0,
  isTipCaughtUp: blocksLeft === 0,
  isSyncing: blocksLeft > 0,
});

const scanState = (
  overrides: Partial<IPrivacyChainScanState> = {},
): IPrivacyChainScanState => ({
  progress: {},
  boostingNetworkIds: [],
  dataBlockedNetworkIds: [],
  pausedNetworkIds: [],
  preparingAccountKeys: [],
  storageUnsupportedNetworkIds: [],
  syncErrorByNetworkId: {},
  ...overrides,
});

const enabled = { enabled: true, paused: false };

const statusOf = (
  scan: IPrivacyChainScanState,
  account: Parameters<
    typeof getLocalWalletAccountSyncStatus
  >[0]['account'] = enabled,
  extra: { unavailable?: boolean; progress?: ILocalWalletSyncProgress } = {},
) =>
  getLocalWalletAccountSyncStatus({
    scan,
    networkId,
    accountId: 'a',
    account,
    syncedBelowBlocks,
    ...extra,
  }).status;

describe('getLocalWalletAccountSyncStatus', () => {
  it('ranks what blocks scanning above what the scan reports', () => {
    const everything = scanState({
      progress: { [`${networkId}:a`]: position(5000) },
      pausedNetworkIds: [networkId],
      storageUnsupportedNetworkIds: [networkId],
      dataBlockedNetworkIds: [networkId],
      syncErrorByNetworkId: { [networkId]: 'failed' },
      preparingAccountKeys: [`${networkId}:a`],
    });
    expect(statusOf(everything, enabled, { unavailable: true })).toBe(
      'unavailable',
    );
    expect(statusOf(everything, { ...enabled, privacyDisabled: true })).toBe(
      'unavailable',
    );
    expect(
      statusOf(everything, {
        enabled: false,
        paused: false,
        pendingOperation: 'enable',
      }),
    ).toBe('enabling');
    expect(statusOf(everything, { enabled: false, paused: true })).toBe(
      'accountPaused',
    );
    expect(statusOf(everything, { enabled: false, paused: false })).toBe('off');
    expect(statusOf(everything)).toBe('chainPaused');
    expect(statusOf({ ...everything, pausedNetworkIds: [] })).toBe(
      'storageUnsupported',
    );
    expect(
      statusOf({
        ...everything,
        pausedNetworkIds: [],
        storageUnsupportedNetworkIds: [],
      }),
    ).toBe('waitingWifi');
    expect(
      statusOf({
        ...everything,
        pausedNetworkIds: [],
        storageUnsupportedNetworkIds: [],
        dataBlockedNetworkIds: [],
      }),
    ).toBe('error');
    expect(
      statusOf({
        ...everything,
        pausedNetworkIds: [],
        storageUnsupportedNetworkIds: [],
        dataBlockedNetworkIds: [],
        syncErrorByNetworkId: {},
      }),
    ).toBe('preparing');
  });

  it('calls an account synced below the threshold, the same one sending uses', () => {
    const at = (blocksLeft: number) =>
      statusOf(
        scanState({ progress: { [`${networkId}:a`]: position(blocksLeft) } }),
      );
    expect(at(syncedBelowBlocks)).toBe('syncing');
    expect(at(syncedBelowBlocks - 1)).toBe('synced');
  });

  // Mobile data holds the whole chain, but an account with nothing to scan has nothing to wait for.
  it('keeps a synced account synced while its chain waits for Wi-Fi', () => {
    const held = (blocksLeft: number) =>
      statusOf(
        scanState({
          progress: { [`${networkId}:a`]: position(blocksLeft) },
          dataBlockedNetworkIds: [networkId],
        }),
      );
    expect(held(0)).toBe('synced');
    expect(held(5000)).toBe('waitingWifi');
  });

  // Another account's Sync must not turn this one back to Preparing.
  it('shows Preparing only for the account the user started', () => {
    const scan = scanState({
      progress: {
        [`${networkId}:a`]: position(0),
        [`${networkId}:b`]: position(0),
      },
      preparingAccountKeys: [`${networkId}:b`],
    });
    expect(statusOf(scan)).toBe('synced');
  });

  it('prepares until a position is known', () => {
    expect(statusOf(scanState())).toBe('preparing');
    expect(statusOf(scanState(), enabled, { progress: position(0) })).toBe(
      'synced',
    );
  });

  it('prefers the published position to a read one', () => {
    expect(
      statusOf(
        scanState({ progress: { [`${networkId}:a`]: position(5000) } }),
        enabled,
        { progress: position(0) },
      ),
    ).toBe('syncing');
  });
});

describe('getLocalWalletNetworkSyncStatus', () => {
  const networkStatus = (scan: IPrivacyChainScanState, accountIds?: string[]) =>
    getLocalWalletNetworkSyncStatus({
      scan,
      networkId,
      accountIds,
      syncedBelowBlocks,
    });

  it('follows the account furthest behind', () => {
    const view = networkStatus(
      scanState({
        progress: {
          [`${networkId}:a`]: position(0),
          [`${networkId}:b`]: position(5000),
          'zec--0:c': position(9000),
        },
      }),
    );
    expect(view.status).toBe('syncing');
    expect(view.progress).toEqual(position(5000));
  });

  it('counts only the given accounts', () => {
    const scan = scanState({
      progress: {
        [`${networkId}:a`]: position(0),
        [`${networkId}:b`]: position(5000),
      },
      preparingAccountKeys: [`${networkId}:b`],
    });
    expect(networkStatus(scan, ['a']).status).toBe('synced');
    expect(networkStatus(scan, ['a', 'b']).status).toBe('preparing');
  });

  it('prepares until any account has a position', () => {
    expect(networkStatus(scanState()).status).toBe('preparing');
  });

  it('shows work advancing while another account waits for its first position', () => {
    const queued = {
      ...position(5000),
      backfillScannedHeight: null,
      isBackfillComplete: false,
    };
    const view = networkStatus(
      scanState({
        progress: {
          [`${networkId}:a`]: position(0),
          [`${networkId}:b`]: queued,
        },
      }),
    );
    expect(view.status).toBe('syncing');
    expect(view.progress).toEqual(position(0));
  });
});
