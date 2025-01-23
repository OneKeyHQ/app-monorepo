import { useCallback, useMemo, useState } from 'react';

import { ActionList, Page, SizableText } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useFetchPrimeUserInfo } from '../../hooks/useFetchPrimeUserInfo';
import { usePrimeAuth } from '../../hooks/usePrimeAuth';
import { usePrimePayment } from '../../hooks/usePrimePayment';

export function PrimeDashboardFooter() {
  const { login, loginLegacy, logout, privy, getAccessToken, user } =
    usePrimeAuth();
  const { fetchPrimeUserInfo } = useFetchPrimeUserInfo();
  const navigation = useAppNavigation();
  const [selectedPackageId, setSelectedPackageId] = useState<
    string | undefined
  >();

  const [isLoading, setIsLoading] = useState(false);
  const {
    presentPaywallNative,
    purchasePaywallPackageWeb,
    getPaywallPackagesWeb,
    getPaywallPackagesNative,
    getCustomerInfo,
  } = usePrimePayment();

  const loginByPrivy = useCallback(async () => {
    if (platformEnv.isNative) {
      // TODO: privy login Modal is conflict with OneKey Modal
      // navigation.popStack();
      // await timerUtils.wait(1000);
    }
    login();
  }, [login]);

  const purchaseByWebview = useCallback(async () => {
    navigation.popStack();
    // await timerUtils.wait(1000);
    // purchase by webview
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

  const doPurchase = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!user?.isLoggedIn) {
        return await loginByPrivy();
        // loginLegacy();
      }
      if (platformEnv.isNative) {
        ActionList.show({
          title: 'Purchase',
          onClose: () => {},
          sections: [
            {
              items: [
                {
                  label: 'Purchase by AppStore/GooglePlay',
                  // description: 'Purchase by AppStore/GooglePlay',
                  onPress: () => {
                    void presentPaywallNative?.();
                  },
                },
                {
                  label: 'Purchase by Webview',
                  // description: 'Purchase by Webview',
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
      setIsLoading(false);
      await fetchPrimeUserInfo();
    }
  }, [
    user?.isLoggedIn,
    user?.email,
    selectedPackageId,
    loginByPrivy,
    purchaseByWebview,
    presentPaywallNative,
    purchasePaywallPackageWeb,
    fetchPrimeUserInfo,
  ]);

  const shouldShowConfirmButton = useMemo(() => {
    if (!user?.isLoggedIn) {
      return true;
    }
    if (user?.isLoggedIn && !user?.primeSubscription?.isActive) {
      return true;
    }
    return false;
  }, [user?.isLoggedIn, user?.primeSubscription]);

  return (
    <Page.Footer
      onConfirm={shouldShowConfirmButton ? doPurchase : undefined}
      onConfirmText="Subscribe"
      confirmButtonProps={
        shouldShowConfirmButton
          ? {
              loading: isLoading,
            }
          : undefined
      }
    />
  );
}
