import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// TradingView cross-origin chart-data migration (Part D, iOS + Desktop only).
//
// The offline chart bundle is served from a NEW origin (iOS onekey-chart://,
// desktop onekey-chart://local), so the legacy `tradingview_*` localStorage —
// written by the previous online chart on `tradingview.onekey.so` — is not
// visible cross-origin. This state machine drives a one-time export (from the
// old origin) + restore (into the new offline origin) per the Part D contract.
// (Android reuses the old origin via Part G, so it never enters this flow.)
export type ITradingViewChartMigrationState =
  // Old user, waiting for a network window to export from the old origin. We
  // stay here while offline (retried with backoff, never permanently skipped).
  | 'export-deferred'
  // Export ran but the old origin had no `tradingview_*` keys → nothing to
  // restore; equivalent to `done`.
  | 'export-empty'
  // Export succeeded with a non-empty blob; waiting for the offline chart to
  // load so we can inject it.
  | 'restore-pending'
  // Restore acked ok by the chart bundle → finished, never re-runs.
  | 'done'
  // Brand-new install (no old origin data) → permanently skipped.
  | 'skipped-first-install';

export type ITradingViewChartMigration = {
  state: ITradingViewChartMigrationState;
  // Last export attempt timestamp (drives the once-per-launch backoff).
  lastAttemptAt?: number;
  // Timestamp the export blob was captured.
  exportedAt?: number;
};

export interface ISimpleDBAppStatus {
  // hdWalletHashGenerated?: boolean;
  // hdWalletXfpGenerated?: boolean;

  allHdWalletsHashAndXfpGenerated?: boolean;
  allQrWalletsXfpGenerated?: boolean;
  allHdDuplicateWalletsMerged?: boolean;

  launchTimes?: number;
  // Launch count since last update reset; used by launch-threshold prompts (e.g. floating icon guide).
  launchTimesLastReset?: number;
  hdWalletsBackupMigrated?: boolean; // is mnemonic backuped by user
  falconDepositDoNotShowAgain?: boolean;
  lastDBBackupTime?: number;
  filterScamHistorySettingMigrated?: boolean;
  fixHardwareLtcXPubMigrated?: boolean;
  btcFreshAddressSettingMigrated?: boolean;
  removeDeviceHomeScreenMigrated?: boolean;
  // OneKey IDs (onekeyUserId) that have already seen the KYT intro dialog.
  // Scoped per Prime user so each account is prompted once.
  kytIntroShownUserIds?: string[];

  // TradingView cross-origin chart-data migration state (Part D). Present only
  // on iOS + Desktop; Android never seeds it (reuses origin via Part G).
  tradingViewChartMigration?: ITradingViewChartMigration;
  // The exported `tradingview_*` localStorage blob; only present while
  // `tradingViewChartMigration.state === 'restore-pending'` (cleared on `done`).
  tradingViewChartMigrationBlob?: Record<string, string>;
}

export class SimpleDbEntityAppStatus extends SimpleDbEntityBase<ISimpleDBAppStatus> {
  entityName = 'appStatus';

  override enableCache = true;

  @backgroundMethod()
  async clearLastDBBackupTimestamp() {
    await this.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        lastDBBackupTime: undefined,
      }),
    );
  }
}
