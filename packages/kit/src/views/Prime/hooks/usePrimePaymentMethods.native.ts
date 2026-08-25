import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import PurchasesReactNative, {
  type CustomerInfo,
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  type PurchasesPackage,
} from 'react-native-purchases';

import { Dialog, Toast } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
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
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  emitPrimeSubscriptionPurchaseSuccess,
  preparePrimeSubscriptionPurchaseSuccess,
  refreshPrimeUserInfoAfterPurchase,
} from '../primeSubscriptionPurchaseSuccess';

import { getPrimePaymentApiKey } from './getPrimePaymentApiKey';
import primePaymentUtils from './primePaymentUtils';
import {
  configureRevenueCat,
  getRevenueCatRecurringPriceUnit,
} from './revenueCatNativeCompatibility.native';

import type {
  IPackage,
  ISubscriptionPeriod,
  IUsePrimePayment,
} from './usePrimePaymentTypes';
void (async () => {
  if (process.env.NODE_ENV !== 'production') {
    await PurchasesReactNative.setLogLevel(LOG_LEVEL.VERBOSE);
    // TODO VPN required
    await PurchasesReactNative.setProxyURL('https://api.rc-backup.com/');
  }
})();

async function getIOSIntroEligibleProductIds(
  nativePackages: PurchasesPackage[],
): Promise<ReadonlySet<string> | undefined> {
  if (!platformEnv.isNativeIOS) {
    return undefined;
  }

  const productIds = nativePackages.map(({ product }) => product.identifier);
  if (!productIds.length) {
    return new Set();
  }

  try {
    const eligibilityByProductId =
      await PurchasesReactNative.checkTrialOrIntroductoryPriceEligibility(
        productIds,
      );

    return new Set(
      productIds.filter(
        (productId) =>
          eligibilityByProductId[productId]?.status ===
          INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE,
      ),
    );
  } catch {
    // RevenueCat recommends showing non-intro pricing when eligibility is
    // unknown to avoid misleading users.
    return new Set();
  }
}

