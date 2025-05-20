import { useCallback, useEffect, useState } from 'react';

import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  REVENUECAT_API_KEY_APPLE,
  REVENUECAT_API_KEY_GOOGLE,
} from '@onekeyhq/shared/src/consts/primeConsts';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimeAuthV2 } from './usePrimeAuthV2';

import type {
  IPackage,
  ISubscriptionPeriod,
  IUsePrimePayment,
} from './usePrimePaymentTypes';
import type { CustomerInfo } from '@revenuecat/purchases-typescript-internal';

export function usePrimePayment(): IUsePrimePayment {
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const { isReady: isAuthReady, user } = usePrimeAuthV2();

  const [, setPrimePersistAtom] = usePrimePersistAtom();

  const isReady = isPaymentReady && isAuthReady;

  const getCustomerInfo = useCallback(async () => {
    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
    }
    if (!user?.privyUserId) {
      throw new Error('User not logged in');
    }

    if (user?.privyUserId) {
      try {
        await Purchases.logIn(user.privyUserId);
      } catch (e) {
        console.error(e);
      }
      try {
        await Purchases.logIn(user.privyUserId);
      } catch (e) {
        console.error(e);
      }
    }
    const appUserId = await Purchases.getAppUserID();
    if (appUserId !== user?.privyUserId) {
      throw new Error('AppUserId not match');
    }
    const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();

    setPrimePersistAtom(
      (prev): IPrimeUserInfo =>
        perfUtils.buildNewValueIfChanged(prev, {
          ...prev,
          subscriptionManageUrl: customerInfo.managementURL || '',
        }),
    );

    return customerInfo;
  }, [isReady, setPrimePersistAtom, user?.privyUserId]);

  const getApiKey = useCallback(async () => {
    if (process.env.NODE_ENV !== 'production') {
      await Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
      // TODO VPN required
      await Purchases.setProxyURL('https://api.rc-backup.com/');
    }

    let apiKey = '';
    if (platformEnv.isNativeIOS) {
      apiKey = REVENUECAT_API_KEY_APPLE || '';
    }
    if (platformEnv.isNativeAndroid) {
      apiKey = REVENUECAT_API_KEY_GOOGLE || '';
    }
    if (!apiKey) {
      throw new Error('No REVENUECAT api key found');
    }

    return apiKey;
  }, []);

  // TODO move to jotai context
  useEffect(() => {
    void (async () => {
      const apiKey = await getApiKey();

      Purchases.configure({
        apiKey,
        // useAmazon: true
      });
      setIsPaymentReady(true);
    })();
  }, [getApiKey]);

  useEffect(() => {
    void (async () => {
      if (isReady && user?.privyUserId) {
        await getCustomerInfo();
      }
    })();
  }, [getCustomerInfo, isReady, user?.privyUserId]);

  const getPackagesNative = useCallback(async () => {
    if (!isReady) {
      throw new Error('PrimeAuth native not ready, please try again later');
    }
    const offerings = await Purchases.getOfferings();
    const packages: IPackage[] = [];

    offerings.current?.availablePackages.forEach((p) => {
      const { subscriptionPeriod, pricePerMonthString, pricePerYearString } =
        p.product;

      packages.push({
        subscriptionPeriod: subscriptionPeriod as ISubscriptionPeriod,
        pricePerMonthString,
        pricePerYearString,
      });
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
          throw new Error('PrimeAuth native not ready!');
        }

        const offerings = await Purchases.getOfferings();

        const offering = offerings.current?.availablePackages.find(
          (p) => p.product.subscriptionPeriod === subscriptionPeriod,
        );

        if (!offering) {
          throw new Error('Offering not found');
        }

        const makePurchaseResult = await Purchases.purchasePackage(offering);

        return makePurchaseResult;
      } catch (error) {
        errorToastUtils.toastIfError(error);
        throw error;
      }
    },
    [isReady],
  );

  return {
    isReady,
    getPackagesNative,
    purchasePackageNative,
    getPackagesWeb: undefined,
    purchasePackageWeb: undefined,
    getCustomerInfo,
  };
}
