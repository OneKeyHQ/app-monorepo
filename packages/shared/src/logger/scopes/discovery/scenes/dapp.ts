import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../decorators';

export class DappScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterDapp(params: {
    dappUrl: string;
    dappTitle?: string;
    isFavorite: boolean;
  }) {
    return params;
  }
}
