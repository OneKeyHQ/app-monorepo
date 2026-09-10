import {
  filterPrivacyModeEnabledAccounts,
  getPrivacyModeResumeFromHeight,
  isPrivacySyncSchedulingAllowed,
} from './PrivacyModeState';

import type { ILocalWalletSyncProgress } from '../vaults/localWallet/types';

function buildProgress(
  overrides: Partial<ILocalWalletSyncProgress>,
): ILocalWalletSyncProgress {
  return {
    birthdayHeight: 1000,
    backfillScannedHeight: 2000,
    backfillTargetHeight: 2000,
    backfillProgress: 1,
    isBackfillComplete: true,
    tipScannedHeight: 3000,
    chainTip: 3000,
    tipLag: 0,
    isTipCaughtUp: true,
    isSyncing: false,
    ...overrides,
  };
}

describe('getPrivacyModeResumeFromHeight', () => {
  it('resumes an incomplete backfill from its original birthday', () => {
    expect(
      getPrivacyModeResumeFromHeight({
        birthdayHeight: 1000,
        progress: buildProgress({ isBackfillComplete: false }),
      }),
    ).toBe(1000);
  });

  it('keeps a reorg margin behind the last scanned tip', () => {
    expect(
      getPrivacyModeResumeFromHeight({
        birthdayHeight: 1000,
        progress: buildProgress({ tipScannedHeight: 3000 }),
      }),
    ).toBe(2900);
  });

  it('never resumes before the account birthday', () => {
    expect(
      getPrivacyModeResumeFromHeight({
        birthdayHeight: 2950,
        progress: buildProgress({ tipScannedHeight: 3000 }),
      }),
    ).toBe(2950);
  });
});

describe('privacy mode scheduling gates', () => {
  it('selects only explicitly enabled accounts', () => {
    expect(
      filterPrivacyModeEnabledAccounts({
        accounts: [{ accountId: 'off' }, { accountId: 'on' }],
        enabledAccountIds: new Set(['on']),
      }),
    ).toEqual([{ accountId: 'on' }]);
  });

  it('blocks both cellular and unknown native network state by default', () => {
    expect(
      isPrivacySyncSchedulingAllowed({
        deviceIsCellular: true,
        allowPrivacySyncOnCellular: false,
      }),
    ).toBe(false);
    expect(
      isPrivacySyncSchedulingAllowed({
        deviceIsCellular: undefined,
        allowPrivacySyncOnCellular: false,
      }),
    ).toBe(false);
    expect(
      isPrivacySyncSchedulingAllowed({
        deviceIsCellular: false,
        allowPrivacySyncOnCellular: false,
      }),
    ).toBe(true);
  });
});
