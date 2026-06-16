import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IWalletAssetStatus = 'low' | 'funded';

export type IWalletAssetStatusAnalyticsState = {
  assetStatus?: IWalletAssetStatus;
  lastStatusChangedAt?: number;
  lastSnapshotReportedAt?: number;
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
  walletAssetStatusAnalytics?: IWalletAssetStatusAnalyticsState;
  // OneKey IDs (onekeyUserId) that have already seen the KYT intro dialog.
  // Scoped per Prime user so each account is prompted once.
  kytIntroShownUserIds?: string[];
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
