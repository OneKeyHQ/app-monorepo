import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

import {
  formatPrivacyChainSyncProgress,
  getPrivacyChainBackfillProgress,
  getPrivacyChainSyncLabel,
} from './privacyChainSyncDisplay';

it('does not label ordinary scanning as data-blocked', () => {
  expect(getPrivacyChainSyncLabel({ backfilling: true })).toBe(
    ETranslationsMock.privacy_scan_state_scanning,
  );
  expect(getPrivacyChainSyncLabel({ backfilling: false })).toBe(
    ETranslationsMock.privacy_sync_state_following,
  );
});

it('prioritizes disabled, paused, held, and preparing states consistently', () => {
  expect(
    getPrivacyChainSyncLabel({
      disabled: true,
      paused: true,
      held: true,
      preparing: true,
      backfilling: true,
    }),
  ).toBe(ETranslations.global_disabled);
  expect(
    getPrivacyChainSyncLabel({
      paused: true,
      held: true,
      preparing: true,
      backfilling: true,
    }),
  ).toBe(ETranslationsMock.privacy_scan_paused);
  expect(
    getPrivacyChainSyncLabel({
      held: true,
      preparing: true,
      backfilling: true,
    }),
  ).toBe(ETranslationsMock.privacy_scan_state_held);
  expect(getPrivacyChainSyncLabel({ preparing: true, backfilling: true })).toBe(
    ETranslations.global_preparing,
  );
});

it.each([
  [{ scanned: 0, target: 100, progress: 0 }, '0 / 100 · 0%'],
  [{ scanned: 100, target: 100, progress: 1 }, '100 / 100 · 100%'],
  [{ scanned: null, target: 100 }, ''],
  [{ scanned: 100, target: 200 }, '100 / 200'],
])('formats progress without stray separators', (input, expected) => {
  expect(formatPrivacyChainSyncProgress(input)).toBe(expected);
});

it('selects unknown progress before known progress and filters other networks', () => {
  const progress: ILocalWalletSyncProgress = {
    birthdayHeight: 0,
    backfillScannedHeight: 10,
    backfillTargetHeight: 100,
    backfillProgress: 0.1,
    isBackfillComplete: false,
    tipScannedHeight: null,
    chainTip: 100,
    tipLag: null,
    isTipCaughtUp: false,
    isSyncing: true,
  };
  const unknown = { ...progress, backfillScannedHeight: null };
  expect(
    getPrivacyChainBackfillProgress(
      { 'network:a': progress, 'other:a': unknown },
      'network',
    ),
  ).toBe(progress);
  expect(
    getPrivacyChainBackfillProgress(
      { 'network:a': progress, 'network:b': unknown },
      'network',
    ),
  ).toBe(unknown);
  expect(
    getPrivacyChainBackfillProgress(
      { 'network:a': { ...progress, isBackfillComplete: true } },
      'network',
    ),
  ).toBeUndefined();
});
