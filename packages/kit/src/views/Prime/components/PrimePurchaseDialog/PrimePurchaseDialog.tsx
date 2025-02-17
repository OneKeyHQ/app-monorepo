import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Dialog,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useFetchPrimeUserInfo } from '../../hooks/useFetchPrimeUserInfo';
import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';

import { PrimeSubscriptionPlans } from './PrimeSubscriptionPlans';
import { usePurchasePackageWebview } from './usePurchasePackageWebview';

import type { IPackageId } from '../../hooks/usePrimePaymentTypes';

export const PrimePurchaseDialog = (props: { onPurchase: () => void }) => {
  const { onPurchase } = props;
  const intl = useIntl();
  const { fetchPrimeUserInfo } = useFetchPrimeUserInfo();
  const { user } = usePrimeAuthV2();
  const [selectedPackageId, setSelectedPackageId] = useState<IPackageId>('P1Y');

  const {
    purchasePackageNative,
    getPackagesNative,
    purchasePackageWeb,
    getPackagesWeb,
  } = usePrimePayment();

  const purchasePackageWebview = usePurchasePackageWebview({
    selectedPackageId,
  });

  // TODO move to jotai context method
  const purchase = useCallback(async () => {
    try {
      onPurchase?.();

      if (platformEnv.isNativeIOS || platformEnv.isNativeAndroidGooglePlay) {
        void purchasePackageNative?.({
          packageId: selectedPackageId,
        });
      }

      if (platformEnv.isNativeAndroid) {
        ActionList.show({
          title: intl.formatMessage({
            id: ETranslations.prime_subscribe,
          }),
          onClose: () => {},
          sections: [
            {
              items: [
                {
                  label: 'Purchase by AppStore/GooglePlay',
                  onPress: () => {
                    void purchasePackageNative?.({
                      packageId: selectedPackageId,
                    });
                  },
                },
                {
                  label: 'Purchase by Webview',
                  onPress: () => {
                    void purchasePackageWebview();
                  },
                },
              ],
            },
          ],
        });
        return;
      }

      if (selectedPackageId) {
        await purchasePackageWeb?.({
          packageId: selectedPackageId,
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
      await fetchPrimeUserInfo();
    }
  }, [
    fetchPrimeUserInfo,
    intl.locale,
    onPurchase,
    purchasePackageNative,
    purchasePackageWeb,
    purchasePackageWebview,
    selectedPackageId,
    user?.email,
  ]);

  const { result: packages } = usePromiseResult(
    async () =>
      platformEnv.isNative ? getPackagesNative?.() : getPackagesWeb?.(),
    [getPackagesNative, getPackagesWeb],
  );

  return (
    <Stack mt="$8">
      {packages ? (
        <PrimeSubscriptionPlans
          packages={packages}
          onPackageSelected={setSelectedPackageId}
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
        onConfirm={purchase}
      />
    </Stack>
  );
};

export default PrimePurchaseDialog;
