import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { formatPrivacyChainSyncDetail } from './privacyChainSyncDisplay';

import type { IntlShape } from 'react-intl';

const intl = {
  formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
    values ? `${id}:${JSON.stringify(values)}` : id,
} as unknown as IntlShape;

const backfilling: ILocalWalletSyncProgress = {
  birthdayHeight: 1000,
  backfillScannedHeight: 2000,
  backfillTargetHeight: 2600,
  backfillProgress: 0.625,
  backfillRemainingBlocks: 600,
  isBackfillComplete: false,
  tipScannedHeight: 2000,
  chainTip: 2600,
  tipLag: 600,
  isTipCaughtUp: false,
  isSyncing: true,
};

describe('local wallet backfill remaining', () => {
  it('shows the time left once the scan rate is known', () => {
    const text = formatPrivacyChainSyncDetail({
      progress: { ...backfilling, blocksPerSec: 10 },
      settings: undefined,
      intl,
    });
    expect(text).toContain('~');
    expect(text).not.toContain(
      ETranslations.privacy_sync_blocks_remaining__msg,
    );
  });

  it('shows the blocks left while no rate has been measured', () => {
    const text = formatPrivacyChainSyncDetail({
      progress: backfilling,
      settings: undefined,
      intl,
    });
    expect(text).toContain(ETranslations.privacy_sync_blocks_remaining__msg);
    expect(text).not.toContain('~');
  });

  it('shows the blocks left while the scan is stopped', () => {
    const text = formatPrivacyChainSyncDetail({
      progress: { ...backfilling, blocksPerSec: 10 },
      settings: undefined,
      stopped: true,
      intl,
    });
    expect(text).toContain(ETranslations.privacy_sync_blocks_remaining__msg);
  });
});
