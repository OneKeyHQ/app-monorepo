import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePrimePayment } from './usePrimePayment';
import { usePrimePaymentMethodsWeb } from './usePrimePaymentMethodsWeb';

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

      const pkgList = await getPackagesWebFallback?.();
      return pkgList ?? [];
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
