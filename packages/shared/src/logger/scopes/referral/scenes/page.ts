import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterReferralGuide(
    referralCode: string | undefined | null,
    utmSource: string | undefined | null,
  ) {
    return {
      referralCode: referralCode ?? '',
      utmSource: utmSource ?? '',
    };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterReferralGuideFromDeepLink(
    referralCode: string | undefined | null,
    utmSource: string | undefined | null,
  ) {
    return {
      referralCode: referralCode ?? '',
      utmSource: utmSource ?? '',
    };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public signupOneKeyID() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public signupOneKeyIDResult(isSuccess: boolean) {
    return { isSuccess };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public logoutOneKeyIDResult() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public createReferralCode() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public copyReferralCode() {
    return {};
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterReferralDashboard(referralCode: string | undefined | null) {
    return { referralCode };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public shareReferralLink(shareMethod: 'copy' | 'share') {
    return { shareMethod };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public editReceivingAddress(params: {
    networkId: string;
    editMethod: 'new' | 'edit';
  }) {
    return params;
  }
}
