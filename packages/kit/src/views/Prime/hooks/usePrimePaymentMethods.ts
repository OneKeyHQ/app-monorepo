import { useCallback, useEffect, useRef } from 'react';

import { LogLevel, Purchases } from '@revenuecat/purchases-js';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
// load stripe js before revenuecat, otherwise revenuecat will create script tag load https://js.stripe.com/v3
// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/modules3rdParty/stripe-v3';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { getPrimePaymentApiKey } from './getPrimePaymentApiKey';
import primePaymentUtils from './primePaymentUtils';
import { usePrimeAuthV2 } from './usePrimeAuthV2';

import type {
  IPackage,
  ISubscriptionPeriod,
  IUsePrimePayment,
} from './usePrimePaymentTypes';
import type { CustomerInfo, PurchaseParams } from '@revenuecat/purchases-js';

if (process.env.NODE_ENV !== 'production') {
  Purchases.setLogLevel(LogLevel.Verbose);
}

export function usePrimePaymentMethods(): IUsePrimePayment {
  const { user, isReady: isAuthReady } = usePrimeAuthV2();
  const [, setPrimePersistAtom] = usePrimePersistAtom();
  const isReady = isAuthReady;
  const configureDonePromise = useRef(createPromiseTarget<boolean>());
  const intl = useIntl();

  const getCustomerInfo = useCallback(async () => {
    const { apiKey } = await getPrimePaymentApiKey({
      apiKeyType: 'web',
    });
    if (!isReady) {
      throw new OneKeyLocalError('PrimeAuth Not ready');
    }
    if (!apiKey) {
      throw new OneKeyLocalError('No REVENUECAT api key found');
    }
    if (!user?.privyUserId) {
      throw new OneKeyLocalError('User not logged in');
    }

    // TODO VPN required
    // await Purchases.setProxyURL('https://api.rc-backup.com/');

    // TODO how to configure another userId when user login with another account
    // https://www.revenuecat.com/docs/customers/user-ids#logging-in-with-a-custom-app-user-id

    Purchases.configure(apiKey, user?.privyUserId || '');

    const customerInfo: CustomerInfo =
      await Purchases.getSharedInstance().getCustomerInfo();

    console.log('revenuecat customerInfo', customerInfo);

    const appUserId = Purchases.getSharedInstance().getAppUserId();
    if (appUserId !== user?.privyUserId) {
      throw new OneKeyLocalError('AppUserId not match');
    }

    setPrimePersistAtom((prev): IPrimeUserInfo => {
      const newData: IPrimeUserInfo = {
        ...prev,
        subscriptionManageUrl: customerInfo.managementURL || '',
      };
      return perfUtils.buildNewValueIfChanged(prev, newData);
    });

    if ('gold_entitlement' in customerInfo.entitlements.active) {
      // Grant user access to the entitlement "gold_entitlement"
      // grantEntitlementAccess();
    }

    configureDonePromise.current.resolveTarget(true);
    return customerInfo;
  }, [isReady, setPrimePersistAtom, user?.privyUserId]);

  const getPackagesWeb = useCallback(async () => {
    await configureDonePromise.current.ready;

    if (!isReady) {
      throw new OneKeyLocalError('PrimeAuth Not ready');
    }

    const offerings = await Purchases.getSharedInstance().getOfferings({
      currency: 'USD',
    });

    const packages: IPackage[] =
      offerings?.current?.availablePackages?.map((p) => {
        const { normalPeriodDuration, currentPrice } = p.rcBillingProduct;

        let unit = '';
        unit = primePaymentUtils.extractCurrencySymbol(
          currentPrice.formattedPrice,
          {
            useShortUSSymbol: true,
          },
        );

        const pricePerYear = new BigNumber(currentPrice.amountMicros)
          .div(1_000_000)
          .toFixed(2);

        const pricePerMonth =
          normalPeriodDuration === 'P1M'
            ? new BigNumber(currentPrice.amountMicros).div(1_000_000).toFixed(2)
            : new BigNumber(currentPrice.amountMicros)
                .div(12)
                .div(1_000_000)
                .toFixed(2);

        return {
          subscriptionPeriod: normalPeriodDuration as ISubscriptionPeriod,
          pricePerYear: Number(pricePerYear),
          pricePerYearString: `${unit}${pricePerYear}`,
          pricePerMonth: Number(pricePerMonth),
          pricePerMonthString: `${unit}${pricePerMonth}`,
          priceTotalPerYearString:
            normalPeriodDuration === 'P1M'
              ? `${unit}${new BigNumber(pricePerMonth).times(12).toFixed(2)}`
              : `${unit}${pricePerYear}`,
        };
      }) || [];

    console.log('userPrimePaymentMethods >>>>>> packages', {
      packages,
      offerings,
    });

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
          throw new OneKeyLocalError('PrimeAuth Not ready');
        }

        // will block stripe modal
        // await backgroundApiProxy.serviceApp.showDialogLoading({
        //   title: intl.formatMessage({
        //     id: ETranslations.global_processing,
        //   }),
        // });

        const offerings = await Purchases.getSharedInstance().getOfferings({
          currency: 'USD',
        });

        if (!offerings.current) {
          throw new OneKeyLocalError(
            'purchasePaywallPackage ERROR: No offerings',
          );
        }

        const paywallPackage = offerings.current.availablePackages.find(
          (p) => p.rcBillingProduct.normalPeriodDuration === subscriptionPeriod,
        );

        if (!paywallPackage) {
          throw new OneKeyLocalError(
            'purchasePaywallPackage ERROR: No paywall package',
          );
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
      } finally {
        // will block stripe modal
        // void backgroundApiProxy.serviceApp.hideDialogLoading();
      }
    },
    [isReady],
  );

  return {
    isReady,
    purchasePackageNative: undefined,
    getPackagesNative: undefined,
    restorePurchases: undefined,
    getPackagesWeb,
    purchasePackageWeb,
    getCustomerInfo,
  };
}
