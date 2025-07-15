import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import PurchasesReactNative, { LOG_LEVEL } from 'react-native-purchases';

import { Dialog, Toast } from '@onekeyhq/components';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { getPrimePaymentApiKey } from './getPrimePaymentApiKey';
import primePaymentUtils from './primePaymentUtils';
import { usePrimeAuthV2 } from './usePrimeAuthV2';

import type {
  IPackage,
  ISubscriptionPeriod,
  IUsePrimePayment,
} from './usePrimePaymentTypes';
import type { CustomerInfo } from '@revenuecat/purchases-typescript-internal';

void (async () => {
  if (process.env.NODE_ENV !== 'production') {
    await PurchasesReactNative.setLogLevel(LOG_LEVEL.VERBOSE);
    // TODO VPN required
    await PurchasesReactNative.setProxyURL('https://api.rc-backup.com/');
  }
})();

export function usePrimePaymentMethods(): IUsePrimePayment {
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const { isReady: isAuthReady, user } = usePrimeAuthV2();

  const [, setPrimePersistAtom] = usePrimePersistAtom();
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
      PurchasesReactNative.configure({
        apiKey,
        // useAmazon: true
      });
      setIsPaymentReady(true);
    })();
  }, []);

  const loginPurchasesSdk = useCallback(async () => {
    if (!user?.privyUserId) {
      throw new OneKeyLocalError('User not logged in');
    }
    if (user?.privyUserId) {
      try {
        await PurchasesReactNative.logIn(user.privyUserId);
      } catch (e) {
        console.error(e);
      }
      try {
        await PurchasesReactNative.logIn(user.privyUserId);
      } catch (e) {
        console.error(e);
      }
    }
    const appUserId = await PurchasesReactNative.getAppUserID();
    if (appUserId !== user?.privyUserId) {
      throw new OneKeyLocalError('AppUserId not match');
    }
  }, [user?.privyUserId]);

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
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.prime_restore_successful,
          }),
        });
      } else {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.prime_no_purchases_found,
          }),
        });
      }
    } catch (e) {
      console.error('restorePurchases >>>>>> error', e);
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

    offerings.current?.availablePackages.forEach((p) => {
      let {
        subscriptionPeriod,
        pricePerYear,
        pricePerYearString,
        pricePerMonth,
        pricePerMonthString,
        priceString,
      } = p.product;

      if (platformEnv.isNativeAndroid) {
        pricePerYear = new BigNumber(pricePerYear || 0)
          .div(1_000_000)
          .toNumber();
        pricePerMonth = new BigNumber(pricePerMonth || 0)
          .div(1_000_000)
          .toNumber();
      }

      const currency =
        primePaymentUtils.extractCurrencySymbol(priceString, {
          useShortUSSymbol: true,
        }) ||
        primePaymentUtils.extractCurrencySymbol(pricePerYearString || '', {
          useShortUSSymbol: true,
        }) ||
        primePaymentUtils.extractCurrencySymbol(pricePerMonthString || '', {
          useShortUSSymbol: true,
        });

      packages.push({
        subscriptionPeriod: subscriptionPeriod as ISubscriptionPeriod,
        pricePerYear: pricePerYear || 0,
        pricePerYearString: `${currency}${new BigNumber(
          pricePerYear || 0,
        ).toFixed(2)}`,
        pricePerMonth: pricePerMonth || 0,
        pricePerMonthString: `${currency}${new BigNumber(
          pricePerMonth || 0,
        ).toFixed(2)}`,
        priceTotalPerYearString:
          subscriptionPeriod === 'P1M'
            ? `${currency}${new BigNumber(pricePerMonth || 0)
                .times(12)
                .toFixed(2)}`
            : `${currency}${new BigNumber(pricePerYear || 0).toFixed(2)}`,
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
    }: {
      subscriptionPeriod: ISubscriptionPeriod;
    }) => {
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

        const makePurchaseResult = await PurchasesReactNative.purchasePackage(
          offering,
        );

        if (
          makePurchaseResult?.customerInfo?.entitlements?.active?.Prime
            ?.isActive
        ) {
          await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
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
          });
        }
        return makePurchaseResult;
      } catch (error) {
        const e = error as Error | undefined;
        if (e?.message && !['Purchase was cancelled.'].includes(e?.message)) {
          errorToastUtils.toastIfError(error);
        }
        throw error;
      } finally {
        await backgroundApiProxy.serviceApp.hideDialogLoading();
      }
    },
    [isReady, intl, loginPurchasesSdk],
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
