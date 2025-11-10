import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  IPerpDepositInitiateParams,
  IPerpUserSelectDepositTokenParams,
} from '../type';

export class PerpDepositScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpDepositInitiate(params: IPerpDepositInitiateParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpUserSelectDepositToken(params: IPerpUserSelectDepositTokenParams) {
    return params;
  }
}
