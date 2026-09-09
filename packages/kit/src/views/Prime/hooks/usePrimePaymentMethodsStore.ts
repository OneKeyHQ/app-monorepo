import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  primePersistAtom,
  usePrimePersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import { getSanitizedErrorLogText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';
import type {
  IRevenueCatCustomerInfo,
  IRevenueCatPackage,
} from '@onekeyhq/shared/types/prime/revenueCat';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  emitPrimeSubscriptionPurchaseSuccess,
  preparePrimeSubscriptionPurchaseSuccess,
  refreshPrimeUserInfoAfterPurchase,
} from '../primeSubscriptionPurchaseSuccess';

import { getPrimePaymentApiKey } from './getPrimePaymentApiKey';
import primePaymentUtils from './primePaymentUtils';

import type { IPrimeStorePurchasesSdk } from './storePurchasesSdkTypes';
import type {
  IPackage,
  ISubscriptionPeriod,
  IUsePrimePayment,
} from './usePrimePaymentTypes';
export function usePrimePaymentMethodsStore<
  TPackage extends IRevenueCatPackage,
>(sdk: IPrimeStorePurchasesSdk<TPackage>): IUsePrimePayment {
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const [initializationError, setInitializationError] = useState<Error>();
  const { isReady: isAuthReady, user } = useOneKeyAuth();

  const [, setPrimePersistAtom] = usePrimePersistAtom();
  const [{ instanceId }] = useSettingsPersistAtom();
  const intl = useIntl();
  const currentUserIdRef = useRef(user?.onekeyUserId);
  currentUserIdRef.current = user?.onekeyUserId;

  const ensureCurrentUser = useCallback(async (expectedUserId: string) => {
    if (currentUserIdRef.current !== expectedUserId) {
      throw new OneKeyLocalError(
        'OneKey ID changed during the purchase operation',
      );
    }
    // A payment dialog can unmount before StoreKit finishes. Its React ref
    // then stops receiving account changes, so also read the live global state.
    const currentUser = await primePersistAtom.get();
    if (
      currentUser.onekeyUserId !== expectedUserId ||
      !currentUser.isLoggedIn ||
      !currentUser.isLoggedInOnServer
    ) {
      throw new OneKeyLocalError(
        'OneKey ID changed during the purchase operation',
      );
    }
  }, []);

  const isReady = isPaymentReady && isAuthReady;
  const ensurePaymentReady = useCallback(() => {
    if (initializationError) {
      throw initializationError;
    }
    if (!isReady) {
      throw new OneKeyLocalError('PrimeAuth Not ready');
    }
  }, [initializationError, isReady]);

  // TODO move to jotai context
  useEffect(() => {
    void (async () => {
      if (platformEnv.isNativeAndroid) {
        const isAvailable = await googlePlayService.isAvailable();
        if (!isAvailable) {
          // always set isPaymentReady to true, because google play service is not available
          setIsPaymentReady(true);
        }
      }

      const { apiKey } = await getPrimePaymentApiKey({
        apiKeyType: 'native',
      });
      await sdk.configure({ apiKey });
      setIsPaymentReady(true);
    })().catch((error: unknown) => {
      setInitializationError(
        error instanceof Error ? error : new OneKeyLocalError(String(error)),
      );
      // End initialization even when an older desktop shell lacks the bridge.
      // Package loading reports the error instead of showing a permanent spinner.
      setIsPaymentReady(true);
    });
  }, [sdk]);

  const loginPurchasesSdk = useCallback(
    async (expectedUserId: string) => {
      ensurePaymentReady();
      await ensureCurrentUser(expectedUserId);
      try {
        await sdk.logIn(expectedUserId);
      } catch (error) {
        console.error(getSanitizedErrorLogText(error));
        await ensureCurrentUser(expectedUserId);
        try {
          await sdk.logIn(expectedUserId);
        } catch (e) {
          console.error(getSanitizedErrorLogText(e));
        }
      }
      await ensureCurrentUser(expectedUserId);
      const appUserId = await sdk.getAppUserID();
      await ensureCurrentUser(expectedUserId);
      if (appUserId !== expectedUserId) {
        throw new OneKeyLocalError('AppUserId not match');
      }
      // Sync instanceId to RevenueCat so server-side subscription lifecycle
      // events (renewal, cancellation, etc.) land on the same analytics person
      // as client-side events. Mixpanel reads $mixpanelDistinctId; the PostHog
      // integration reads the $posthogUserId subscriber attribute instead.
      if (instanceId) {
        try {
          await sdk.setMixpanelDistinctID(instanceId, expectedUserId);
        } catch (e) {
          console.error(getSanitizedErrorLogText(e));
        }
        await ensureCurrentUser(expectedUserId);
        try {
          await sdk.setAttributes(
            {
              '$posthogUserId': instanceId,
            },
            expectedUserId,
          );
        } catch (e) {
          console.error(getSanitizedErrorLogText(e));
        }
      }
      await ensureCurrentUser(expectedUserId);
    },
    [ensureCurrentUser, ensurePaymentReady, instanceId, sdk],
  );

  const restorePurchases = useCallback(async () => {
    const restoreUserId = user.onekeyUserId;
    try {
      if (!restoreUserId) {
        throw new OneKeyLocalError('User not logged in');
      }
      await backgroundApiProxy.serviceApp.showDialogLoading({
        title: intl.formatMessage({
          id: ETranslations.prime_restoring_previous_purchases,
        }),
      });
      await loginPurchasesSdk(restoreUserId);
      const customerInfo = await sdk.restorePurchases(restoreUserId);
      await ensureCurrentUser(restoreUserId);
      const localIsActive = customerInfo?.entitlements?.active?.Prime?.isActive;
      if (localIsActive) {
        defaultLogger.prime.subscription.primeRestorePurchaseResult({
          result: 'success',
        });
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.prime_restore_successful,
          }),
        });
        try {
          await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
        } catch (error) {
          defaultLogger.prime.subscription.onekeyIdStateTrace({
            reason: `restorePurchases user-info refresh failed: ${getSanitizedErrorLogText(
              error,
            )}`,
          });
        }
      } else {
        defaultLogger.prime.subscription.primeRestorePurchaseResult({
          result: 'noPurchases',
        });
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.prime_no_purchases_found,
          }),
        });
      }
    } catch (e) {
      console.error(
        '[Prime] Restore purchases failed:',
        getSanitizedErrorLogText(e),
      );
      defaultLogger.prime.subscription.primeRestorePurchaseResult({
        result: 'failed',
      });
      Toast.message({
        title: (e as Error)?.message || 'Restore purchases failed',
      });
    } finally {
      await backgroundApiProxy.serviceApp.hideDialogLoading();
    }
  }, [ensureCurrentUser, intl, loginPurchasesSdk, sdk, user.onekeyUserId]);

  const getCustomerInfo = useCallback(async () => {
    const customerUserId = user.onekeyUserId;
    if (!customerUserId) {
      throw new OneKeyLocalError('User not logged in');
    }
    await loginPurchasesSdk(customerUserId);
    const customerInfo: IRevenueCatCustomerInfo =
      await sdk.getCustomerInfo(customerUserId);
    await ensureCurrentUser(customerUserId);

    setPrimePersistAtom(
      (prev): IPrimeUserInfo =>
        prev.onekeyUserId !== customerUserId
          ? prev
          : perfUtils.buildNewValueIfChanged(prev, {
              ...prev,
              subscriptionManageUrl: customerInfo.managementURL || '',
            }),
    );

    return customerInfo;
  }, [
    ensureCurrentUser,
    loginPurchasesSdk,
    sdk,
    setPrimePersistAtom,
    user.onekeyUserId,
  ]);

  const getPackagesNative = useCallback(async () => {
    ensurePaymentReady();
    const offerings = await sdk.getOfferings();
    const packages: IPackage[] = [];
    const availablePackages = offerings.current?.availablePackages || [];
    const iosIntroEligibleProductIds =
      await sdk.getIntroEligibleProductIds(availablePackages);
    const recurringPriceUnit = sdk.getRecurringPriceUnit();

    availablePackages.forEach((p) => {
      const { subscriptionPeriod } = p.product;
      const pricePerYear = primePaymentUtils.normalizeNativePrice(
        p.product.pricePerYear || 0,
        recurringPriceUnit,
      );
      const pricePerMonth = primePaymentUtils.normalizeNativePrice(
        p.product.pricePerMonth || 0,
        recurringPriceUnit,
      );

      const currencyCode = p.product.currencyCode || '';

      const canShowFreeTrial = iosIntroEligibleProductIds
        ? iosIntroEligibleProductIds.has(p.product.identifier)
        : true;
      const freeTrial = canShowFreeTrial
        ? primePaymentUtils.extractNativeFreeTrial(p.product)
        : undefined;

      packages.push({
        subscriptionPeriod: subscriptionPeriod as ISubscriptionPeriod,
        currencyCode,
        pricePerYear: pricePerYear || 0,
        pricePerYearString: primePaymentUtils.formatPriceString(
          pricePerYear || 0,
          currencyCode,
        ),
        pricePerMonth: pricePerMonth || 0,
        pricePerMonthString: primePaymentUtils.formatPriceString(
          pricePerMonth || 0,
          currencyCode,
        ),
        priceTotalPerYearString: primePaymentUtils.formatPriceString(
          subscriptionPeriod === 'P1M'
            ? new BigNumber(pricePerMonth || 0).times(12).toNumber()
            : pricePerYear || 0,
          currencyCode,
        ),
        freeTrial,
      });
    });

    return packages;
  }, [ensurePaymentReady, sdk]);

  // https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls#react-native
  const purchasePackageNative = useCallback(
    async ({
      subscriptionPeriod,
      featureName,
    }: {
      subscriptionPeriod: ISubscriptionPeriod;
      featureName?: EPrimeFeatures;
    }) => {
      // This hook is the single owner of the post-purchase refresh for native
      // IAP: the success path runs claim -> refresh -> emit below, and the
      // finally block covers failed/cancelled purchases exactly once. Callers
      // must not add their own refresh.
      let isPurchaseSuccessful = false;
      const purchaseUserId = user.onekeyUserId;
      try {
        if (!purchaseUserId) {
          throw new OneKeyLocalError('User not logged in');
        }
        await loginPurchasesSdk(purchaseUserId);

        const offerings = await sdk.getOfferings();
        await ensureCurrentUser(purchaseUserId);

        const offering = offerings.current?.availablePackages.find(
          (p) => p.product.subscriptionPeriod === subscriptionPeriod,
        );

        if (!offering) {
          throw new OneKeyLocalError('Offering not found');
        }

        const makePurchaseResult = await sdk.purchasePackage(
          offering,
          purchaseUserId,
        );
        await ensureCurrentUser(purchaseUserId);

        if (
          makePurchaseResult?.customerInfo?.entitlements?.active?.Prime
            ?.isActive
        ) {
          isPurchaseSuccessful = true;
          const purchaseSuccessPayload =
            await preparePrimeSubscriptionPurchaseSuccess(purchaseUserId);
          await ensureCurrentUser(purchaseUserId);
          // Set subscriptionManageUrl immediately from purchase result,
          // because the server may not yet have it (RevenueCat webhook delay).
          setPrimePersistAtom(
            (prev): IPrimeUserInfo =>
              prev.onekeyUserId !== purchaseUserId
                ? prev
                : perfUtils.buildNewValueIfChanged(prev, {
                    ...prev,
                    subscriptionManageUrl:
                      makePurchaseResult.customerInfo.managementURL ||
                      prev.subscriptionManageUrl ||
                      '',
                  }),
          );
          await refreshPrimeUserInfoAfterPurchase();
          await ensureCurrentUser(purchaseUserId);

          const rawPrice =
            subscriptionPeriod === 'P1Y'
              ? offering.product.pricePerYear
              : offering.product.pricePerMonth;
          const amount = primePaymentUtils.normalizeNativePrice(
            rawPrice || 0,
            sdk.getRecurringPriceUnit(),
          );

          primePaymentUtils.trackPrimeSubscriptionSuccess({
            amount,
            currency: offering.product.currencyCode,
            subscriptionPeriod,
            featureName,
            // StoreKit / Play Billing in-app purchase
            paymentMethod: 'iap',
          });

          void Dialog.confirm({
            dismissOnOverlayPress: false,
            icon: 'CheckLargeOutline',
            tone: 'success',
            title: intl.formatMessage({
              id: ETranslations.prime_payment_successful,
            }),
            description: intl.formatMessage({
              id: ETranslations.prime_payment_successful_description,
            }),
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_ok,
            }),
            onClose: async () => {
              try {
                await ensureCurrentUser(purchaseUserId);
              } catch {
                return;
              }
              emitPrimeSubscriptionPurchaseSuccess(purchaseSuccessPayload);
            },
          });
        }
        return makePurchaseResult;
      } catch (error) {
        const { reason } = primePaymentUtils.trackPrimeSubscriptionFailed({
          error,
          paymentMethod: 'iap',
          subscriptionPeriod,
          featureName,
        });
        if (reason !== 'userCancelled') {
          errorToastUtils.toastIfError(error);
        }
        throw error;
      } finally {
        await backgroundApiProxy.serviceApp.hideDialogLoading();
        if (!isPurchaseSuccessful) {
          // Defensive single refresh after a failed/cancelled purchase, in
          // case the store transaction went further than the SDK reported.
          await refreshPrimeUserInfoAfterPurchase();
        }
      }
    },
    [
      ensureCurrentUser,
      intl,
      loginPurchasesSdk,
      sdk,
      setPrimePersistAtom,
      user.onekeyUserId,
    ],
  );

  return {
    isReady,
    getPackagesNative,
    purchasePackageNative,
    restorePurchases,
    getPackagesWeb: undefined,
    purchasePackageWeb: undefined,
    getCustomerInfo,
  };
}
