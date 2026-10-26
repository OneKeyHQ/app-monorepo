import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { buildLocalWalletSyncStatusText } from './useLocalWalletPool';

import type { IntlShape } from 'react-intl';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

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

// Time reads better; the block count stands in only until a rate is measured.
describe('local wallet backfill remaining', () => {
  it('shows the time left once the scan rate is known', () => {
    const text = buildLocalWalletSyncStatusText({
      syncProgress: backfilling,
      settings: undefined,
      scanRatePerSec: 10,
      intl,
    });
    expect(text).toContain('~');
    expect(text).not.toContain(
      ETranslations.privacy_sync_blocks_remaining__msg,
    );
  });

  it('shows the blocks left while no rate has been measured', () => {
    const text = buildLocalWalletSyncStatusText({
      syncProgress: backfilling,
      settings: undefined,
      scanRatePerSec: null,
      intl,
    });
    expect(text).toContain(ETranslations.privacy_sync_blocks_remaining__msg);
    expect(text).not.toContain('~');
  });
});
