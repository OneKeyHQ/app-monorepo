import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PageScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterReferralGuide(referralCode: string | undefined | null) {
    return {
      referralCode: referralCode ?? '',
    };
  }

  public signupOneKeyID() {
    return {};
  }

  public signupOneKeyIDResult(isSuccess: boolean) {
    return { isSuccess };
  }

  public logoutOneKeyIDResult() {
    return {};
  }

  public createReferralCode() {
    return {};
  }

  public copyReferralCode() {
    return {};
  }

  public enterReferralDashboard(referralCode: string | undefined | null) {
    return { referralCode };
  }

  public shareReferralLink(shareMethod: 'copy' | 'share') {
    return { shareMethod };
  }

  public editReceivingAddress(params: {
    networkId: string;
    editMethod: 'new' | 'edit';
  }) {
    return params;
  }
}
