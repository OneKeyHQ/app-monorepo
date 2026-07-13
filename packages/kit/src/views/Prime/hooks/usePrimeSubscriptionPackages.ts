import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { usePrimePayment } from './usePrimePayment';
import { usePrimePaymentMethodsWeb } from './usePrimePaymentMethodsWeb';

type IRandomUUID = typeof globalThis.crypto.randomUUID;

let temporaryRandomUUIDUsageCount = 0;
let temporaryRandomUUIDOriginal: IRandomUUID | undefined;
let temporaryRandomUUID: IRandomUUID | undefined;

async function withTemporaryRandomUUID<T>(fn: () => Promise<T>): Promise<T> {
  const crypto = globalThis.crypto;
  if (!crypto || !platformEnv.isNativeAndroid) {
    return fn();
  }

  const currentRandomUUID = Reflect.get(crypto, 'randomUUID') as
    | IRandomUUID
    | undefined;
  const shouldUseTemporaryRandomUUID =
    !currentRandomUUID || currentRandomUUID === temporaryRandomUUID;

  if (!shouldUseTemporaryRandomUUID) {
    return fn();
  }

  if (temporaryRandomUUIDUsageCount === 0) {
    temporaryRandomUUIDOriginal = currentRandomUUID;
    temporaryRandomUUID = () => {
      return stringUtils.generateUUID() as `${string}-${string}-${string}-${string}-${string}`;
    };
    Reflect.set(crypto, 'randomUUID', temporaryRandomUUID);
  }

  temporaryRandomUUIDUsageCount += 1;
  try {
    return await fn();
  } finally {
    temporaryRandomUUIDUsageCount = Math.max(
      0,
      temporaryRandomUUIDUsageCount - 1,
    );
    if (temporaryRandomUUIDUsageCount === 0) {
      if (Reflect.get(crypto, 'randomUUID') === temporaryRandomUUID) {
        Reflect.set(crypto, 'randomUUID', temporaryRandomUUIDOriginal);
      }
      temporaryRandomUUIDOriginal = undefined;
      temporaryRandomUUID = undefined;
    }
  }
}

export function usePrimeSubscriptionPackages({
  enabled,
}: {
  enabled: boolean;
}) {
  const intl = useIntl();
  const {
    isReady: isPurchaseReady,
    getPackagesNative,
    restorePurchases,
    getPackagesWeb,
  } = usePrimePayment();
  const { getPackagesWeb: getPackagesWebFallback } =
    usePrimePaymentMethodsWeb();

  const { result: webPackages } = usePromiseResult(
    async () => {
      if (!enabled || !isPurchaseReady || !platformEnv.isNativeAndroid) {
        return [];
      }

      return withTemporaryRandomUUID(async () => {
        const pkgList = await getPackagesWebFallback?.();
        return pkgList ?? [];
      });
    },
    [enabled, getPackagesWebFallback, isPurchaseReady],
    {
      initResult: [],
    },
  );

  const { result: sdkPackages, isLoading: isPackagesLoading } =
    usePromiseResult(
      async () => {
        if (!enabled || !isPurchaseReady) {
          return [];
        }

        // TODO There was a problem with the store.
        return errorToastUtils.withErrorAutoToast(async () => {
          try {
            const pkgList = await (platformEnv.isNative
              ? getPackagesNative?.()
              : getPackagesWeb?.());
            return pkgList ?? [];
          } catch (error) {
            const e = error as IOneKeyError | undefined;

            defaultLogger.prime.subscription.fetchPackagesFailed({
              errorMessage: e?.message || 'Unknown error',
            });

            let shouldThrow = true;
            if (
              platformEnv.isNativeAndroid &&
              e &&
              e?.code === ('3' as unknown as number) &&
              e?.message ===
                'The device or user is not allowed to make the purchase.'
            ) {
              // SDK errors:
              // - There was a problem with the store. (maybe network issue, or not login GooglePlayStore\AppStore)
              // - The device or user is not allowed to make the purchase.
              //    (GooglePlay Service not available on this device, so we should not throw error)
              shouldThrow = false;
            }
            /*
            None of the products registered in the RevenueCat dashboard could be fetched
            There's a problem with your configuration. None of the products registered in the RevenueCat dashboard could be fetched from the [Play Store/App Store].
            */
            if (
              e?.message?.includes(
                'None of the products registered in the RevenueCat dashboard could be fetched',
              )
            ) {
              Dialog.confirm({
                title: intl.formatMessage({
                  id: ETranslations.global_an_error_occurred,
                }),
                description: intl.formatMessage({
                  id: platformEnv.isNativeAndroid
                    ? ETranslations.prime_unable_to_retrieve_subscription_list_google_play
                    : ETranslations.prime_unable_to_retrieve_subscription_list,
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_got_it,
                }),
              });
              shouldThrow = false;
            }
            if (shouldThrow) {
              throw error;
            }
            return [];
          }
        });
      },
      [enabled, intl, getPackagesNative, getPackagesWeb, isPurchaseReady],
      {
        initResult: [],
        watchLoading: true,
      },
    );

  const packages = useMemo(() => {
    if (sdkPackages?.length) {
      return sdkPackages;
    }
    return webPackages || [];
  }, [sdkPackages, webPackages]);

  return {
    packages,
    isPackagesLoading,
    isPurchaseReady,
    restorePurchases,
  };
}
