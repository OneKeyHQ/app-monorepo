import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDBAppStatus {
  hdWalletHashGenerated?: boolean;
  hdWalletXfpGenerated?: boolean;
  launchTimes?: number;
  launchTimesLastReset?: number;
  falconDepositDoNotShowAgain?: boolean;
}

export class SimpleDbEntityAppStatus extends SimpleDbEntityBase<ISimpleDBAppStatus> {
  entityName = 'appStatus';

  override enableCache = true;
}
