import { useCallback, useEffect, useRef } from 'react';

import { Purchases } from '@revenuecat/purchases-js';
import { BigNumber } from 'bignumber.js';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
// load stripe js before revenuecat, otherwise revenuecat will create script tag load https://js.stripe.com/v3
// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/modules3rdParty/stripe-v3';

import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimeAuthV2 } from './usePrimeAuthV2';
import { getPrimePaymentWebApiKey } from './usePrimePaymentWebApiKey';

import type {
  IPackage,
  ISubscriptionPeriod,
  IUsePrimePayment,
} from './usePrimePaymentTypes';
import type { CustomerInfo, PurchaseParams } from '@revenuecat/purchases-js';

export function usePrimePayment(): IUsePrimePayment {
  const { user, isReady: isAuthReady } = usePrimeAuthV2();
  const [, setPrimePersistAtom] = usePrimePersistAtom();
  const isReady = isAuthReady;
  const configureDonePromise = useRef(createPromiseTarget<boolean>());

  const getCustomerInfo = useCallback(async () => {
    const apiKey = await getPrimePaymentWebApiKey();
    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
    }
    if (!apiKey) {
      throw new Error('No REVENUECAT api key found');
    }
    if (!user?.privyUserId) {
      throw new Error('User not logged in');
    }

    // TODO VPN required
    // await Purchases.setProxyURL('https://api.rc-backup.com/');

    // TODO how to configure another userId when user login with another account
    // https://www.revenuecat.com/docs/customers/user-ids#logging-in-with-a-custom-app-user-id

    Purchases.configure(apiKey, user?.privyUserId || '');

    const customerInfo: CustomerInfo =
      await Purchases.getSharedInstance().getCustomerInfo();

    const appUserId = Purchases.getSharedInstance().getAppUserId();
    if (appUserId !== user?.privyUserId) {
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
  }, [isReady, setPrimePersistAtom, user?.privyUserId]);

  useEffect(() => {
    void (async () => {
      if (isReady && user?.privyUserId) {
        await getCustomerInfo();
      }
    })();
  }, [getCustomerInfo, isReady, user?.privyUserId]);

  const getPackagesWeb = useCallback(async () => {
    await configureDonePromise.current.ready;

    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
    }

    const offerings = await Purchases.getSharedInstance().getOfferings({
      currency: 'USD',
    });

    const packages: IPackage[] =
      offerings?.current?.availablePackages?.map((p) => {
        const { normalPeriodDuration, currentPrice } = p.rcBillingProduct;

        const pricePerMonth =
          normalPeriodDuration === 'P1M'
            ? currentPrice.formattedPrice
            : `$${new BigNumber(currentPrice.amountMicros)
                .div(12)
                .div(1_000_000)
                .toFixed(2)}`;

        return {
          subscriptionPeriod: normalPeriodDuration as ISubscriptionPeriod,
          pricePerMonthString: pricePerMonth,
          pricePerYearString: currentPrice.formattedPrice,
        };
      }) || [];

    return packages;
  }, [isReady]);

  const purchasePackageWeb = useCallback(
    async ({
      subscriptionPeriod,
      email,
      locale,
    }: {
      subscriptionPeriod: string;
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
          throw new Error('purchasePaywallPackage ERROR: No offerings');
        }

        const paywallPackage = offerings.current.availablePackages.find(
          (p) => p.rcBillingProduct.normalPeriodDuration === subscriptionPeriod,
        );

        if (!paywallPackage) {
          throw new Error('purchasePaywallPackage ERROR: No paywall package');
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
    purchasePackageNative: undefined,
    getPackagesNative: undefined,
    getPackagesWeb,
    purchasePackageWeb,
    getCustomerInfo,
  };
}
