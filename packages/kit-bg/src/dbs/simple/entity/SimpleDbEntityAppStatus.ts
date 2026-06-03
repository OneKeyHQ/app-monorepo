import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

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
  walletAllNetworkLowBalanceReportedAtByWalletId?: Record<string, number>;
  // OneKey IDs (onekeyUserId) that have already seen the KYT intro dialog.
  // Scoped per Prime user so each account is prompted once.
  kytIntroShownUserIds?: string[];
}

export class SimpleDbEntityAppStatus extends SimpleDbEntityBase<ISimpleDBAppStatus> {
  entityName = 'appStatus';

  override enableCache = true;

  @backgroundMethod()
  async getWalletAllNetworkLowBalanceReportedAt({
    walletId,
  }: {
    walletId: string;
  }) {
    const appStatus = await this.getRawData();
    return appStatus?.walletAllNetworkLowBalanceReportedAtByWalletId?.[
      walletId
    ];
  }

  @backgroundMethod()
  async setWalletAllNetworkLowBalanceReportedAt({
    walletId,
    timestamp,
  }: {
    walletId: string;
    timestamp: number;
  }) {
    await this.setRawData(
      (v): ISimpleDBAppStatus => ({
        ...v,
        walletAllNetworkLowBalanceReportedAtByWalletId: {
          ...v?.walletAllNetworkLowBalanceReportedAtByWalletId,
          [walletId]: timestamp,
        },
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