export function usePrimePaymentMethods(): IUsePrimePayment {
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const { isReady: isAuthReady, user } = useOneKeyAuth();

  const [, setPrimePersistAtom] = usePrimePersistAtom();
  const [{ instanceId }] = useSettingsPersistAtom();
  const intl = useIntl();

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
      // Defer RevenueCat configure to avoid blocking main thread during startup.
      // The native setupPurchases runs synchronously on main thread via TurboModule,
      // and performs heavy JSON decoding of cached CustomerInfo causing 5s+ AppHang.
      requestIdleCallback(() => {
        configureRevenueCat({ apiKey });
        setIsPaymentReady(true);
      });
    })();
  }, []);

  const loginPurchasesSdk = useCallback(async () => {
    if (!user?.onekeyUserId) {
      throw new OneKeyLocalError('User not logged in');
    }
    if (user?.onekeyUserId) {
      try {
        await PurchasesReactNative.logIn(user.onekeyUserId);
      } catch (e) {
        console.error(e);
      }
      try {
        await PurchasesReactNative.logIn(user.onekeyUserId);
      } catch (e) {
        console.error(e);
      }
    }
    const appUserId = await PurchasesReactNative.getAppUserID();
    if (appUserId !== user?.onekeyUserId) {
      throw new OneKeyLocalError('AppUserId not match');
    }
    // Sync instanceId to RevenueCat so server-side subscription lifecycle
    // events (renewal, cancellation, etc.) land on the same analytics person
    // as client-side events. Mixpanel reads $mixpanelDistinctId; the PostHog
    // integration reads the $posthogUserId subscriber attribute instead.
    if (instanceId) {
      try {
        await PurchasesReactNative.setMixpanelDistinctID(instanceId);
      } catch (e) {
        console.error(e);
      }
      try {
        await PurchasesReactNative.setAttributes({
          '$posthogUserId': instanceId,
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [instanceId, user?.onekeyUserId]);

  const restorePurchases = useCallback(async () => {
    try {
      await backgroundApiProxy.serviceApp.showDialogLoading({
        title: intl.formatMessage({
          id: ETranslations.prime_restoring_previous_purchases,
        }),
      });
      await loginPurchasesSdk();
      console.log('restorePurchases >>>>>>');
      const customerInfo = await PurchasesReactNative.restorePurchases();
      console.log('restorePurchases >>>>>> customerInfo', customerInfo);
      const localIsActive = customerInfo?.entitlements?.active?.Prime?.isActive;
      if (localIsActive) {
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
        defaultLogger.prime.subscription.primeRestorePurchaseResult({
          result: 'success',
        });
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.prime_restore_successful,
          }),
        });
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
      console.error('restorePurchases >>>>>> error', e);
      defaultLogger.prime.subscription.primeRestorePurchaseResult({
        result: 'failed',
      });
      Toast.message({
        title: (e as Error)?.message || 'Restore purchases failed',
      });
    } finally {
      await backgroundApiProxy.serviceApp.hideDialogLoading();
    }
  }, [intl, loginPurchasesSdk]);

  const isReady = isPaymentReady && isAuthReady;

  const getCustomerInfo = useCallback(async () => {
    if (!isReady) {
      throw new OneKeyLocalError('PrimeAuth Not ready');
    }
    await loginPurchasesSdk();
    const customerInfo: CustomerInfo =
      await PurchasesReactNative.getCustomerInfo();

    setPrimePersistAtom(
      (prev): IPrimeUserInfo =>
        perfUtils.buildNewValueIfChanged(prev, {
          ...prev,
          subscriptionManageUrl: customerInfo.managementURL || '',
        }),
    );

    return customerInfo;
  }, [isReady, loginPurchasesSdk, setPrimePersistAtom]);

  const getPackagesNative = useCallback(async () => {
    if (!isReady) {
      throw new OneKeyLocalError(
        'PrimeAuth native not ready, please try again later',
      );
    }
    const offerings = await PurchasesReactNative.getOfferings();
    const packages: IPackage[] = [];
    const availablePackages = offerings.current?.availablePackages || [];
    const iosIntroEligibleProductIds =
      await getIOSIntroEligibleProductIds(availablePackages);
    const recurringPriceUnit = getRevenueCatRecurringPriceUnit();

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

    console.log('userPrimePaymentMethods >>>>>> nativePackages', {
      packages,
      offerings,
    });

    return packages;
  }, [isReady]);

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
      try {
        if (!isReady) {
          throw new OneKeyLocalError('PrimeAuth native not ready!');
        }
        await loginPurchasesSdk();

        // await backgroundApiProxy.serviceApp.showDialogLoading({
        //   title: intl.formatMessage({
        //     id: ETranslations.global_processing,
        //   }),
        // });

        const offerings = await PurchasesReactNative.getOfferings();

        const offering = offerings.current?.availablePackages.find(
          (p) => p.product.subscriptionPeriod === subscriptionPeriod,
        );

        if (!offering) {
          throw new OneKeyLocalError('Offering not found');
        }

        const purchaseUserId = user.onekeyUserId;
        if (!purchaseUserId) {
          throw new OneKeyLocalError('User not logged in');
        }
        const makePurchaseResult =
          await PurchasesReactNative.purchasePackage(offering);

        if (
          makePurchaseResult?.customerInfo?.entitlements?.active?.Prime
            ?.isActive
        ) {
          isPurchaseSuccessful = true;
          const purchaseSuccessPayload =
            await preparePrimeSubscriptionPurchaseSuccess(purchaseUserId);
          // Set subscriptionManageUrl immediately from purchase result,
          // because the server may not yet have it (RevenueCat webhook delay).
          setPrimePersistAtom(
            (prev): IPrimeUserInfo =>
              perfUtils.buildNewValueIfChanged(prev, {
                ...prev,
                subscriptionManageUrl:
                  makePurchaseResult.customerInfo.managementURL ||
                  prev.subscriptionManageUrl ||
                  '',
              }),
          );
          await refreshPrimeUserInfoAfterPurchase();

          const rawPrice =
            subscriptionPeriod === 'P1Y'
              ? offering.product.pricePerYear
              : offering.product.pricePerMonth;
          const amount = primePaymentUtils.normalizeNativePrice(
            rawPrice || 0,
            getRevenueCatRecurringPriceUnit(),
          );

          primePaymentUtils.trackPrimeSubscriptionSuccess({
            amount,
            currency: offering.product.currencyCode,
            subscriptionPeriod,
            featureName,
            // react-native-purchases = StoreKit / Play Billing in-app purchase
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
            onClose: () => {
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
    [isReady, intl, loginPurchasesSdk, setPrimePersistAtom, user.onekeyUserId],
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
