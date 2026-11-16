import { useCallback, useMemo } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  isPrimeCryptoPaymentSupported,
  isPrimeStorePayment,
} from '@onekeyhq/shared/src/prime/primePaymentCapabilities';
import { getPrimePurchaseErrorAnalytics } from '@onekeyhq/shared/src/utils/primePurchaseErrorAnalytics';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  getPrimePackagesFailureKind,
  getPrimeStorefrontCountryCode,
  isPrimeTransientPackagesFailure,
} from './primePackagesFetchFailure';
import { getPrimeSimulatedPackagesFault } from './primePackagesFetchFault';
import { usePrimePayment } from './usePrimePayment';
import { usePrimePaymentMethodsWeb } from './usePrimePaymentMethodsWeb';

import type { IPrimePackagesFetchFailure } from './primePackagesFetchFailure';
import type { IPackage } from './usePrimePaymentTypes';

const EMPTY_OFFERING_MESSAGE = 'Prime subscription packages unavailable';
const TRANSIENT_RETRY_DELAY_MS = 1000;

const EMPTY_SDK_RESULT: {
  packages: IPackage[];
  failure?: IPrimePackagesFetchFailure;
} = { packages: [] };

function classifyPackagesError(error: unknown) {
  const errorAnalytics = getPrimePurchaseErrorAnalytics(error);
  const failureKind = getPrimePackagesFailureKind({
    ...errorAnalytics,
    isEmptyOffering:
      (error as IOneKeyError | undefined)?.message === EMPTY_OFFERING_MESSAGE,
  });
  return { errorAnalytics, failureKind };
}

export function usePrimeSubscriptionPackages({
  enabled,
}: {
  enabled: boolean;
}) {
  const {
    isReady: isPurchaseReady,
    initializationError,
    getPackagesNative,
    getStorefront,
    restorePurchases,
    getPackagesWeb,
  } = usePrimePayment();
  const { getPackagesWeb: getPackagesWebFallback } =
    usePrimePaymentMethodsWeb();

  const { result: webPackages, run: reloadWebPackages } = usePromiseResult(
    async () => {
      // Card prices are only a fallback where card checkout is offered (APK).
      // Play builds are store-only and must not show prices they cannot sell.
      if (
        !enabled ||
        !isPurchaseReady ||
        !platformEnv.isNativeAndroid ||
        !isPrimeCryptoPaymentSupported()
      ) {
        return [];
      }

      const pkgList = await getPackagesWebFallback?.();
      return pkgList ?? [];
    },
    [enabled, getPackagesWebFallback, isPurchaseReady],
    {
      initResult: [],
    },
  );

  const {
    result: sdkResult,
    isLoading: isPackagesLoading,
    run: reloadSdkPackages,
  } = usePromiseResult(
    async () => {
      if (!enabled || !isPurchaseReady) {
        return EMPTY_SDK_RESULT;
      }

      return errorToastUtils.withErrorAutoToast(async () => {
        const simulatedFault = await getPrimeSimulatedPackagesFault();
        const loadOnce = async () => {
          if (simulatedFault?.error) {
            throw simulatedFault.error;
          }
          const pkgList = simulatedFault
            ? []
            : await (isPrimeStorePayment()
                ? getPackagesNative?.()
                : getPackagesWeb?.());
          // An empty list blocks purchase as much as an error does.
          if (!pkgList?.length) {
            throw new OneKeyLocalError(EMPTY_OFFERING_MESSAGE);
          }
          return pkgList;
        };
        const isInitializationError = (error: unknown) =>
          Boolean(initializationError && error === initializationError);

        let error: unknown;
        try {
          return { packages: await loadOnce() };
        } catch (firstError) {
          error = firstError;
        }
        let { errorAnalytics, failureKind } = classifyPackagesError(error);
        // Play Billing documents SERVICE_UNAVAILABLE, SERVICE_DISCONNECTED and
        // NETWORK_ERROR as transient and asks apps to retry them; RevenueCat
        // maps those to codes 2 and 10. Retry once silently.
        if (
          !isInitializationError(error) &&
          isPrimeTransientPackagesFailure(failureKind)
        ) {
          await timerUtils.wait(TRANSIENT_RETRY_DELAY_MS);
          try {
            return { packages: await loadOnce() };
          } catch (retryError) {
            error = retryError;
            ({ errorAnalytics, failureKind } = classifyPackagesError(error));
          }
        }

        // Initialization failures need a newer native shell, not Storefront.
        const storefrontCountryCode = isInitializationError(error)
          ? undefined
          : (simulatedFault?.storefrontCountryCode ??
            (await getPrimeStorefrontCountryCode(getStorefront)));

        defaultLogger.prime.subscription.fetchPackagesFailed({
          errorMessage:
            (error as IOneKeyError | undefined)?.message || 'Unknown error',
          ...errorAnalytics,
          failureKind,
          storefrontCountryCode,
        });

        if (initializationError && isInitializationError(error)) {
          // Keep the actionable update message outside the fail state.
          throw initializationError;
        }
        return {
          packages: [],
          failure: { kind: failureKind, storefrontCountryCode },
        };
      });
    },
    [
      enabled,
      getPackagesNative,
      getPackagesWeb,
      getStorefront,
      isPurchaseReady,
      initializationError,
    ],
    {
      initResult: EMPTY_SDK_RESULT,
      watchLoading: true,
    },
  );

  const sdkPackages = sdkResult?.packages;
  const packages = useMemo(() => {
    if (sdkPackages?.length) {
      return sdkPackages;
    }
    return webPackages || [];
  }, [sdkPackages, webPackages]);

  // Android APKs fall back to card prices; only an empty list blocks purchase.
  const packagesFailure =
    enabled && !isPackagesLoading && !packages.length
      ? sdkResult?.failure
      : undefined;

  const reloadPackages = useCallback(async () => {
    await Promise.all([reloadSdkPackages(), reloadWebPackages()]);
  }, [reloadSdkPackages, reloadWebPackages]);

  return {
    packages,
    isPackagesLoading,
    isPurchaseReady,
    restorePurchases,
    packagesFailure,
    reloadPackages,
  };
}
