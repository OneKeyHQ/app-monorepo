import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IRevenueCatPackage } from '@onekeyhq/shared/types/prime/revenueCat';

import type { IPrimeStorePurchasesSdk } from './storePurchasesSdkTypes';

async function withRevenueCatError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const nativeError = error as {
      data?: { revenueCat?: boolean; userCancelled?: boolean };
    } | null;
    if (nativeError?.data?.revenueCat && error instanceof Error) {
      Object.assign(error, {
        userCancelled: nativeError.data.userCancelled === true,
      });
    }
    throw error;
  }
}

export const desktopStorePurchasesSdk: IPrimeStorePurchasesSdk<IRevenueCatPackage> =
  {
    configure: async ({ apiKey }) => {
      const api = globalThis.desktopApiProxy?.inAppPurchase;
      let isAvailable = false;
      try {
        isAvailable = Boolean(await api?.revenueCatIsAvailable?.());
      } catch {
        // An older Electron shell does not implement this IPC method.
      }
      if (!isAvailable) {
        throw new OneKeyLocalError(
          'App Store purchases are unavailable in this application build',
        );
      }
      await api.revenueCatConfigure({ apiKey });
    },
    logIn: (appUserId) =>
      globalThis.desktopApiProxy.inAppPurchase.revenueCatLogIn({ appUserId }),
    getAppUserID: () =>
      globalThis.desktopApiProxy.inAppPurchase.revenueCatGetAppUserId(),
    getCustomerInfo: (expectedAppUserId) =>
      globalThis.desktopApiProxy.inAppPurchase.revenueCatGetCustomerInfo({
        expectedAppUserId,
      }),
    getOfferings: () =>
      globalThis.desktopApiProxy.inAppPurchase.revenueCatGetOfferings(),
    purchasePackage: (offering, expectedAppUserId) => {
      const offeringIdentifier =
        offering.presentedOfferingContext?.offeringIdentifier;
      if (!offeringIdentifier) {
        throw new OneKeyLocalError('Offering identifier is missing');
      }
      return withRevenueCatError(() =>
        globalThis.desktopApiProxy.inAppPurchase.revenueCatPurchasePackage({
          packageIdentifier: offering.identifier,
          offeringIdentifier,
          expectedAppUserId,
        }),
      );
    },
    restorePurchases: (expectedAppUserId) =>
      withRevenueCatError(() =>
        globalThis.desktopApiProxy.inAppPurchase.revenueCatRestorePurchases({
          expectedAppUserId,
        }),
      ),
    setMixpanelDistinctID: (instanceId, expectedAppUserId) =>
      globalThis.desktopApiProxy.inAppPurchase.revenueCatSetAttributes({
        attributes: { '$mixpanelDistinctId': instanceId },
        expectedAppUserId,
      }),
    setAttributes: (attributes, expectedAppUserId) =>
      globalThis.desktopApiProxy.inAppPurchase.revenueCatSetAttributes({
        attributes,
        expectedAppUserId,
      }),
    getIntroEligibleProductIds: async (packages) => {
      const productIdentifiers = packages.map(
        ({ product }) => product.identifier,
      );
      if (!productIdentifiers.length) {
        return new Set<string>();
      }
      try {
        const eligibility =
          await globalThis.desktopApiProxy.inAppPurchase.revenueCatCheckTrialOrIntroductoryPriceEligibility(
            { productIdentifiers },
          );
        return new Set(
          // RevenueCat's hybrid bridge uses 2 for eligible on Apple platforms.
          productIdentifiers.filter((id) => eligibility[id]?.status === 2),
        );
      } catch {
        return new Set<string>();
      }
    },
    getRecurringPriceUnit: () => 'major',
  };
