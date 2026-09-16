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
  public toggleReceivingAddressVisibility(isVisible: boolean) {
    return { isVisible };
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
    source?: 'onboarding_dialog' | 'home_block' | 'settings';
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
    /** True when the submitted code is the one we pre-filled untouched. */
    isAutoFilled?: boolean;
  }) {
    return params;
  }

  /**
   * Fires once per install when the store referrer is resolved. Carries no
   * referrer content — only whether a usable code was present — so campaign
   * strings never reach the analytics payload.
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public installReferralCaptured(params: { source: string; hasCode: boolean }) {
    return params;
  }

  /**
   * The stored invite code was presented to the user. `surface` separates the
   * onboarding dialog, which pre-fills the field outright, from the bind
   * dialog, which only shows it as a hint — their conversion rates are not
   * comparable without it.
   */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public installReferralOffered(params: {
    surface: 'onboarding_dialog' | 'bind_dialog';
    walletId?: string;
    walletType?: string;
  }) {
    return params;
  }

  /** The user bound the offered code rather than one of their own. */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public installReferralAccepted(params: {
    surface: 'onboarding_dialog' | 'bind_dialog';
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
