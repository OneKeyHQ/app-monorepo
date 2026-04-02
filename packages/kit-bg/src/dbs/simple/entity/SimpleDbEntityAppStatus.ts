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
