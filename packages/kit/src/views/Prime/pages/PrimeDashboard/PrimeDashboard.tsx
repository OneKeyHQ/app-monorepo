import { useCallback, useEffect, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  Button,
  Dialog,
  Icon,
  IconButton,
  LottieView,
  Page,
  SizableText,
  Stack,
  Theme,
  Toast,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import PrimeBannerBgDark from '@onekeyhq/kit/assets/animations/prime-banner-bg-dark.json';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useFetchPrimeUserInfo } from '../../hooks/useFetchPrimeUserInfo';
import { usePrimeAuth } from '../../hooks/usePrimeAuth';
import { usePrimePayment } from '../../hooks/usePrimePayment';

import { PrimeSubscriptionPlans } from './PrimeSubscriptionPlans';
import { PrimeUserInfo } from './PrimeUserInfo';

function showDebugMessageByDialog(obj: any) {
  Dialog.debugMessage({
    debugMessage: obj,
  });
}

function PrimeBanner() {
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
        Unlock advanced features to enhance your crypto asset management
        experience.
      </SizableText>
    </YStack>
  );
}

function PrimeBenefitsItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IKeyOfIcons;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <ListItem drillIn onPress={onPress}>
      <YStack borderRadius="$3" borderCurve="continuous" bg="$brand4" p="$2">
        <Icon name={icon} size="$6" color="$brand9" />
      </YStack>
      <ListItem.Text
        userSelect="none"
        flex={1}
        primary={title}
        secondary={subtitle}
      />
    </ListItem>
  );
}

function PrimeBenefitsList() {
  return (
    <Stack py="$2">
      <PrimeBenefitsItem
        icon="RepeatOutline"
        title="Sync"
        subtitle="Automatically back up app usage data, sync across devices."
        onPress={() => {
          Toast.success({
            title: 'Sync',
          });
        }}
      />
      <PrimeBenefitsItem
        icon="BezierNodesOutline"
        title="Premium RPC"
        subtitle="Enjoy rapid and secure blockchain access."
        onPress={() => {
          Toast.success({
            title: 'Premium RPC',
          });
        }}
      />
      <PrimeBenefitsItem
        icon="BellOutline"
        title="Account Activity"
        subtitle="Subscribe to activities from up to 100 accounts."
        onPress={() => {
          Toast.success({
            title: 'Account Activity',
          });
        }}
      />
      <PrimeBenefitsItem
        icon="FileTextOutline"
        title="Analytics"
        subtitle="sint occaecat cupidatat non proident"
        onPress={() => {
          Toast.success({
            title: 'Analytics',
          });
        }}
      />
      <PrimeBenefitsItem
        icon="PhoneOutline"
        title="Device management"
        subtitle="Access Prime on up to 5 devices."
        onPress={() => {
          Toast.success({
            title: 'Device management',
          });
        }}
      />
    </Stack>
  );
}

export default function PrimeDashboard() {
  const { top } = useSafeAreaInsets();
  const { login, loginLegacy, logout, privy, getAccessToken, user } =
    usePrimeAuth();
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
    getPaywallPackagesNative,
    getCustomerInfo,
  } = usePrimePayment();

  const loginByPrivy = useCallback(async () => {
    if (platformEnv.isNative) {
      // TODO: privy login Modal is conflict with OneKey Modal
      navigation.popStack();
      await timerUtils.wait(1000);
    }
    login();
  }, [login, navigation]);

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
          // locale: 'zh-CN',
        });
        // await backgroundApiProxy.servicePrime.initRevenuecatPurchases({
        //   privyUserId: user.privyUserId || '',
        // });
        // await backgroundApiProxy.servicePrime.purchasePaywallPackage({
        //   packageId: selectedPackageId,
        //   email: user?.email || '',
        //   // locale: 'zh-CN',
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
              {platformEnv.isRuntimeBrowser ? (
                <YStack
                  position="absolute"
                  top="50%"
                  transform="translateY(-50%)"
                  left={0}
                  right={0}
                  paddingBottom="100%"
                >
                  <LottieView
                    position="absolute"
                    width="100%"
                    height="100%"
                    source={PrimeBannerBgDark}
                  />
                </YStack>
              ) : null}
              <PrimeBanner />
              {user?.isLoggedIn ? (
                <PrimeUserInfo doPurchase={doPurchase} />
              ) : null}
              {subscriptionPlans}
            </Stack>
            <PrimeBenefitsList />
            <XStack flexWrap="wrap">
              <Button
                onPress={() => {
                  void loginLegacy();
                }}
              >
                Login Legacy
              </Button>
              <Button
                onPress={() => {
                  void logout();
                }}
              >
                Logout
              </Button>
              <Button
                onPress={() => {
                  void getAccessToken().then(showDebugMessageByDialog);
                }}
              >
                Get Access Token
              </Button>
              <Button
                onPress={() => {
                  showDebugMessageByDialog({
                    ready: privy.isReady,
                    authenticated: privy.authenticated,
                    nativeUser: privy?.native?.user,
                    webUser: privy?.web?.user,
                  });
                }}
              >
                User Info
              </Button>
              <Button
                onPress={() => {
                  //
                }}
              >
                shouldShowConfirmButton={shouldShowConfirmButton.toString()}
              </Button>
              <Button
                onPress={() => {
                  void getCustomerInfo().then(showDebugMessageByDialog);
                }}
              >
                CustomerInfo
              </Button>
              <Button
                onPress={() => {
                  void fetchPrimeUserInfo().then(showDebugMessageByDialog);
                }}
              >
                ServerPrimeUserInfo
              </Button>
              <Button
                onPress={() => {
                  void getPaywallPackagesNative?.().then(
                    showDebugMessageByDialog,
                  );
                  void getPaywallPackagesWeb?.().then(showDebugMessageByDialog);
                }}
              >
                PaywallPackages
              </Button>
            </XStack>
          </Page.Body>
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
        </Page>
      </Theme>
    </>
  );
}
