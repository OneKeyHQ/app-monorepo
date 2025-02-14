import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Dialog,
  Skeleton,
  Stack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useFetchPrimeUserInfo } from '../../hooks/useFetchPrimeUserInfo';
import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';

import { PrimeSubscriptionPlans } from './PrimeSubscriptionPlans';

export const PrimePurchaseDialog = (props: { onPurchase: () => void }) => {
  const { onPurchase } = props;
  const intl = useIntl();
  const { fetchPrimeUserInfo } = useFetchPrimeUserInfo();
  const { user } = usePrimeAuthV2();
  const navigation = useAppNavigation();
  const [selectedPackageId, setSelectedPackageId] = useState<
    string | undefined
  >();

  const {
    presentPaywallNative,
    purchasePaywallPackageWeb,
    getPrimeSubscriptionPlanWeb,
  } = usePrimePayment();

  const purchaseByWebview = useCallback(async () => {
    navigation.popStack();
    await timerUtils.wait(1000);
    openUrlUtils.openUrlByWebviewPro({
      url: '',
      title: 'WebView',
      isWebEmbed: true,
      hashRoutePath: EWebEmbedRoutePath.primePurchase,
      hashRouteQueryParams: {
        primeUserId: user?.privyUserId || '',
        primeUserEmail: user?.email || '',
      },
    });
  }, [navigation, user?.privyUserId, user?.email]);

  // TODO move to jotai context method
  const purchase = useCallback(async () => {
    try {
      setTimeout(() => {
        onPurchase?.();
      }, 1000);

      if (platformEnv.isNativeIOS) {
        void presentPaywallNative?.();
      }

      if (platformEnv.isNativeAndroid) {
        ActionList.show({
          title: 'Purchase',
          onClose: () => {},
          sections: [
            {
              items: [
                {
                  label: 'Purchase by AppStore/GooglePlay',
                  onPress: () => {
                    void presentPaywallNative?.();
                  },
                },
                {
                  label: 'Purchase by Webview',
                  onPress: () => {
                    void purchaseByWebview();
                  },
                },
              ],
            },
          ],
        });
        return;
      }

      if (selectedPackageId) {
        await purchasePaywallPackageWeb?.({
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
    presentPaywallNative,
    purchaseByWebview,
    purchasePaywallPackageWeb,
    selectedPackageId,
    user?.email,
  ]);

  const { result: packages } = usePromiseResult(async () => {
    if (!platformEnv.isNative) {
      return getPrimeSubscriptionPlanWeb?.();
    }

    return [];
  }, [getPrimeSubscriptionPlanWeb]);

  console.log('packages >>>>>> ', packages);

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
        onConfirm={purchase}
      />
    </Stack>
  );
};

export default PrimePurchaseDialog;
