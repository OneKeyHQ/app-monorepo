import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IRevenueCatPackage } from '@onekeyhq/shared/types/prime/revenueCat';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { IPrimeStorePurchasesSdk } from './storePurchasesSdkTypes';
import type { IntlShape } from 'react-intl';

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

export function createDesktopStorePurchasesSdk(
  intl: Pick<IntlShape, 'formatMessage'>,
): IPrimeStorePurchasesSdk<IRevenueCatPackage> {
  return {
    configure: async ({ apiKey }) => {
      const api = globalThis.desktopApiProxy?.inAppPurchase;
      let isAvailable = false;
      try {
        isAvailable = Boolean(
          await api?.revenueCatSupportsVerifiedIdentity?.(),
        );
      } catch {
        // An older Electron shell does not implement this IPC method.
      }
      if (!isAvailable) {
        throw new OneKeyLocalError(
          intl.formatMessage({
            id: ETranslations.global_update_to_continue_desc_fallback,
          }),
        );
      }
      await api.revenueCatConfigure({ apiKey });
    },
    logIn: (expectedAppUserId) =>
      withRevenueCatError(async () => {
        // Refresh the persisted session before main reads it independently.
        await backgroundApiProxy.simpleDb.prime.getActiveAuthToken();
        const sessionSource =
          await backgroundApiProxy.simpleDb.prime.getAuthSessionSource();
        if (!sessionSource) {
          throw new OneKeyLocalError(
            intl.formatMessage({
              id: ETranslations.prime_onekey_id_session_changed__msg,
            }),
          );
        }
        const [devSettings, instanceId] = await Promise.all([
          backgroundApiProxy.serviceDevSetting.getDevSetting(),
          backgroundApiProxy.serviceSetting.getInstanceId(),
        ]);
        await globalThis.desktopApiProxy.inAppPurchase.revenueCatLogInWithVerifiedSession(
          {
            expectedAppUserId,
            authContext: {
              sessionSource,
              endpointEnv:
                devSettings.enabled && devSettings.settings?.enableTestEndpoint
                  ? 'test'
                  : 'prod',
              instanceId,
            },
          },
        );
      }),
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
        throw new OneKeyLocalError(
          intl.formatMessage({
            id: ETranslations.prime_payment_start_failed__msg,
          }),
        );
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
}
