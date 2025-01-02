import { useCallback, useEffect } from 'react';

import { LogLevel, Purchases } from '@revenuecat/purchases-js';

import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';

import { usePrimeAuth } from './usePrimeAuth';

import type { IUsePrimePayment } from './usePrimePaymentTypes';
import type { Package } from '@revenuecat/purchases-js';

export function usePrimePayment(): IUsePrimePayment {
  const { isReady: isAuthReady, user } = usePrimeAuth();
  const [primePersistAtom, setPrimePersistAtom] = usePrimePersistAtom();

  const isReady = isAuthReady;

  useEffect(() => {
    void (async () => {
      if (isReady && user?.privyUserId) {
        if (process.env.NODE_ENV !== 'production') {
          Purchases.setLogLevel(LogLevel.Verbose);
        }
        let apiKey = process.env.REVENUECAT_API_KEY_WEB;
        apiKey = 'rcb_sb_gxqFGxelBplIYJuYPhcnRhjfA';
        if (!apiKey) {
          throw new Error('No REVENUECAT api key found');
        }

        // TODO VPN required
        // await Purchases.setProxyURL('https://api.rc-backup.com/');

        // TODO how to configure another userId when user login with another account
        // https://www.revenuecat.com/docs/customers/user-ids#logging-in-with-a-custom-app-user-id

        Purchases.configure(apiKey, user?.privyUserId || '');

        const customerInfo =
          await Purchases.getSharedInstance().getCustomerInfo();
        console.log('customerInfo >>>>>> ', customerInfo);

        if (customerInfo.managementURL) {
          setPrimePersistAtom((prev) =>
            perfUtils.buildNewValueIfChanged(prev, {
              ...prev,
              subscriptionManageUrl: customerInfo.managementURL || '',
            }),
          );
        }

        if ('gold_entitlement' in customerInfo.entitlements.active) {
          // Grant user access to the entitlement "gold_entitlement"
          // grantEntitlementAccess();
        }
      }
    })();
  }, [isReady, setPrimePersistAtom, user?.privyUserId]);

  const getOfferings = useCallback(async () => {
    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
    }
    const offerings = await Purchases.getSharedInstance().getOfferings({
      currency: 'USD',
    });
    return offerings;
  }, [isReady]);

  const getPaywallPackagesWeb = useCallback(async () => {
    if (!isReady) {
      throw new Error('PrimeAuth Not ready');
    }
    const offerings = await getOfferings();
    const packages: Package[] = [];
    Object.values(offerings.all).forEach((offering) => {
      packages.push(...offering.availablePackages);
    });
    packages.sort((a) => {
      // Yearly is the first
      if (
        a.rcBillingProduct.presentedOfferingContext.offeringIdentifier ===
        'Yearly'
      ) {
        return -1;
      }
      return 1;
    });
    return {
      packages,
    };
  }, [getOfferings, isReady]);

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
      if (!isReady) {
        throw new Error('PrimeAuth Not ready');
      }
      // const offerings = await this.getPaywallOfferings();
      // const paywallPackage = offerings?.all?.monthly?.packagesById?.[packageId];
      const packages = await getPaywallPackagesWeb();
      const paywallPackage = packages.packages.find(
        (p) => p.identifier === packageId,
      );
      if (!paywallPackage) {
        throw new Error('purchasePaywallPackage ERROR: Invalid packageId');
      }
      // TODO check package user is Matched to privyUserId
      // TODO check if user has already purchased
      const purchase = await Purchases.getSharedInstance().purchase({
        rcPackage: paywallPackage,
        customerEmail: email,
        selectedLocale: locale,
      });
      // test credit card
      // https://docs.stripe.com/testing#testing-interactively
      // Mastercard: 5555555555554444
      // visa: 4242424242424242
      console.log('purchase >>>>>> ', purchase);
      return purchase;
    },
    [getPaywallPackagesWeb, isReady],
  );

  return {
    isReady,
    presentPaywallNative: undefined,
    getPaywallPackagesNative: undefined,
    getPaywallPackagesWeb,
    purchasePaywallPackageWeb,
  };
}
