import { useCallback } from 'react';

import { LogLevel, Purchases } from '@revenuecat/purchases-js';
import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import type { ILocaleJSONSymbol } from '@onekeyhq/shared/src/locale';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import purchaseSdkUtils from '../purchasesSdk/purchaseSdkUtils';

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
  console.log('Purchases.setLogLevel Verbose');
  Purchases.setLogLevel(LogLevel.Verbose);
}

export function usePrimePaymentMethodsWeb(): IUsePrimePayment {
  const { user, isReady: isAuthReady } = usePrimeAuthV2();
  const [, setPrimePersistAtom] = usePrimePersistAtom();
  const isReady = isAuthReady;

  const initSdk = useCallback(
    async ({ loginRequired }: { loginRequired?: boolean } = {}) => {
      console.log('initSdk');
      const { apiKey } = await getPrimePaymentApiKey({
        apiKeyType: 'web',
      });
      if (!isReady) {
        throw new OneKeyLocalError('PrimeAuth Not ready');
      }
      if (!apiKey) {
        throw new OneKeyLocalError('No REVENUECAT api key found');
      }
      if (!user?.privyUserId && loginRequired) {
        throw new OneKeyLocalError('User not logged in');
      }

      // TODO VPN required
      // await Purchases.setProxyURL('https://api.rc-backup.com/');

      // TODO how to configure another userId when user login with another account
      // https://www.revenuecat.com/docs/customers/user-ids#logging-in-with-a-custom-app-user-id

      Purchases.configure(
        apiKey,
        user?.privyUserId || Purchases.generateRevenueCatAnonymousAppUserId(),
      );
    },
    [isReady, user?.privyUserId],
  );

  const getCustomerInfo = useCallback(async () => {
    await initSdk({ loginRequired: true });

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

    return customerInfo;
  }, [initSdk, setPrimePersistAtom, user?.privyUserId]);

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

    console.log('userPrimePaymentMethods >>>>>> WebPackages', {
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
      await initSdk({ loginRequired: true });
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
        errorToastUtils.toastIfError(error);
        throw error;
      } finally {
        // will block stripe modal
        // void backgroundApiProxy.serviceApp.hideDialogLoading();
      }
    },
    [initSdk, isReady],
  );

  const intl = useIntl();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const testToast = useCallback(() => {
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.prime_restore_successful,
      }),
    });
  }, [intl]);

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
