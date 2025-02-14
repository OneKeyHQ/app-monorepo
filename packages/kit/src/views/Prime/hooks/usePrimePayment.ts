import { useCallback, useEffect, useRef } from 'react';

import { LogLevel, Purchases } from '@revenuecat/purchases-js';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  REVENUECAT_API_KEY_WEB,
  REVENUECAT_API_KEY_WEB_SANDBOX,
} from '@onekeyhq/shared/src/consts/primeConsts';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
// load stripe js before revenuecat, otherwise revenuecat will create script tag load https://js.stripe.com/v3
// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/modules3rdParty/stripe-v3';

import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

import type {
  IPrimeSubscriptionPlan,
  ISubscriptionPeriod,
  IUsePrimePayment,
} from './usePrimePaymentTypes';
import type { CustomerInfo, PurchaseParams } from '@revenuecat/purchases-js';

export function usePrimePayment(): IUsePrimePayment {
  const { user, isReady: isAuthReady } = usePrivyUniversalV2();
  const [, setPrimePersistAtom] = usePrimePersistAtom();

  const isReady = isAuthReady;
  const configureDonePromise = useRef(createPromiseTarget<boolean>());

  const getCustomerInfo = useCallback(async () => {
    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
    }
    if (!user?.id) {
      throw new Error('User not logged in');
    }
    if (process.env.NODE_ENV !== 'production') {
      Purchases.setLogLevel(LogLevel.Verbose);
    }
    const devSettings =
      await backgroundApiProxy.serviceDevSetting.getDevSetting();
    let apiKey = REVENUECAT_API_KEY_WEB;
    if (devSettings?.settings?.usePrimeSandboxPayment) {
      apiKey = REVENUECAT_API_KEY_WEB_SANDBOX;
    }
    if (!apiKey) {
      throw new Error('No REVENUECAT api key found');
    }

    // TODO VPN required
    // await Purchases.setProxyURL('https://api.rc-backup.com/');

    // TODO how to configure another userId when user login with another account
    // https://www.revenuecat.com/docs/customers/user-ids#logging-in-with-a-custom-app-user-id

    Purchases.configure(apiKey, user?.id || '');

    const customerInfo: CustomerInfo =
      await Purchases.getSharedInstance().getCustomerInfo();
    console.log('customerInfo >>>>>> ', user?.id, customerInfo);

    const appUserId = Purchases.getSharedInstance().getAppUserId();
    if (appUserId !== user?.id) {
      throw new Error('AppUserId not match');
    }

    setPrimePersistAtom((prev) => {
      const newData: IPrimeUserInfo = {
        ...prev,
        subscriptionManageUrl: customerInfo.managementURL || '',
      };
      // update prime status by local sdk
      if (process.env.NODE_ENV !== 'production') {
        const isPrime = customerInfo?.entitlements?.active?.Prime?.isActive;
        if (isPrime) {
          const willRenew =
            customerInfo?.entitlements?.active?.Prime?.willRenew;
          newData.primeSubscription = {
            isActive: true,
            expiresAt: willRenew
              ? 0
              : customerInfo.entitlements.active.Prime.expirationDate?.getTime() ??
                0,
          };
        } else {
          newData.primeSubscription = undefined;
        }
      }
      return perfUtils.buildNewValueIfChanged(prev, newData);
    });

    if ('gold_entitlement' in customerInfo.entitlements.active) {
      // Grant user access to the entitlement "gold_entitlement"
      // grantEntitlementAccess();
    }

    configureDonePromise.current.resolveTarget(true);
    return customerInfo;
  }, [isReady, setPrimePersistAtom, user?.id]);

  useEffect(() => {
    void (async () => {
      if (isReady && user?.id) {
        await getCustomerInfo();
      }
    })();
  }, [getCustomerInfo, isReady, user?.id]);

  const getPrimeSubscriptionPlanWeb = useCallback(async () => {
    await configureDonePromise.current.ready;

    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
    }

    const offerings = await Purchases.getSharedInstance().getOfferings({
      currency: 'USD',
    });

    const packages2: IPrimeSubscriptionPlan[] =
      offerings?.current?.availablePackages?.map((p) => ({
        subscriptionPeriod: p.rcBillingProduct
          .normalPeriodDuration as ISubscriptionPeriod,
        pricePerMonthString: p.rcBillingProduct.currentPrice.formattedPrice,
        pricePerYearString: p.rcBillingProduct.currentPrice.formattedPrice,
      })) || [];

    return packages2;
  }, [isReady]);

  const purchasePaywallPackageWeb = useCallback(
    async ({
      packageId,
      email,
      locale,
    }: {
      packageId: string;
      email: string;
      locale?: string; // https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls#supported-locales
    }) => {
      try {
        if (!isReady) {
          throw new Error('PrimeAuth Not ready');
        }

        const offerings = await Purchases.getSharedInstance().getOfferings({
          currency: 'USD',
        });

        if (!offerings.current) {
          throw new Error('purchasePaywallPackage ERROR: Invalid packageId');
        }

        const paywallPackage = offerings.current.availablePackages.find(
          (p) => p.rcBillingProduct.normalPeriodDuration === packageId,
        );

        if (!paywallPackage) {
          throw new Error('purchasePaywallPackage ERROR: Invalid packageId');
        }

        const purchaseParams: PurchaseParams = {
          rcPackage: paywallPackage,
          customerEmail: email,
          selectedLocale: locale,
        };
        // TODO check package user is Matched to id
        // TODO check if user has already purchased
        const purchase = await Purchases.getSharedInstance().purchase(
          purchaseParams,
        );
        // test credit card
        // https://docs.stripe.com/testing#testing-interactively
        // Mastercard: 5555555555554444
        // visa: 4242424242424242
        return purchase;
      } catch (error) {
        errorToastUtils.toastIfError(error);
        throw error;
      }
    },
    [isReady],
  );

  return {
    isReady,
    presentPaywallNative: undefined,
    getPaywallPackagesNative: undefined,
    getPrimeSubscriptionPlanWeb,
    purchasePaywallPackageWeb,
    getCustomerInfo,
  };
}
