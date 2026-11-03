import {
  getLocalWalletBlockSeconds,
  getLocalWalletTimeWindowBlocks,
} from './blockTime';
import { getLocalWalletAccountSyncStatus } from './syncStatus';

import type { ILocalWalletSyncProgress } from './types';
import type { IPrivacyChainScanState } from '../../states/jotai/atoms/privacyChain';

// Zcash NU7: 75s blocks become 25s from this height.
const NU7 = 3_543_405;
const zcash = {
  blockTimeSeconds: 75,
  blockTimeChange: { fromHeight: NU7, blockTimeSeconds: 25 },
};

describe('block time across a block time change', () => {
  it('reads the interval of the height', () => {
    expect(getLocalWalletBlockSeconds(zcash, NU7 - 1)).toBe(75);
    expect(getLocalWalletBlockSeconds(zcash, NU7)).toBe(25);
    expect(getLocalWalletBlockSeconds(zcash, null)).toBe(75);
    expect(getLocalWalletBlockSeconds({ blockTimeSeconds: 120 }, NU7)).toBe(
      120,
    );
  });

  // ZIP 218: a block count that stands for time triples, so it keeps its time.
  it('keeps the time a block count stands for', () => {
    expect(getLocalWalletTimeWindowBlocks(zcash, 48, NU7 - 1)).toBe(48);
    expect(getLocalWalletTimeWindowBlocks(zcash, 48, NU7)).toBe(144);
    expect(getLocalWalletTimeWindowBlocks(zcash, 10, NU7 + 5)).toBe(30);
    expect(getLocalWalletTimeWindowBlocks(undefined, 48, NU7)).toBe(48);
  });

  it('counts the synced window in time', () => {
    const scan = (chainTip: number): IPrivacyChainScanState => {
      const progress: ILocalWalletSyncProgress = {
        birthdayHeight: chainTip - 1000,
        backfillScannedHeight: chainTip - 100,
        backfillTargetHeight: chainTip,
        backfillProgress: 0.9,
        isBackfillComplete: false,
        tipScannedHeight: chainTip,
        chainTip,
        tipLag: 0,
        isTipCaughtUp: false,
        isSyncing: true,
      };
      return {
        progress: { 'zec--0:a': progress },
        boostingNetworkIds: [],
        dataBlockedNetworkIds: [],
        pausedNetworkIds: [],
        preparingAccountKeys: [],
        storageUnsupportedNetworkIds: [],
        syncErrorByNetworkId: {},
      };
    };
    const statusAt = (chainTip: number) =>
      getLocalWalletAccountSyncStatus({
        scan: scan(chainTip),
        networkId: 'zec--0',
        accountId: 'a',
        account: { enabled: true, paused: false },
        syncedBelowBlocks: 48,
        blockTime: zcash,
      }).status;
    // 100 blocks: over an hour at 75s, about 42 minutes at 25s.
    expect(statusAt(NU7 - 200)).toBe('syncing');
    expect(statusAt(NU7 + 200)).toBe('synced');
  });
});
