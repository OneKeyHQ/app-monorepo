import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { StyleSheet } from 'react-native';

import type { IKeyOfIcons, IXStackProps } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Dialog,
  Icon,
  IconButton,
  LottieView,
  NumberSizeableText,
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useFetchPrimeUserInfo } from '../../hooks/useFetchPrimeUserInfo';
import { usePrimeAuth } from '../../hooks/usePrimeAuth';
import { usePrimePayment } from '../../hooks/usePrimePayment';

import { PrimeUserInfo } from './PrimeUserInfo';

import type { Package } from '@revenuecat/purchases-js';

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

function PrimeSubscriptionPlanItem({
  selected,
  title,
  periodDuration,
  price,
  currency,
  ...rest
}: {
  selected?: boolean;
  title: string;
  periodDuration: 'P1Y' | 'P1M';
  price: number;
  currency: string;
} & IXStackProps) {
  let promoText = '';
  let pricePerMonth = price;
  if (periodDuration === 'P1Y') {
    const pricePerMonthBN = new BigNumber(price).div(12);
    pricePerMonth = pricePerMonthBN.toNumber();
    // const savePercent = new BigNumber(1)
    //   .minus(pricePerMonthBN.div(price))
    //   .multipliedBy(100)
    //   .toFixed(1);
    // promoText = `Save ${savePercent}%`;
    promoText = `Save 33%`;
  }
  return (
    <XStack
      alignItems="baseline"
      pl="$5"
      pr="$4"
      py="$5"
      bg="$bg"
      borderWidth={2}
      borderColor={selected ? '$borderActive' : '$borderSubdued'}
      borderRadius="$3"
      borderCurve="continuous"
      userSelect="none"
      {...rest}
    >
      {promoText ? (
        <Badge position="absolute" top={-11} right="$4" bg="$bgInverse">
          <Badge.Text color="$textInverse">{promoText}</Badge.Text>
        </Badge>
      ) : null}
      <SizableText size="$headingXl" mr="$2">
        {title} ({periodDuration})
      </SizableText>
      <NumberSizeableText
        flex={1}
        size="$headingXl"
        formatter="price"
        formatterOptions={{
          currency,
        }}
      >
        {price}
      </NumberSizeableText>
      <NumberSizeableText
        ml="$2"
        size="$bodyMd"
        color="$textSubdued"
        formatter="price"
        formatterOptions={{
          currency,
          tokenSymbol: '/month', // TODO i18n
        }}
      >
        {pricePerMonth}
      </NumberSizeableText>
    </XStack>
  );
}

function PrimeSubscriptionPlans({
  packages,
  onPackageSelected,
}: {
  packages: Package[] | undefined;
  onPackageSelected: (packageId: string) => void;
}) {
  const [selectedPackageId, setSelectedPackageId] = useState<
    string | undefined
  >(packages?.[0]?.identifier);

  useEffect(() => {
    if (selectedPackageId) {
      onPackageSelected(selectedPackageId);
    }
  }, [onPackageSelected, selectedPackageId]);

  return (
    <YStack
      gap="$2.5"
      $gtMd={{
        flexDirection: 'row',
      }}
    >
      {packages?.map((p) => {
        const selected = selectedPackageId === p.identifier;
        return (
          <PrimeSubscriptionPlanItem
            key={p.identifier}
            selected={selected}
            title={p.rcBillingProduct.title}
            periodDuration={
              p.rcBillingProduct?.normalPeriodDuration as unknown as any
            }
            price={p.rcBillingProduct.currentPrice.amountMicros / 1_000_000}
            onPress={() => {
              setSelectedPackageId(p.identifier);
            }}
            currency="$"
            $gtMd={{
              flex: 1,
            }}
          />
        );
      })}
    </YStack>
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

  const onConfirm = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!user?.isLoggedIn) {
        if (platformEnv.isNative) {
          // TODO: privy login Modal is conflict with OneKey Modal
          navigation.popStack();
          await timerUtils.wait(1000);
        }
        login();
        // loginLegacy();
      } else if (platformEnv.isNative) {
        await presentPaywallNative?.();
      } else if (selectedPackageId) {
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
    login,
    navigation,
    presentPaywallNative,
    purchasePaywallPackageWeb,
    selectedPackageId,
    user?.email,
    user?.isLoggedIn,
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
              {user?.isLoggedIn ? <PrimeUserInfo /> : null}
              {user?.isLoggedIn &&
              !user?.primeSubscription?.isActive &&
              paywallPackages?.packages?.length ? (
                <PrimeSubscriptionPlans
                  packages={paywallPackages?.packages}
                  onPackageSelected={setSelectedPackageId}
                />
              ) : null}
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
            onConfirm={shouldShowConfirmButton ? onConfirm : undefined}
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
