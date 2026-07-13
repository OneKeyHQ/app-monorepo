import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class ShareScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterRookieShare(params: {
    isLoggedIn: boolean;
    referralCode: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public shareRookieLink(shareMethod: 'save' | 'share' | 'copy' | 'x') {
    return { shareMethod };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public closeRookieShare(params: {
    didAction: boolean;
    referralCode: string;
  }) {
    return params;
  }
}
