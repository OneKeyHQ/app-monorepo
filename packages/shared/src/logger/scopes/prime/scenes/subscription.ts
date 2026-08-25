/* cspell:ignore Infini */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { ISubscriptionPeriod } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimePaymentTypes';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import {
  getOneKeyIdAuthFailureServerParams,
  scrubSensitiveErrorMessageText,
} from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';
import type { IOneKeyIdAuthFailureLogSource } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

// Payment channel dimension: 'iap' = native in-app purchase (RevenueCat),
// 'stripe' = RevenueCat web billing (Stripe), 'crypto' = Infini crypto checkout
export type IPrimePaymentMethod = 'iap' | 'stripe' | 'crypto';

// Interactive login method dimension for the OneKey ID login funnel.
export type IOneKeyIdLoginMethod = 'email' | 'google' | 'apple' | 'oauth';

// Failure classification for a purchase attempt that never became a
// subscription. RevenueCat server events only cover post-purchase lifecycle,
// so the attempt-level outcome is client-only signal.
export type IPrimeSubscribeFailedReason = 'userCancelled' | 'paymentFailed';

export type IPrimeManageSubscriptionTarget =
  | 'infiniPage'
  | 'externalUrl'
  | 'unresolved';

// Strip query string and hash before a request URL reaches the analytics
// server: they may carry tokens or other request-scoped material.
function sanitizeUrlForServerLog(url: string): string {
  return (url || '').split(/[?#]/)[0];
}

export type IPrimeCryptoPaymentStage =
  | 'paymentMethod'
  | 'walletPaymentPage'
  | 'paymentContext'
  | 'paymentSession'
  | 'paymentCreation'
  | 'paymentReplacement'
  | 'assetSelection'
  | 'accountSelection'
  | 'paymentPreflight'
  | 'sendConfirmation'
  | 'broadcast'
  | 'paymentPolling'
  | 'externalCheckout'
  | 'purchaseCompletion';

export type IPrimeCryptoPaymentStatus =
  | 'started'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'blocked'
  | 'pending'
  | 'expired'
  | 'selected'
  | 'restored'
  | 'refreshed'
  | 'recovered';

export type IPrimeCryptoPaymentFlowParams = {
  stage: IPrimeCryptoPaymentStage;
  status: IPrimeCryptoPaymentStatus;
  subscriptionPeriod?: ISubscriptionPeriod;
  featureName?: EPrimeFeatures;
  plan?: 'monthly' | 'yearly';
  checkoutType?: 'internalWallet' | 'externalWallet';
  paymentId?: string;
  networkId?: string;
  tokenSymbol?: string;
  amountDue?: string;
  reason?: string;
  sendStarted?: boolean;
  isRetry?: boolean;
  durationMs?: number;
  retryCount?: number;
  errorName?: string;
  errorCode?: string;
  requestId?: string;
  httpStatusCode?: number;
};

export type IOneKeyIdRemoteLogoutFlowParams = {
  stage:
    | 'initiatorRequest'
    | 'initiatorRefresh'
    | 'targetMessage'
    | 'targetStaging'
    | 'targetAcknowledgement'
    | 'targetReconciliation'
    | 'targetPresentation'
    | 'targetRetry';
  status:
    | 'started'
    | 'succeeded'
    | 'failed'
    | 'blocked'
    | 'skipped'
    | 'deduplicated';
  flowId: string;
  operationId?: string;
  requestId?: string;
  reason?: string;
  oneKeyIdLoggedOut?: boolean;
};

export type IOneKeyIdAuthStateMigrationParams = {
  stage:
    | 'candidateDetected'
    | 'walletSessionValidation'
    | 'profileValidation'
    | 'stateCommit';
  status: 'started' | 'succeeded' | 'failed' | 'blocked';
  operationId: string;
  reason?: string;
};

export type IOneKeyIdAuthStateRepairParams = {
  stage: 'candidateDetected' | 'stateCommit';
  status: 'started' | 'succeeded' | 'failed' | 'stateChanged';
  repairType:
    | 'legacyLoggedOutWithoutTombstone'
    | 'invalidLoggedInProjection'
    | 'incompleteLogoutProjection';
};

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
      | 'browserTranslate'
      | 'historySettings';
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
    isPrimeActive,
  }: {
    featureName: EPrimeFeatures;
    entryPoint?: 'settingsPage' | 'moreActions' | 'approvalPopup' | 'primePage';
    isPrimeActive?: boolean;
  }) {
    return {
      featureName,
      entryPoint,
      isPrimeActive,
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

  /** Track when a logged-in user opens the Prime redemption dialog. */
  @LogToServer()
  public primeRedemptionEntryClick({
    isPrimeActiveBeforeRedeem,
  }: {
    isPrimeActiveBeforeRedeem: boolean;
  }) {
    return { isPrimeActiveBeforeRedeem };
  }

  /** Track the user-visible result without sending the redemption code. */
  @LogToServer()
  public primeRedemptionResult({
    result,
    isPrimeActiveBeforeRedeem,
    addedDays,
    errorCode,
  }: {
    result: 'success' | 'failed';
    isPrimeActiveBeforeRedeem: boolean;
    addedDays?: number;
    errorCode?: number;
  }) {
    return {
      result,
      isPrimeActiveBeforeRedeem,
      addedDays,
      errorCode,
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
    paymentMethod,
  }: {
    subscriptionPeriod: ISubscriptionPeriod;
    featureName?: EPrimeFeatures;
    isLoggedIn: boolean;
    paymentMethod?: IPrimePaymentMethod;
  }) {
    return {
      subscriptionPeriod,
      featureName,
      isLoggedIn,
      paymentMethod,
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
    paymentMethod,
  }: {
    subscriptionPeriod: ISubscriptionPeriod;
    featureName?: EPrimeFeatures;
    currency?: string;
    paymentMethod?: IPrimePaymentMethod;
  }) {
    return {
      subscriptionPeriod,
      featureName,
      currency,
      paymentMethod,
    };
  }

  @LogToLocal({ level: 'info' })
  @LogToServer()
  public primeCryptoPaymentFlow(params: IPrimeCryptoPaymentFlowParams) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public primeCryptoPaymentError(
    params: IPrimeCryptoPaymentFlowParams & { errorMessage: string },
  ) {
    return params;
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
   * Prime feature CTA button click
   * Triggered when an active Prime user clicks a feature action CTA on the feature intro page/dialog.
   */
  @LogToServer()
  public primeFeatureCtaClick({
    featureName,
    entryPoint,
    isPrimeActive,
  }: {
    featureName: EPrimeFeatures;
    entryPoint: 'primePage';
    isPrimeActive: boolean;
  }) {
    return {
      featureName,
      entryPoint,
      isPrimeActive,
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
    paymentMethod,
  }: {
    planType: 'monthly' | 'yearly';
    amount: number;
    currency: string;
    featureName?: EPrimeFeatures;
    paymentMethod?: IPrimePaymentMethod;
  }) {
    return {
      planType,
      amount,
      currency,
      featureName,
      paymentMethod,
    };
  }

  /**
   * Prime subscription attempt failed or was cancelled (IAP / Stripe).
   * Pairs with primeSubscribeIntent to measure attempt → success drop-off per
   * channel; crypto attempts are covered by primeCryptoPaymentFlow instead.
   * The server receives only structured fields; the free-text error message
   * stays in local logs (scrubbed).
   */
  @LogToServer()
  public primeSubscribeFailed({
    paymentMethod,
    subscriptionPeriod,
    featureName,
    reason,
    errorCode,
    errorMessage,
  }: {
    paymentMethod: IPrimePaymentMethod;
    subscriptionPeriod?: ISubscriptionPeriod;
    featureName?: EPrimeFeatures;
    reason: IPrimeSubscribeFailedReason;
    errorCode?: string;
    errorMessage?: string;
  }) {
    this.primeSubscribeFailedLocal({
      paymentMethod,
      reason,
      errorCode,
      errorMessage: errorMessage ?? '',
    });
    return {
      paymentMethod,
      subscriptionPeriod,
      featureName,
      reason,
      errorCode,
    };
  }

  // Keeps the scrubbed purchase-failure diagnostics on the device only.
  @LogToLocal({ level: 'error' })
  public primeSubscribeFailedLocal({
    paymentMethod,
    reason,
    errorCode,
    errorMessage,
  }: {
    paymentMethod: IPrimePaymentMethod;
    reason: IPrimeSubscribeFailedReason;
    errorCode?: string;
    errorMessage: string;
  }) {
    return {
      paymentMethod,
      reason,
      errorCode,
      errorMessage: scrubSensitiveErrorMessageText(errorMessage),
    };
  }

  /**
   * Restore purchases result (native IAP only).
   * Key path for device-switch users.
   */
  @LogToServer()
  @LogToLocal()
  public primeRestorePurchaseResult({
    result,
  }: {
    result: 'success' | 'noPurchases' | 'failed';
  }) {
    return { result };
  }

  /**
   * Prime "Manage subscription" entry click.
   * Cancellation intent signal; the actual cancellation is reported
   * server-side by the RevenueCat integration (primeSubscriptionCancelled).
   * Only the resolved destination type is sent, never the URL itself.
   */
  @LogToServer()
  public primeManageSubscriptionClick({
    target,
  }: {
    target: IPrimeManageSubscriptionTarget;
  }) {
    return { target };
  }

  @LogToLocal()
  @LogToServer()
  public fetchPackagesFailed({ errorMessage }: { errorMessage: string }) {
    return {
      // Store SDK errors are free text; scrub before they leave the device.
      errorMessage: scrubSensitiveErrorMessageText(errorMessage),
    };
  }

  /**
   * Interactive OneKey ID login succeeded.
   * Fired once per completed interactive login (email OTP or OAuth), pairing
   * with onekeyIdLoginFailedReason to complete the login funnel. Never carries
   * the email address or any token material.
   */
  @LogToLocal()
  @LogToServer()
  public onekeyIdLoginSuccess({ method }: { method: IOneKeyIdLoginMethod }) {
    return { method };
  }

  /**
   * Identity link between the device-scoped analytics id and the OneKey ID.
   *
   * Server contract (analytics proxy): translate this event into a PostHog
   * `$identify` capture with distinct_id = onekeyUserId and
   * $anon_distinct_id = the event's own distinct_id (app instanceId), so the
   * device person merges with the person used by server-side subscription
   * events (RevenueCat app_user_id = onekeyUserId).
   *
   * Deduplicated by the caller (per user, per bg session, plus persisted TTL)
   * to keep event volume bounded.
   */
  @LogToLocal()
  @LogToServer()
  public onekeyIdIdentityLinked({ onekeyUserId }: { onekeyUserId: string }) {
    return { onekeyUserId };
  }

  /**
   * Local-only trace for auth/prime state maintenance (atom clears, discarded
   * responses, cleanup failures). These fire on hot paths for every user, so
   * they must never reach the analytics server — the server-side
   * onekeyIdLogout event is reserved for genuine logout actions.
   */
  @LogToLocal()
  public onekeyIdStateTrace({ reason }: { reason: string }) {
    return { reason: scrubSensitiveErrorMessageText(reason) };
  }

  @LogToLocal()
  @LogToServer()
  public onekeyIdLogout({ reason }: { reason: string }) {
    return {
      reason,
    };
  }

  /**
   * Local diagnostic trail for correlating both sides of a remote logout.
   * This deliberately stays off analytics because socket retries can repeat.
   */
  @LogToLocal()
  public onekeyIdRemoteLogoutFlow(params: IOneKeyIdRemoteLogoutFlowParams) {
    return params;
  }

  /**
   * Local diagnostic trail for the narrowly gated pre-upgrade auth migration.
   */
  @LogToLocal()
  public onekeyIdAuthStateMigration(params: IOneKeyIdAuthStateMigrationParams) {
    return params;
  }

  /**
   * Sanitized diagnostics for repairing an inconsistent local OneKey ID projection.
   */
  @LogToLocal()
  @LogToServer()
  public onekeyIdAuthStateRepair(params: IOneKeyIdAuthStateRepairParams) {
    return params;
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
      // Query/hash may carry request tokens; the message is free text from
      // interceptors — both are sanitized before leaving the device.
      url: sanitizeUrlForServerLog(url),
      errorCode,
      errorMessage: scrubSensitiveErrorMessageText(errorMessage),
    };
  }

  // Local Supabase session persistence failed (e.g. setSession's internal
  // GET /auth/v1/user was rejected). The scrubbed reason stays in exported
  // local logs; the server event receives only structured safe fields.
  @LogToServer()
  public onekeyIdSessionPersistFailed({ reason }: { reason: string }) {
    const source = 'sessionPersist';
    this.onekeyIdAuthFailureLocal({ source, reason });
    return getOneKeyIdAuthFailureServerParams({ source, reason });
  }

  // The fallback login-failed toast was shown (errors NOT handled by the
  // global auto toast). Mirrors the toast body into exported local logs.
  @LogToServer()
  public onekeyIdLoginFailedToast({ reason }: { reason: string }) {
    const source = 'fallbackToast';
    this.onekeyIdAuthFailureLocal({ source, reason });
    return getOneKeyIdAuthFailureServerParams({ source, reason });
  }

  // A OneKey ID auth failure reason recorded at the throw site. The scrubbed
  // cause stays in local logs while a strict structured subset reaches the
  // server. Fires regardless of which toast (auto, fallback, or none)
  // surfaces the failure — unlike onekeyIdLoginFailedToast above, which
  // strictly means "the fallback toast was shown".
  @LogToServer()
  public onekeyIdLoginFailedReason({ reason }: { reason: string }) {
    const source = 'throwSite';
    this.onekeyIdAuthFailureLocal({ source, reason });
    return getOneKeyIdAuthFailureServerParams({ source, reason });
  }

  // Keeps the scrubbed diagnostic text on the device. The corresponding
  // server events above receive only strict structured fields.
  @LogToLocal({ level: 'error' })
  public onekeyIdAuthFailureLocal({
    source,
    reason,
  }: {
    source: IOneKeyIdAuthFailureLogSource;
    reason: string;
  }) {
    return {
      source,
      reason: scrubSensitiveErrorMessageText(reason),
    };
  }
}
