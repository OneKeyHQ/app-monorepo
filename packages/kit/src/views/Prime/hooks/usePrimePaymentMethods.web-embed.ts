import { useCallback, useMemo } from 'react';

// load stripe js before revenuecat, otherwise revenuecat will create script tag load https://js.stripe.com/v3
// eslint-disable-next-line import/order
import '@onekeyhq/shared/src/modules3rdParty/stripe-v3';
import { LogLevel, Purchases } from '@revenuecat/purchases-js';
import { BigNumber } from 'bignumber.js';
import { useSearchParams } from 'react-router-dom';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale';

import purchaseSdkUtils from '../purchasesSdk/purchaseSdkUtils';

import primePaymentUtils from './primePaymentUtils';

import type {
  IPackage,
  ISubscriptionPeriod,
  IUsePrimePayment,
} from './usePrimePaymentTypes';
import type { CustomerInfo, PurchaseParams } from '@revenuecat/purchases-js';

if (process.env.NODE_ENV !== 'production') {
  console.log('Purchases.setLogLevel Verbose');
  Purchases.setLogLevel(LogLevel.Verbose);
}

export function usePrimePaymentMethods(): IUsePrimePayment {
  const isReady = true;

  const [searchParams] = useSearchParams();

  const params = useMemo(() => {
    const apiKey = searchParams.get('apiKey') || '';
    const primeUserId = searchParams.get('primeUserId') || '';
    const primeUserEmail = searchParams.get('primeUserEmail') || '';
    const subscriptionPeriod = (searchParams.get('subscriptionPeriod') ||
      '') as ISubscriptionPeriod;
    const locale = searchParams.get('locale') || 'en';
    const mode = (searchParams.get('mode') || 'prod') as 'dev' | 'prod';
    return {
      apiKey,
      primeUserId,
      primeUserEmail,
      subscriptionPeriod,
      locale,
      mode,
    };
  }, [searchParams]);

  const initSdk = useCallback(async () => {
    const apiKey = params.apiKey;
    const primeUserId = params.primeUserId;
    if (!isReady) {
      throw new OneKeyLocalError('PrimeAuth Not ready');
    }
    if (!apiKey) {
      throw new OneKeyLocalError('No REVENUECAT api key found');
    }
    if (!primeUserId) {
      throw new OneKeyLocalError('User not logged in');
    }

    // TODO VPN required
    // await Purchases.setProxyURL('https://api.rc-backup.com/');

    // TODO how to configure another userId when user login with another account
    // https://www.revenuecat.com/docs/customers/user-ids#logging-in-with-a-custom-app-user-id

    console.log('Purchases.configure', apiKey, primeUserId);
    Purchases.configure(apiKey, primeUserId);
    console.log('Purchases.configure done');
  }, [isReady, params.apiKey, params.primeUserId]);

  const getCustomerInfo = useCallback(async () => {
    await initSdk();

    const customerInfo: CustomerInfo =
      await Purchases.getSharedInstance().getCustomerInfo();

    console.log('revenuecat customerInfo', customerInfo);

    const appUserId = Purchases.getSharedInstance().getAppUserId();
    if (appUserId !== params.primeUserId) {
      throw new OneKeyLocalError('AppUserId not match');
    }

    if ('gold_entitlement' in customerInfo.entitlements.active) {
      // Grant user access to the entitlement "gold_entitlement"
      // grantEntitlementAccess();
    }

    return customerInfo;
  }, [initSdk, params.primeUserId]);

  const getPackagesWeb = useCallback(async () => {
    await initSdk();

    if (!isReady) {
      throw new OneKeyLocalError('PrimeAuth Not ready');
    }

    const offerings = await Purchases.getSharedInstance().getOfferings({
      currency: 'USD',
    });

    const packages: IPackage[] =
      offerings?.current?.availablePackages?.map((p) => {
        const { normalPeriodDuration, currentPrice } = p.rcBillingProduct;

        let currency = '';
        currency = primePaymentUtils.extractCurrencySymbol(
          currentPrice.formattedPrice,
          {
            useShortUSSymbol: true,
          },
        );

        const pricePerMonthBN =
          normalPeriodDuration === 'P1M'
            ? new BigNumber(currentPrice.amountMicros).div(1_000_000)
            : new BigNumber(currentPrice.amountMicros).div(12).div(1_000_000);

        const pricePerMonth = pricePerMonthBN.toFixed(2);
        const pricePerYear = pricePerMonthBN.times(12).toFixed(2);

        return {
          subscriptionPeriod: normalPeriodDuration as ISubscriptionPeriod,
          pricePerYear: Number(pricePerYear),
          pricePerYearString: `${currency}${pricePerYear}`,
          pricePerMonth: Number(pricePerMonth),
          pricePerMonthString: `${currency}${pricePerMonth}`,
          priceTotalPerYearString: `${currency}${pricePerYear}`,
        };
      }) || [];

    console.log('userPrimePaymentMethods >>>>>> webEmbedPackages', {
      packages,
      offerings,
    });

    return packages;
  }, [initSdk, isReady]);

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
      console.log('purchasePackageWeb77632723>>>>>>', {
        subscriptionPeriod,
        email,
        locale,
      });

      await initSdk();

      console.log('purchasePackageWeb77632723>>>>>> initSdk done');

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

        console.log(
          'purchasePackageWeb77632723>>>>>> getOfferings',
          typeof Purchases.getSharedInstance().getOfferings,
        );
        const offerings = await Purchases.getSharedInstance().getOfferings({
          currency: 'USD',
        });
        console.log('purchasePackageWeb77632723>>>>>> offerings', {
          offerings,
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

        console.log('purchasePackageWeb77632723>>>>>> paywallPackage', {
          paywallPackage,
        });

        const purchaseParams: PurchaseParams = {
          rcPackage: paywallPackage,
          customerEmail: email,
          selectedLocale: purchaseSdkUtils.convertToRevenuecatLocale({
            locale: locale as ILocaleJSONSymbol,
          }),
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
        console.error('purchasePaywallPackage ERROR', error);
        // TODO alert error
        // errorToastUtils.toastIfError(error);
        throw error;
      } finally {
        // will block stripe modal
        // void backgroundApiProxy.serviceApp.hideDialogLoading();
      }
    },
    [initSdk, isReady],
  );

  return {
    isReady,
    purchasePackageNative: undefined,
    getPackagesNative: undefined,
    restorePurchases: undefined,
    getPackagesWeb,
    purchasePackageWeb,
    getCustomerInfo,
    webEmbedQueryParams: params,
  };
}
