import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IReferralLandingBindMethod = 'web_extension' | 'deep_link';

export type IReferralLandingButtonName =
  | 'download_app'
  | 'already_have_wallet'
  | 'bind_invite_code'
  | 'trade_now';

export type IClickReferralLandingButtonParams = {
  referralCode: string;
  landingPage: string;
  buttonName: IReferralLandingButtonName;
  bindMethod?: IReferralLandingBindMethod;
};

export type ICopyReferralCodeParams = {
  referralCode: string;
  landingPage: string;
};

export type IReferralPageOpenParams = {
  referralCode: string;
  landingPage: string;
  pageVariant: string;
};

export type IReferralBindSource =
  | 'onboarding_dialog'
  | 'home_block'
  | 'settings'
  | 'invite_home';

export type IReferralBindErrorType =
  | 'invalid_format'
  | 'bind_window_expired'
  | 'server_rejected'
  | 'client_error';

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
  public copyReferralCode(params?: ICopyReferralCodeParams) {
    return params ?? {};
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

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public referralPageOpen(params: IReferralPageOpenParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public enterFromReferralLink(params: {
    referralCode: string;
    landingPage: string;
    utmSource: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public clickAcceptInviteButton(params: {
    referralCode: string;
    acceptMethod:
      | 'local_app'
      | 'web_extension'
      | 'web_no_extension'
      | 'web_get_extension';
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public clickReferralLandingButton(params: IClickReferralLandingButtonParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public referralBindingCompleted(params: {
    referralCode: string;
    address: string;
    networkId: string;
    source?: IReferralBindSource;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public inviteHomeShown(params: { hasEarnings: boolean }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public inviteBindRowShown(params: { status: 'bind' | 'bound' | 'empty' }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public referralBindFailed(params: {
    source?: IReferralBindSource;
    errorType: IReferralBindErrorType;
    serverMessageId?: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public onboardingDialogShown(params: {
    walletId: string;
    walletType: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public onboardingDialogSkipped(params: {
    walletId: string;
    walletType: string;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public onboardingDialogSubmitted(params: {
    walletId: string;
    walletType: string;
    codeLength: number;
  }) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public onboardingDialogBindFailed(params: {
    walletId: string;
    walletType: string;
    errorReason: string;
  }) {
    return params;
  }
}
