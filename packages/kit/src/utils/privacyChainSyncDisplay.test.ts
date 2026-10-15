import { createIntl } from 'react-intl';

import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  formatPrivacyChainRemainingBlocks,
  formatPrivacyChainSyncProgress,
  getPrivacyChainBackfillProgress,
  getPrivacyChainSyncLabel,
  pickSlowestPrivacyChainNetwork,
} from './privacyChainSyncDisplay';

it('does not label ordinary scanning as data-blocked', () => {
  expect(getPrivacyChainSyncLabel({ backfilling: true })).toBe(
    ETranslations.global_syncing,
  );
  expect(getPrivacyChainSyncLabel({ backfilling: false })).toBe(
    ETranslations.global_synced,
  );
});

// Nothing else can change until the WebView is updated.
it('puts an unsupported device above every other state', () => {
  expect(
    getPrivacyChainSyncLabel({
      storageUnsupported: true,
      disabled: true,
      paused: true,
      held: true,
      backfilling: true,
    }),
  ).toBe(ETranslations.privacy_error_webview_outdated__msg);
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
  ).toBe(ETranslations.syncing_paused__title);
  expect(
    getPrivacyChainSyncLabel({
      held: true,
      preparing: true,
      backfilling: true,
    }),
  ).toBe(ETranslations.privacy_sync_waiting_wifi__msg);
  expect(getPrivacyChainSyncLabel({ preparing: true, backfilling: true })).toBe(
    ETranslations.global_preparing,
  );
});

it.each([
  [{ scanned: 0, target: 100, progress: 0 }, '0 / 100 · 0.0%'],
  [{ scanned: 100, target: 100, progress: 1 }, '100 / 100 · 100%'],
  [{ scanned: 6, target: 1000, progress: 0.006 }, '6 / 1,000 · 0.6%'],
  [{ scanned: 999, target: 1000, progress: 0.9999 }, '999 / 1,000 · 99.9%'],
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

// One light for every chain catching up: it speaks for the one furthest from
// done, by fraction, since block counts differ per chain.
describe('pickSlowestPrivacyChainNetwork', () => {
  const entry = (backfillProgress: number | null) =>
    ({
      backfillProgress,
      backfillScannedHeight: 1,
      backfillTargetHeight: 2,
      isBackfillComplete: false,
    }) as never;

  it('picks the chain with the least done', () => {
    expect(
      pickSlowestPrivacyChainNetwork(['zec--0', 'xmr--0'], {
        'zec--0:a': entry(0.8),
        'xmr--0:b': entry(0.2),
      }),
    ).toBe('xmr--0');
  });

  it('treats a chain with no figure yet as not started', () => {
    expect(
      pickSlowestPrivacyChainNetwork(['zec--0', 'xmr--0'], {
        'zec--0:a': entry(0.1),
      }),
    ).toBe('xmr--0');
  });

  it('has nothing to show for no chains', () => {
    expect(pickSlowestPrivacyChainNetwork([], {})).toBeUndefined();
  });
});

it('shows priority scan work advancing while the contiguous cursor stays still', () => {
  const messages: Record<string, string> = {
    [ETranslations.privacy_sync_blocks_remaining__msg]:
      '{count, number} blocks remaining',
  };
  const intl = createIntl({
    locale: 'en',
    messages,
    onError: () => undefined,
  });
  const progress = {
    birthdayHeight: 0,
    backfillScannedHeight: 10,
    backfillTargetHeight: 100,
    backfillProgress: 0.1,
    isBackfillComplete: false,
    tipScannedHeight: 100,
    chainTip: 100,
    tipLag: 0,
    isTipCaughtUp: true,
    isSyncing: true,
    backfillRemainingBlocks: 60,
  };
  expect(formatPrivacyChainRemainingBlocks(progress, intl)).toBe(
    '60 blocks remaining',
  );
  expect(
    formatPrivacyChainRemainingBlocks(
      { ...progress, backfillRemainingBlocks: 20 },
      intl,
    ),
  ).toBe('20 blocks remaining');
  expect(
    formatPrivacyChainRemainingBlocks(
      { ...progress, isBackfillComplete: true },
      intl,
    ),
  ).toBe('');
});
