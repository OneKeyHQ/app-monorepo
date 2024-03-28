import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class RequestScene extends BaseScene {
  @LogToLocal({ level: 'error' })
  public logRequestUnknownError(errMsg: string) {
    return errMsg;
  }
}
