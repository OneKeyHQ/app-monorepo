import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  ActionList,
  Dialog,
  Icon,
  IconButton,
  Page,
  SizableText,
  Stack,
  Theme,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { PrimeLoginEmailDialogV2 } from '../../components/PrimeLoginEmailDialogV2';
import { useFetchPrimeUserInfo } from '../../hooks/useFetchPrimeUserInfo';
import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';

import { PrimeBenefitsList } from './PrimeBenefitsList';
import { PrimeDebugPanel } from './PrimeDebugPanel';
import { PrimeLottieAnimation } from './PrimeLottieAnimation';
import { PrimeSubscriptionPlans } from './PrimeSubscriptionPlans';
import { PrimeUserInfo } from './PrimeUserInfo';

function PrimeBanner() {
  const intl = useIntl();

  return (
    <YStack pt="$5" gap="$2" alignItems="center">
      <Icon size="$20" name="OnekeyPrimeDarkColored" />
      <SizableText size="$heading3xl" mt="$-1" textAlign="center">
        OneKey Prime
      </SizableText>
      <SizableText
        size="$bodyLg"
        maxWidth="$96"
        textAlign="center"
        color="$textSubdued"
      >
        {intl.formatMessage({
          id: ETranslations.prime_description,
        })}
      </SizableText>
    </YStack>
  );
}

export default function PrimeDashboard() {
  const intl = useIntl();
  const { user } = usePrimeAuthV2();
  const { top } = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const { fetchPrimeUserInfo } = useFetchPrimeUserInfo();
  useEffect(() => {
    void fetchPrimeUserInfo();
  }, [fetchPrimeUserInfo]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<
    string | undefined
  >();
  const {
    presentPaywallNative,
    purchasePaywallPackageWeb,
    getPaywallPackagesWeb,
  } = usePrimePayment();

  const purchaseByWebview = useCallback(async () => {
    navigation.popStack();
    await timerUtils.wait(1000);
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

  // TODO move to jotai context method
  const doPurchase = useCallback(async () => {
    try {
      setIsLoading(true);
      // await 1s
      await timerUtils.wait(500);

      if (!user?.isLoggedIn) {
        Dialog.show({ renderContent: <PrimeLoginEmailDialogV2 /> });
        // loginWithEmail();
        return;
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

  const { result: paywallPackages } = usePromiseResult(async () => {
    if (!platformEnv.isNative) {
      return getPaywallPackagesWeb?.();
    }
  }, [getPaywallPackagesWeb]);

  const subscriptionPlans = useMemo(() => {
    if (
      user?.isLoggedIn &&
      // !user?.primeSubscription?.isActive &&
      paywallPackages?.packages?.length
    ) {
      return (
        <PrimeSubscriptionPlans
          packages={paywallPackages?.packages}
          onPackageSelected={setSelectedPackageId}
        />
      );
    }
    return null;
  }, [user?.isLoggedIn, paywallPackages]);

  return (
    <>
      <Theme name="dark">
        <Stack position="absolute" left="$5" top={top || '$5'} zIndex="$5">
          <Page.Close>
            <IconButton icon="CrossedLargeOutline" variant="tertiary" />
          </Page.Close>
        </Stack>
        <Page scrollEnabled>
          <Page.Header headerShown={false} />
          <Page.Body>
            <Stack
              px="$5"
              pt={top || '$10'}
              pb="$5"
              gap="$5"
              overflow="hidden"
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderBottomColor="$borderSubdued"
            >
              <PrimeLottieAnimation />
              <PrimeBanner />
              {user?.isLoggedIn ? (
                <PrimeUserInfo doPurchase={doPurchase} />
              ) : null}
              {subscriptionPlans}
            </Stack>

            {platformEnv.isDev ? (
              <PrimeDebugPanel
                shouldShowConfirmButton={shouldShowConfirmButton}
              />
            ) : null}
            <PrimeBenefitsList />
          </Page.Body>

          <Page.Footer
            onConfirm={shouldShowConfirmButton ? doPurchase : undefined}
            onConfirmText={intl.formatMessage({
              id: ETranslations.prime_subscribe,
            })}
            confirmButtonProps={
              shouldShowConfirmButton
                ? {
                    loading: isLoading,
                  }
                : undefined
            }
          />
        </Page>
      </Theme>
    </>
  );
}
