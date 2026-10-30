import { createIntl } from 'react-intl';

import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  PRIVACY_CHAIN_SYNC_STATUS_LABELS,
  formatPrivacyChainSyncError,
  formatPrivacyChainSyncProgress,
  formatPrivacyChainSyncSummary,
  formatPrivacyChainTimeLeft,
  getPrivacyChainBackfillProgress,
  getPrivacyChainNetworkSyncDisplay,
  isPrivacyChainTimeLeftReliable,
  pickPrivacyChainSummaryFigure,
  pickSlowestPrivacyChainNetwork,
} from './privacyChainSyncDisplay';

it('labels both pauses alike, and an outdated WebView as a sync error', () => {
  expect(PRIVACY_CHAIN_SYNC_STATUS_LABELS.accountPaused).toBe(
    ETranslations.syncing_paused__title,
  );
  expect(PRIVACY_CHAIN_SYNC_STATUS_LABELS.chainPaused).toBe(
    ETranslations.syncing_paused__title,
  );
  expect(PRIVACY_CHAIN_SYNC_STATUS_LABELS.storageUnsupported).toBe(
    ETranslations.global_sync_error,
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

describe('chain status shared by settings and the floating control', () => {
  const scanning: ILocalWalletSyncProgress = {
    birthdayHeight: 1,
    backfillScannedHeight: 191,
    backfillTargetHeight: 1000,
    backfillProgress: 0.191,
    isBackfillComplete: false,
    tipScannedHeight: 191,
    chainTip: 1000,
    tipLag: 809,
    isTipCaughtUp: false,
    isSyncing: true,
  };
  const queued = {
    ...scanning,
    backfillScannedHeight: null,
    backfillProgress: 0,
  };
  const complete = {
    ...scanning,
    backfillScannedHeight: 1000,
    backfillProgress: 1,
    isBackfillComplete: true,
    tipScannedHeight: 1000,
    tipLag: 0,
    isTipCaughtUp: true,
  };
  let state: IPrivacyChainScanState;
  const display = () =>
    getPrivacyChainNetworkSyncDisplay({
      state,
      networkId: 'xmr--0',
      syncedBelowBlocks: 100,
    });
  beforeEach(() => {
    state = {
      boostingNetworkIds: ['xmr--0'],
      pausedNetworkIds: [],
      preparingAccountKeys: [],
      dataBlockedNetworkIds: [],
      storageUnsupportedNetworkIds: [],
      syncErrorByNetworkId: {},
      progress: {},
    };
  });

  it('prepares after an explicit start, hiding that account figures', () => {
    state.progress = { 'xmr--0:active': scanning };
    state.preparingAccountKeys = ['xmr--0:active'];
    expect(display()).toMatchObject({
      status: 'preparing',
      labelId: ETranslations.global_preparing,
    });
    expect(display().progress).toBeUndefined();
  });

  it('calls a chain synced only once every account is', () => {
    state.progress = { 'xmr--0:done': complete };
    expect(display().status).toBe('synced');
    state.progress = { 'xmr--0:done': complete, 'xmr--0:queued': queued };
    expect(display().status).toBe('syncing');
  });

  it('shows advancing work while another account is still waiting for its cursor', () => {
    state.progress = { 'xmr--0:active': scanning, 'xmr--0:queued': queued };
    expect(display()).toMatchObject({
      labelId: ETranslations.global_syncing,
      progress: scanning,
    });
  });

  it('prepares only while no account on this chain has a scanned cursor', () => {
    state.progress = { 'xmr--0:queued': queued, 'zec--0:other': scanning };
    expect(display().labelId).toBe(ETranslations.global_preparing);
    expect(display().progress).toBeUndefined();
  });

  it('puts pause and the data wait ahead of an old error', () => {
    state.boostingNetworkIds = [];
    state.pausedNetworkIds = ['xmr--0'];
    state.dataBlockedNetworkIds = ['xmr--0'];
    state.syncErrorByNetworkId['xmr--0'] = 'failed';
    expect(display().labelId).toBe(ETranslations.syncing_paused__title);
    expect(display().syncError).toBeUndefined();
    state.pausedNetworkIds = [];
    expect(display().labelId).toBe(
      ETranslations.privacy_sync_waiting_wifi__msg,
    );
    expect(display().syncError).toBeUndefined();
    state.dataBlockedNetworkIds = [];
    expect(display()).toMatchObject({
      labelId: ETranslations.global_sync_error,
      syncError: 'failed',
    });
  });

  it('limits a wallet view to its own accounts and reports them all paused', () => {
    state.progress = { 'xmr--0:mine': complete, 'xmr--0:other': scanning };
    expect(
      getPrivacyChainNetworkSyncDisplay({
        state,
        networkId: 'xmr--0',
        syncedBelowBlocks: 100,
        accountIds: ['mine'],
      }).status,
    ).toBe('synced');
    expect(
      getPrivacyChainNetworkSyncDisplay({
        state,
        networkId: 'xmr--0',
        syncedBelowBlocks: 100,
        accountPaused: true,
      }).status,
    ).toBe('accountPaused');
  });
});

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
  const timeLeft = (
    overrides: Partial<ILocalWalletSyncProgress>,
    stopped = false,
  ) =>
    formatPrivacyChainTimeLeft({
      progress: { ...progress, ...overrides },
      stopped,
    });
  // No speed yet: nothing, not a block count.
  expect(timeLeft({})).toBe('');
  expect(timeLeft({ isBackfillComplete: true, blocksPerSec: 2 })).toBe('');
  // The published speed turns blocks left into time, unless the scan is stopped.
  expect(timeLeft({ blocksPerSec: 2 })).toMatch(/^~/);
  // Monero reports no count: target minus scanned is projected the same way.
  expect(
    timeLeft({ backfillRemainingBlocks: undefined, blocksPerSec: 2 }),
  ).toMatch(/^~/);
  expect(timeLeft({ blocksPerSec: 2 }, true)).toBe('');
});

it('shows the one figure picked, falling back to the state alone', () => {
  const syncing: ILocalWalletSyncProgress = {
    birthdayHeight: 0,
    backfillScannedHeight: 10,
    backfillTargetHeight: 100,
    backfillProgress: 0.1,
    backfillRemainingBlocks: 90,
    isBackfillComplete: false,
    tipScannedHeight: 10,
    chainTip: 100,
    tipLag: 90,
    isTipCaughtUp: false,
    isSyncing: true,
  };
  const summary = (
    progress: ILocalWalletSyncProgress | undefined,
    figure: 'timeLeft' | 'percent' | undefined,
  ) => formatPrivacyChainSyncSummary({ label: 'Syncing', progress, figure });
  expect(summary({ ...syncing, blocksPerSec: 3 }, 'timeLeft')).toMatch(
    /^Syncing · ~/,
  );
  expect(summary({ ...syncing, blocksPerSec: 3 }, 'percent')).toBe(
    'Syncing · 10.0%',
  );
  expect(summary({ ...syncing, backfillProgress: null }, 'percent')).toBe(
    'Syncing',
  );
  expect(summary(undefined, 'percent')).toBe('Syncing');
  expect(summary(syncing, undefined)).toBe('Syncing');
});

describe('time left reliability', () => {
  const measured: ILocalWalletSyncProgress = {
    birthdayHeight: 0,
    backfillScannedHeight: 10,
    backfillTargetHeight: 100,
    backfillProgress: 0.1,
    backfillRemainingBlocks: 90,
    isBackfillComplete: false,
    tipScannedHeight: 10,
    chainTip: 100,
    tipLag: 90,
    isTipCaughtUp: false,
    isSyncing: true,
    blocksPerSec: 3,
    blocksPerSecSince: 0,
  };
  type ISettings = Parameters<
    typeof isPrivacyChainTimeLeftReliable
  >[0]['settings'];
  const slowRegion = (fromHeight: number, toHeight: number) =>
    ({
      scanRegionHints: [
        {
          fromHeight,
          toHeight,
          labelId: ETranslations.privacy_sync_spam_region__msg,
        },
      ],
    }) as ISettings;
  const reliable = (
    progress: ILocalWalletSyncProgress,
    settings?: ISettings,
    now = 60_000,
  ) => isPrivacyChainTimeLeftReliable({ progress, settings, now });

  it('waits until the speed has been measured for a minute', () => {
    expect(reliable(measured, undefined, 59_999)).toBe(false);
    expect(reliable(measured)).toBe(true);
    expect(reliable({ ...measured, blocksPerSecSince: undefined })).toBe(false);
  });

  // The speed before a slower region says nothing about crossing it.
  it('distrusts a declared slow region that is not scanned yet', () => {
    expect(reliable(measured, slowRegion(50, 80))).toBe(false);
    expect(
      reliable({ ...measured, backfillScannedHeight: 80 }, slowRegion(50, 80)),
    ).toBe(true);
    expect(reliable(measured, slowRegion(200, 300))).toBe(true);
  });

  it('shows the percentage until a time left can be trusted', () => {
    const pick = (progress: ILocalWalletSyncProgress, now: number) =>
      pickPrivacyChainSummaryFigure({ progress, settings: undefined, now });
    expect(pick(measured, 60_000)).toBe('timeLeft');
    expect(pick(measured, 1000)).toBe('percent');
    expect(pick({ ...measured, blocksPerSec: undefined }, 60_000)).toBe(
      'percent',
    );
  });
});

describe('formatPrivacyChainSyncError', () => {
  const intl = createIntl({ locale: 'en' });

  it('says nothing when the last sync did not fail', () => {
    expect(formatPrivacyChainSyncError(undefined, intl)).toBeUndefined();
  });

  it('uses the node copy for an unreachable node', () => {
    expect(formatPrivacyChainSyncError('nodeUnreachable', intl)).toBe(
      ETranslations.privacy_error_node_unreachable__msg,
    );
  });

  it('asks for a restart when the runtime is gone', () => {
    expect(formatPrivacyChainSyncError('runtimeUnavailable', intl)).toBe(
      ETranslations.privacy_error_runtime_unavailable__msg,
    );
    expect(formatPrivacyChainSyncError('failed', intl)).toBe(
      ETranslations.privacy_sync_failed_retrying__msg,
    );
  });
});
