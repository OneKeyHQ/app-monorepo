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

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

import type { IUsePrimePayment } from './usePrimePaymentTypes';
import type {
  CustomerInfo,
  PurchasesPackage,
} from '@revenuecat/purchases-typescript-internal';

export function usePrimePayment(): IUsePrimePayment {
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const { isReady: isAuthReady, user } = usePrivyUniversalV2();

  const [, setPrimePersistAtom] = usePrimePersistAtom();

  const isReady = isPaymentReady && isAuthReady;

  const getCustomerInfo = useCallback(async () => {
    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
    }
    if (!user?.id) {
      throw new Error('User not logged in');
    }
    // Do not logout which will create anonymous user
    // try {
    //   await Purchases.logOut();
    // } catch (e) {
    //   console.error(e);
    // }
    if (user?.id) {
      try {
        await Purchases.logIn(user.id);
      } catch (e) {
        console.error(e);
      }
      try {
        await Purchases.logIn(user.id);
      } catch (e) {
        console.error(e);
      }
    }
    const appUserId = await Purchases.getAppUserID();
    if (appUserId !== user?.id) {
      throw new Error('AppUserId not match');
    }
    const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
    console.log(
      'customerInfo >>>>> ',
      appUserId,
      JSON.stringify(customerInfo, null, 2),
    );
    setPrimePersistAtom((prev) =>
      perfUtils.buildNewValueIfChanged(prev, {
        ...prev,
        subscriptionManageUrl: customerInfo.managementURL || '',
      }),
    );

    return customerInfo;
  }, [isReady, setPrimePersistAtom, user?.id]);

  // TODO move to jotai context
  useEffect(() => {
    void (async () => {
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
      Purchases.configure({
        apiKey,
        // useAmazon: true
      });
      setIsPaymentReady(true);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      if (isReady && user?.id) {
        await getCustomerInfo();
      }
    })();
  }, [getCustomerInfo, isReady, user?.id]);

  const getPaywallPackagesNative = useCallback(async () => {
    if (!isReady) {
      throw new Error('PrimeAuth native not ready, please try again later');
    }
    const offerings = await Purchases.getOfferings();
    const packages: PurchasesPackage[] = [];
    Object.values(offerings.all).forEach((offering) => {
      packages.push(...offering.availablePackages);
    });
    packages.sort((a) => {
      // Yearly is the first
      if (a.presentedOfferingContext.offeringIdentifier === 'Yearly') {
        return -1;
      }
      return 1;
    });
    return {
      packages,
    };
  }, [isReady]);

  // https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls#react-native
  const presentPaywallNative = useCallback(async () => {
    try {
      console.log('presentPaywallNative >>>>> ');
      if (!isReady) {
        throw new Error('PrimeAuth native not ready!!!');
      }

      if (platformEnv.isNativeAndroid) {
        // if (platformEnv.isNativeAndroidGooglePlay) {
        //   // TODO VPN required or device not support google play service
        //   if (!(await googlePlayService.isAvailable())) {
        //     throw new Error(
        //       'Google Play Service is not available on this device',
        //     );
        //   }
        // } else {
        //   throw new Error('Android web purchase not supported yet');
        // }
      }

      // const { packages } = await getPaywallPackagesNative();
      // console.log(
      //   'getPaywallPackagesNative: packages >>>>> ',
      //   JSON.stringify(packages, null, 2),
      // );

      const offerings = await Purchases.getOfferings();
      console.log('offerings >>>>> ', JSON.stringify(offerings, null, 2));

      const { customerInfo } = await Purchases.purchasePackage(
        offerings.all.Yearly.availablePackages[0],
      );

      console.log('customerInfo >>>>> ', JSON.stringify(customerInfo, null, 2));

      return true;
    } catch (error) {
      errorToastUtils.toastIfError(error);
      throw error;
    }
  }, [isReady]);

  return {
    isReady,
    presentPaywallNative,
    getPaywallPackagesNative,
    getPaywallPackagesWeb: undefined,
    purchasePaywallPackageWeb: undefined,
    getCustomerInfo,
  };
}
