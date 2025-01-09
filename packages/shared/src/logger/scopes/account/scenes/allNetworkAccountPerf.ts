import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

export class AllNetworkAccountPerf extends BaseScene {
  @LogToConsole()
  public getAllNetworkAccountsStart() {
    this.resetTimestamp();
    return ['>>>>>>>>>>>>', true];
  }

  @LogToConsole()
  public getAllNetworkAccountsEnd() {
    return ['<<<<<<<<<<<<', true];
  }
}
