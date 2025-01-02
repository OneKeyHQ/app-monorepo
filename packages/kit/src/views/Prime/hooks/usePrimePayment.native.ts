import { useCallback, useEffect, useState } from 'react';

import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';

import { usePrimeAuth } from './usePrimeAuth';

import type { IUsePrimePayment } from './usePrimePaymentTypes';
import type { PurchasesPackage } from '@revenuecat/purchases-typescript-internal';
import type { PAYWALL_RESULT } from 'react-native-purchases-ui';

export function usePrimePayment(): IUsePrimePayment {
  const [isPaymentReady, setIsPaymentReady] = useState(false);
  const { isReady: isAuthReady, user } = usePrimeAuth();
  const [primePersistAtom, setPrimePersistAtom] = usePrimePersistAtom();

  const isReady = isPaymentReady && isAuthReady;

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
        apiKey = process.env.REVENUECAT_API_KEY_APPLE || '';
      }
      if (platformEnv.isNativeAndroid) {
        apiKey = process.env.REVENUECAT_API_KEY_GOOGLE || '';
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
      if (isReady && user?.privyUserId) {
        try {
          await Purchases.logOut();
        } catch (e) {
          console.error(e);
        }
        if (user?.privyUserId) {
          await Purchases.logIn(user.privyUserId);
        }
        const customerInfo = await Purchases.getCustomerInfo();
        if (customerInfo.managementURL) {
          setPrimePersistAtom((prev) =>
            perfUtils.buildNewValueIfChanged(prev, {
              ...prev,
              subscriptionManageUrl: customerInfo.managementURL || '',
            }),
          );
        }
      }
    })();
  }, [isReady, user?.privyUserId, setPrimePersistAtom]);

  const getPaywallPackagesNative = useCallback(async () => {
    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
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
    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
    }
    const offerings = await Purchases.getOfferings();
    const customerInfo = await Purchases.getCustomerInfo();
    const offeringYearly = offerings.all.Yearly;
    const offeringMonthly = offerings.all.Monthly;

    console.log('offerings >>>>> ', JSON.stringify(offerings, null, 2));
    console.log('customerInfo >>>>> ', JSON.stringify(customerInfo, null, 2));

    // const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall({
    //   // offering: offeringYearly,
    //   offering: offeringMonthly,
    //   // offering: offering // Optional Offering object obtained through getOfferings
    // });

    const paywallResult: PAYWALL_RESULT =
      await RevenueCatUI.presentPaywallIfNeeded({
        // offering: offering, // Optional Offering object obtained through getOfferings
        requiredEntitlementIdentifier: 'Prime000',
      });

    console.log('paywallResult >>>>> ', JSON.stringify(paywallResult, null, 2));

    return paywallResult;
  }, [isReady]);

  return {
    isReady,
    presentPaywallNative,
    getPaywallPackagesNative,
    getPaywallPackagesWeb: undefined,
    purchasePaywallPackageWeb: undefined,
  };
}
