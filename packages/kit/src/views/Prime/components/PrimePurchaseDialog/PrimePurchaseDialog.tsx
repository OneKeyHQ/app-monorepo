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
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';

import { PrimeSubscriptionPlans } from './PrimeSubscriptionPlans';
import { usePurchasePackageWebview } from './usePurchasePackageWebview';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';

export function usePrimePurchaseCallback({
  onPurchase,
}: {
  onPurchase?: () => void;
} = {}) {
  const {
    purchasePackageNative,
    getPackagesNative,
    purchasePackageWeb,
    getPackagesWeb,
  } = usePrimePayment();
  const { user } = usePrimeAuthV2();
  const intl = useIntl();

  const purchaseByWebview = usePurchasePackageWebview();

  const purchaseByNative = useCallback(
    async ({
      selectedSubscriptionPeriod,
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
    }) => {
      try {
        const result = await purchasePackageNative?.({
          subscriptionPeriod: selectedSubscriptionPeriod,
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
    }: {
      selectedSubscriptionPeriod: ISubscriptionPeriod;
    }) => {
      try {
        onPurchase?.();

        if (platformEnv.isNativeIOS || platformEnv.isNativeAndroidGooglePlay) {
          void purchaseByNative({
            selectedSubscriptionPeriod,
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
                        });
                      },
                    },
                    {
                      label: 'Purchase by Webview',
                      onPress: () => {
                        void purchaseByWebview({
                          selectedSubscriptionPeriod,
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
            });
          }
          return;
        }

        if (selectedSubscriptionPeriod) {
          await purchasePackageWeb?.({
            subscriptionPeriod: selectedSubscriptionPeriod,
            email: user?.email || '',
            locale: intl.locale,
          });
          // await backgroundApiProxy.servicePrime.initRevenuecatPurchases({
          //   privyUserId: user.privyUserId || '',
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
      purchaseByNative,
      intl,
      onPurchase,
      purchasePackageWeb,
      purchaseByWebview,
      user?.email,
    ],
  );

  return {
    purchase,
    purchaseByNative,
    purchaseByWebview,
  };
}

export const PrimePurchaseDialog = (props: { onPurchase: () => void }) => {
  const { onPurchase } = props;
  const intl = useIntl();
  const { user } = usePrimeAuthV2();
  const [selectedSubscriptionPeriod, setSelectedSubscriptionPeriod] =
    useState<ISubscriptionPeriod>('P1Y');

  const {
    purchasePackageNative,
    getPackagesNative,
    purchasePackageWeb,
    getPackagesWeb,
  } = usePrimePayment();

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
          return purchase({
            selectedSubscriptionPeriod,
          });
        }}
      />
    </Stack>
  );
};

export default PrimePurchaseDialog;
