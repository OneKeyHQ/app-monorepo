// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { ISubscriptionPeriod } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentTypes';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class PrimeSubscriptionScene extends BaseScene {
  /**
   * Prime feature entry click
   * Triggered when a user clicks on any Prime feature entry point.
   */
  @LogToServer()
  public primeEntryClick({
    featureName,
    entryPoint,
    isPrimeActive,
  }: {
    featureName: EPrimeFeatures;
    entryPoint:
      | 'settingsPage'
      | 'moreActions'
      | 'approvalPopup'
      | 'primePage'
      | 'walletEdit'
      | 'browserTranslate';
    isPrimeActive: boolean;
  }) {
    return {
      featureName,
      entryPoint,
      isPrimeActive,
    };
  }

  /**
   * Prime upsell/paywall shown
   * Triggered when the feature introduction or subscription prompt page/dialog is displayed
   */
  @LogToServer()
  public primeUpsellShow({
    featureName,
    entryPoint,
  }: {
    featureName: EPrimeFeatures;
    entryPoint?: 'settingsPage' | 'moreActions' | 'approvalPopup' | 'primePage';
  }) {
    return {
      featureName,
      entryPoint,
    };
  }

  /**
   * Prime dashboard shown
   * Triggered once when PrimeDashboard mounts.
   */
  @LogToServer()
  public primeDashboardShow({
    featureName,
    isPrimeActive,
  }: {
    featureName?: EPrimeFeatures;
    isPrimeActive: boolean;
  }) {
    return {
      featureName,
      isPrimeActive,
    };
  }

  /**
   * Prime subscribe button click
   * Triggered when user taps the subscribe button on PrimeDashboard, before the
   * login / IAP flow runs. Pair with primeSubscribeIntent to isolate login drop-off.
   */
  @LogToServer()
  public primeSubscribeButtonClick({
    subscriptionPeriod,
    featureName,
    isLoggedIn,
  }: {
    subscriptionPeriod: ISubscriptionPeriod;
    featureName?: EPrimeFeatures;
    isLoggedIn: boolean;
  }) {
    return {
      subscriptionPeriod,
      featureName,
      isLoggedIn,
    };
  }

  /**
   * Prime subscribe intent
   * Triggered immediately before RevenueCat purchase is initiated. Pair with
   * primeSubscribeSuccess to measure the true payment-attempt → success rate.
   */
  @LogToServer()
  public primeSubscribeIntent({
    subscriptionPeriod,
    featureName,
    currency,
  }: {
    subscriptionPeriod: ISubscriptionPeriod;
    featureName?: EPrimeFeatures;
    currency?: string;
  }) {
    return {
      subscriptionPeriod,
      featureName,
      currency,
    };
  }

  /**
   * Prime upsell CTA button click
   * Triggered when user clicks the "Subscribe" or similar call-to-action button on the upsell/paywall page
   */
  @LogToServer()
  public primeUpsellActionClick({
    featureName,
    entryPoint,
  }: {
    featureName: EPrimeFeatures;
    entryPoint?: 'settingsPage' | 'moreActions' | 'approvalPopup' | 'primePage';
  }) {
    return {
      featureName,
      entryPoint,
    };
  }

  /**
   * Prime subscription success
   * Triggered when user completes payment and successfully subscribes to Prime
   * @param featureName - The feature that led to this subscription (for tracking which feature attracts users)
   */
  @LogToServer()
  public primeSubscribeSuccess({
    planType,
    amount,
    currency,
    featureName,
  }: {
    planType: 'monthly' | 'yearly';
    amount: number;
    currency: string;
    featureName?: EPrimeFeatures;
  }) {
    return {
      planType,
      amount,
      currency,
      featureName,
    };
  }

  @LogToLocal()
  @LogToServer()
  public fetchPackagesFailed({ errorMessage }: { errorMessage: string }) {
    return {
      errorMessage,
    };
  }

  // @LogToLocal()
  // public onekeyIdLogin({ reason }: { reason: string }) {
  //   return {
  //     reason,
  //   };
  // }

  @LogToLocal()
  @LogToServer()
  public onekeyIdLogout({ reason }: { reason: string }) {
    return {
      reason,
    };
  }

  @LogToLocal()
  @LogToServer()
  public onekeyIdAtomNotLoggedIn({ reason }: { reason: string }) {
    return {
      reason,
    };
  }

  @LogToLocal()
  @LogToServer()
  public onekeyIdInvalidToken({
    url,
    errorCode,
    errorMessage,
  }: {
    url: string;
    errorCode: number;
    errorMessage: string;
  }) {
    return {
      url,
      errorCode,
      errorMessage,
    };
  }
}
