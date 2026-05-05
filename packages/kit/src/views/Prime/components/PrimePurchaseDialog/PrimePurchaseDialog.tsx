import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Dialog,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { usePrimePayment } from '../../hooks/usePrimePayment';

import { PrimeSubscriptionPlans } from './PrimeSubscriptionPlans';
import { usePurchasePackageWebview } from './usePurchasePackageWebview';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';

export function usePrimePurchaseCallback({
  onPurchase,
}: {
  onPurchase?: () => void;
} = {}) {
  const { purchasePackageNative, purchasePackageWeb } = usePrimePayment();
  const { supabaseUser } = useOneKeyAuth();
  const intl = useIntl();

  const purchaseByWebview = usePurchasePackageWebview();

  const purchaseByNative = useCallback(
    async ({
      selectedSubscriptionPeriod,
      featureName,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      featureName?: EPrimeFeatures;
    }) => {
      try {
        const result = await purchasePackageNative?.({
          subscriptionPeriod: selectedSubscriptionPeriod,
          featureName,
        });
        console.log('purchasePackageNative result >>>>>>', result);
      } finally {
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      }
    },
    [purchasePackageNative],
  );

  // TODO move to jotai context method
  const purchase = useCallback(
    async ({
      selectedSubscriptionPeriod,
      currency,
      featureName,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
      currency?: string;
      featureName?: EPrimeFeatures;
    }) => {
      try {
        onPurchase?.();

        if (platformEnv.isNativeIOS || platformEnv.isNativeAndroidGooglePlay) {
          void purchaseByNative({
            selectedSubscriptionPeriod,
            featureName,
          });
          return;
        }

        if (platformEnv.isNativeAndroid) {
          const isGooglePlayServiceAvailable =
            await googlePlayService.isAvailable();
          if (isGooglePlayServiceAvailable) {
            ActionList.show({
              title: intl.formatMessage({
                id: ETranslations.prime_subscribe,
              }),
              onClose: () => {},
              sections: [
                {
                  items: [
                    {
                      label: 'Purchase by GooglePlay',
                      onPress: () => {
                        void purchaseByNative({
                          selectedSubscriptionPeriod,
                          featureName,
                        });
                      },
                    },
                    {
                      label: 'Purchase by Webview',
                      onPress: () => {
                        void purchaseByWebview({
                          selectedSubscriptionPeriod,
                          currency,
                          featureName,
                        });
                      },
                    },
                  ],
                },
              ],
            });
          } else {
            void purchaseByWebview({
              selectedSubscriptionPeriod,
              currency,
              featureName,
            });
          }
          return;
        }

        if (selectedSubscriptionPeriod) {
          await purchasePackageWeb?.({
            subscriptionPeriod: selectedSubscriptionPeriod,
            email: supabaseUser?.email || '',
            locale: intl.locale,
            currency,
            featureName,
          });
          // await backgroundApiProxy.servicePrime.initRevenuecatPurchases({
          //   onekeyUserId: user.onekeyUserId || '',
          // });
          // await backgroundApiProxy.servicePrime.purchasePaywallPackage({
          //   packageId: selectedPackageId,
          //   email: user?.email || '',
          // });
        }
      } finally {
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      }
    },
    [
      onPurchase,
      purchaseByNative,
      intl,
      purchaseByWebview,
      purchasePackageWeb,
      supabaseUser,
    ],
  );

  return {
    purchase,
    purchaseByNative,
    purchaseByWebview,
  };
}

export const PrimePurchaseDialog = (props: {
  onPurchase: () => void;
  featureName?: EPrimeFeatures;
}) => {
  const { onPurchase, featureName } = props;
  const intl = useIntl();
  const [selectedSubscriptionPeriod, setSelectedSubscriptionPeriod] =
    useState<ISubscriptionPeriod>('P1Y');

  const { getPackagesNative, getPackagesWeb } = usePrimePayment();

  const { result: packages } = usePromiseResult(
    async () =>
      platformEnv.isNative ? getPackagesNative?.() : getPackagesWeb?.(),
    [getPackagesNative, getPackagesWeb],
  );

  const { purchase } = usePrimePurchaseCallback({
    onPurchase,
  });
  return (
    <Stack mt="$8">
      {packages ? (
        <PrimeSubscriptionPlans
          packages={packages}
          selectedSubscriptionPeriod={selectedSubscriptionPeriod}
          onSubscriptionPeriodSelected={setSelectedSubscriptionPeriod}
        />
      ) : (
        <YStack gap="$2.5">
          <Skeleton width="100%" height={100} />
          <Skeleton width="100%" height={100} />
        </YStack>
      )}

      <Dialog.Footer
        showCancelButton={false}
        onConfirmText={intl.formatMessage({
          id: ETranslations.prime_subscribe,
        })}
        confirmButtonProps={{
          disabled: !packages,
        }}
        onConfirm={() => {
          const currency = packages?.find(
            (p) => p.subscriptionPeriod === selectedSubscriptionPeriod,
          )?.currencyCode;
          return purchase({
            selectedSubscriptionPeriod,
            currency,
            featureName,
          });
        }}
      />
    </Stack>
  );
};

export default PrimePurchaseDialog;
