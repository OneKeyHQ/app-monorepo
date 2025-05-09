import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDBAppStatus {
  // hdWalletHashGenerated?: boolean;
  // hdWalletXfpGenerated?: boolean;

  allHdWalletsHashAndXfpGenerated?: boolean;
  allQrWalletsXfpGenerated?: boolean;

  launchTimes?: number;
  launchTimesLastReset?: number;
  hdWalletsBackupMigrated?: boolean;
  falconDepositDoNotShowAgain?: boolean;
  lastDBBackupTime?: number;
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
