import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IKytIntroClaimLease } from '@onekeyhq/shared/types/kyt';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IWalletAssetStatus = 'low' | 'funded';

export type IWalletAssetStatusAnalyticsState = {
  assetStatus?: IWalletAssetStatus;
  lastStatusChangedAt?: number;
  lastSnapshotReportedAt?: number;
};

export type IHardwareConnectProtocolCacheEntry = {
  protocol: 'V1' | 'V2';
  updatedAt: number;
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
  /** One-time flip of button-device PIN entry to the on-device default (OK-61489). */
  classicPinInputDefaultMigrated?: boolean;
  /** Version of the one-time connect protocol backfill for existing devices. */
  hardwareConnectProtocolMigrationVersion?: number;
  lastWalletProfileAnalyticsAt?: number;
  walletAssetStatusAnalytics?: IWalletAssetStatusAnalyticsState;
  /** Confirmed protocols keyed by normalized transport endpoint. */
  hardwareConnectProtocolByConnectId?: Record<
    string,
    IHardwareConnectProtocolCacheEntry
  >;
  // OneKey IDs (onekeyUserId) that have already seen the KYT intro dialog.
  // Scoped per Prime user so each account is prompted once.
  kytIntroShownUserIds?: string[];
  // Short-lived cross-runtime leases prevent multiple Extension UI surfaces
  // from showing the same KYT intro concurrently.
  kytIntroClaimLeases?: Record<string, IKytIntroClaimLease>;
}

export class SimpleDbEntityAppStatus extends SimpleDbEntityBase<ISimpleDBAppStatus> {
  entityName = 'appStatus';

  override enableCache = true;

  @backgroundMethod()
  async getWalletAssetStatusAnalytics() {
    const appStatus = await this.getRawData();
    return appStatus?.walletAssetStatusAnalytics;
  }

  @backgroundMethod()
  async setWalletAssetStatusAnalytics(
    status: IWalletAssetStatusAnalyticsState,
  ) {
    await this.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        walletAssetStatusAnalytics: status,
      }),
    );
  }

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
