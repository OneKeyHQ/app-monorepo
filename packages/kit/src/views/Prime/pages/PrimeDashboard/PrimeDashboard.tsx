import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  LinearGradient,
  NavCloseButton,
  Page,
  SizableText,
  Spinner,
  Stack,
  Theme,
  XStack,
  YStack,
  useSafeAreaInsets,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EPrimePages,
  IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { PrimeSubscriptionPlans } from '../../components/PrimePurchaseDialog/PrimeSubscriptionPlans';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';
import { usePrimeSubscriptionPackages } from '../../hooks/usePrimeSubscriptionPackages';

import { PrimeBenefitsList } from './PrimeBenefitsList';
import { PrimeDebugPanel } from './PrimeDebugPanel';
import { PrimeLottieAnimation } from './PrimeLottieAnimation';
import { PrimeTermsAndPrivacy } from './PrimeTermsAndPrivacy';
import { PrimeUserInfo } from './PrimeUserInfo';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';
import type { RouteProp } from '@react-navigation/core';

const FooterGradient = memo(() => {
  const theme = useTheme();
  return (
    <LinearGradient
      position="absolute"
      top={-24}
      left={0}
      right={0}
      height={25}
      colors={[`${theme.bgApp.val}00`, theme.bgApp.val]}
      start={[0, 0]}
      end={[0, 1]}
      pointerEvents="none"
    />
  );
});

FooterGradient.displayName = 'FooterGradient';

function PrimeBanner({ isPrimeActive = false }: { isPrimeActive?: boolean }) {
  const intl = useIntl();

  return (
    <YStack pt="$5" gap="$2" alignItems="center">
      <Icon size="$14" name="OnekeyPrimeDarkColored" />
      <SizableText size="$heading2xl" mt="$-1" textAlign="center">
        OneKey Prime
      </SizableText>
      <SizableText
        size="$bodyLg"
        maxWidth="$96"
        textAlign="center"
        color="$textSubdued"
      >
        {isPrimeActive
          ? intl.formatMessage({
              id: ETranslations.prime_unlock_description,
            })
          : intl.formatMessage({ id: ETranslations.prime_description })}
      </SizableText>
    </YStack>
  );
}

export default function PrimeDashboard({
  route,
}: {
  route: RouteProp<IPrimeParamList, EPrimePages.PrimeDashboard>;
}) {
  const intl = useIntl();
  const { fromFeature } = route.params || {};
  // const isReady = false;
  const {
    isReady: isAuthReady,
    user,
    isLoggedIn,
    isPrimeSubscriptionActive,
    isPrimeActive,
    supabaseUser,
    isSupabaseLoggedIn,
    loginOneKeyId,
    // logout,
  } = useOneKeyAuth();

  const [selectedSubscriptionPeriod, setSelectedSubscriptionPeriod] =
    useState<ISubscriptionPeriod>('P1Y');

  const { top } = useSafeAreaInsets();
  const { isNative, isWebMobile } = platformEnv;
  const isMobile = isNative || isWebMobile;
  const mobileTopValue = isMobile ? top + 25 : '$10';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ensureOneKeyIDLoggedIn, ensurePrimeSubscriptionActive } =
    usePrimeRequirements();

  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  const navigation = useAppNavigation();

  const pendingSubscribeRef = useRef<{
    subscriptionPeriod: ISubscriptionPeriod;
  } | null>(null);

  const prevIsLoggedInRef = useRef(isLoggedIn);

  const dashboardShownRef = useRef(false);
  useEffect(() => {
    if (!isAuthReady) return;
    if (dashboardShownRef.current) return;
    dashboardShownRef.current = true;
    defaultLogger.prime.subscription.primeDashboardShow({
      featureName: fromFeature,
      isPrimeActive,
    });
  }, [fromFeature, isAuthReady, isPrimeActive]);

  useEffect(() => {
    const fn = async () => {
      // isFocused won't be triggered when Login Dialog is open or closed
      if (isFocused && isAuthReady) {
        await timerUtils.wait(600);
        if (!isFocusedRef.current) {
          // may be blurred when auto navigate to Device Limit Page
          return;
        }
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      }
    };
    void fn();
  }, [isFocused, isAuthReady]);

  const shouldShowConfirmButton = useMemo(() => {
    if (!isLoggedIn || !isPrimeSubscriptionActive) {
      return true;
    }
    return false;
  }, [isLoggedIn, isPrimeSubscriptionActive]);

  const shouldShowSubscriptionPlans = useMemo(() => {
    if (!shouldShowConfirmButton) {
      return false;
    }
    if (isPrimeSubscriptionActive) {
      return false;
    }
    return true;
  }, [isPrimeSubscriptionActive, shouldShowConfirmButton]);

  const { packages, isPurchaseReady, restorePurchases } =
    usePrimeSubscriptionPackages({
      enabled: shouldShowSubscriptionPlans,
    });

  const [isSubscribeLazyLoading, setIsSubscribeLazyLoading] = useState(false);
  const isSubscribeLazyLoadingRef = useRef(isSubscribeLazyLoading);
  isSubscribeLazyLoadingRef.current = isSubscribeLazyLoading;

  const subscribeButtonEnabled = useMemo(() => {
    if (!isLoggedIn) {
      return true;
    }
    if (packages?.length) {
      return true;
    }
    return false;
  }, [isLoggedIn, packages?.length]);

  const subscribeConfirmButtonProps = useMemo(
    () => ({
      loading: isSubscribeLazyLoading,
      disabled: !subscribeButtonEnabled,
    }),
    [isSubscribeLazyLoading, subscribeButtonEnabled],
  );

  const selectedPackage = useMemo(
    () =>
      packages?.find(
        (p) => p.subscriptionPeriod === selectedSubscriptionPeriod,
      ),
    [packages, selectedSubscriptionPeriod],
  );

  const subscribeButtonText = useMemo(() => {
    if (!selectedPackage) {
      return intl.formatMessage({ id: ETranslations.prime_subscribe });
    }
    if (selectedPackage.freeTrial?.periodUnit === 'day') {
      return intl.formatMessage(
        { id: ETranslations.prime_start_free_trial_days },
        { count: selectedPackage.freeTrial.periodNumber },
      );
    }
    if (selectedPackage.freeTrial) {
      return intl.formatMessage({
        id: ETranslations.prime_start_free_trial,
      });
    }
    const isYearly = selectedPackage.subscriptionPeriod === 'P1Y';
    return intl.formatMessage(
      {
        id: isYearly
          ? ETranslations.prime_subscribe_yearly_price
          : ETranslations.prime_subscribe_monthly_price,
      },
      {
        price: isYearly
          ? selectedPackage.pricePerYearString
          : selectedPackage.pricePerMonthString,
      },
    );
  }, [intl, selectedPackage]);

  const subscribe = useCallback(async () => {
    if (!subscribeButtonEnabled) {
      return;
    }
    if (isSubscribeLazyLoadingRef.current) {
      return;
    }

    defaultLogger.prime.subscription.primeSubscribeButtonClick({
      subscriptionPeriod: selectedSubscriptionPeriod,
      featureName: fromFeature,
      isLoggedIn,
    });

    // If not logged in, store intent so we can resume after login
    if (!isLoggedIn) {
      pendingSubscribeRef.current = {
        subscriptionPeriod: selectedSubscriptionPeriod,
      };
    }

    setIsSubscribeLazyLoading(true);
    setTimeout(() => {
      setIsSubscribeLazyLoading(false);
    }, 2000);

    // await ensureOneKeyIDLoggedIn({
    //   skipDialogConfirm: true,
    // });
    await ensurePrimeSubscriptionActive({
      skipDialogConfirm: true,
      selectedSubscriptionPeriod,
      featureName: fromFeature,
    });
  }, [
    ensurePrimeSubscriptionActive,
    selectedSubscriptionPeriod,
    subscribeButtonEnabled,
    fromFeature,
    isLoggedIn,
  ]);

  useEffect(() => {
    const wasNotLoggedIn = !prevIsLoggedInRef.current;
    prevIsLoggedInRef.current = isLoggedIn;

    let timerId: ReturnType<typeof setTimeout> | undefined;

    if (wasNotLoggedIn && isLoggedIn && pendingSubscribeRef.current) {
      const { subscriptionPeriod } = pendingSubscribeRef.current;
      pendingSubscribeRef.current = null;

      // Small delay to let auth state fully settle and packages load
      timerId = setTimeout(async () => {
        try {
          await ensurePrimeSubscriptionActive({
            skipDialogConfirm: true,
            selectedSubscriptionPeriod: subscriptionPeriod,
            featureName: fromFeature,
          });
        } catch {
          // Login was completed but subscription check may throw
          // (e.g., user cancelled purchase dialog) — safe to ignore
        }
      }, 1000);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isLoggedIn, ensurePrimeSubscriptionActive, fromFeature]);

  const isLoggedInMaybe =
    isSupabaseLoggedIn ||
    supabaseUser?.id ||
    user?.onekeyUserId ||
    user?.isLoggedIn ||
    user?.isLoggedInOnServer ||
    isLoggedIn;

  // const shouldShowIOSAppStoreHint = useMemo(() => {
  //   // return true;
  //   return isPrimeSubscriptionActive && platformEnv.isNativeIOS;
  // }, [isPrimeSubscriptionActive]);

  const renderLoginPrompt = useMemo(() => {
    if (isLoggedInMaybe) {
      return null;
    }
    const fullText = intl.formatMessage({
      id: ETranslations.prime_already_subscribed_log_in,
    });
    const separatorIndex = fullText.search(/[?？]/);
    if (separatorIndex === -1) {
      return (
        <SizableText
          size="$bodyMd"
          color="$textInteractive"
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          onPress={() => {
            void loginOneKeyId();
          }}
        >
          {fullText}
        </SizableText>
      );
    }
    const prefix = fullText.slice(0, separatorIndex + 1);
    const action = fullText.slice(separatorIndex + 1).trim();
    return (
      <XStack gap="$1" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {prefix}
        </SizableText>
        <SizableText
          size="$bodyMd"
          color="$textInteractive"
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          onPress={() => {
            void loginOneKeyId();
          }}
        >
          {action}
        </SizableText>
      </XStack>
    );
  }, [isLoggedInMaybe, intl, loginOneKeyId]);

  return (
    <>
      <Theme name="dark">
        <Stack position="absolute" left="$5" top={top || '$5'} zIndex="$5">
          <NavCloseButton onPress={() => navigation.popStack()} />
        </Stack>
        <Page scrollEnabled>
          <Page.Header headerShown={false} />
          <Page.Body>
            <Stack
              px="$5"
              pt={mobileTopValue}
              pb={isMobile ? '$5' : '$5'}
              gap="$5"
              overflow="hidden"
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderBottomColor="$borderSubdued"
            >
              <PrimeLottieAnimation />
              <PrimeBanner isPrimeActive={isPrimeSubscriptionActive} />
              {isLoggedInMaybe ? <PrimeUserInfo /> : null}
            </Stack>

            {shouldShowSubscriptionPlans ? (
              <Stack px="$5" pt="$5" pb="$2" gap="$2">
                <PrimeSubscriptionPlans
                  packages={packages}
                  selectedSubscriptionPeriod={selectedSubscriptionPeriod}
                  onSubscriptionPeriodSelected={setSelectedSubscriptionPeriod}
                />
              </Stack>
            ) : null}

            {isPurchaseReady ? (
              <PrimeBenefitsList
                selectedSubscriptionPeriod={selectedSubscriptionPeriod}
                networkId={route.params?.networkId}
              />
            ) : (
              <Spinner my="$10" />
            )}

            <YStack px="$5" py="$4" gap="$4">
              {platformEnv.isNativeIOS ? (
                <Stack>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.prime_subscription_manage_app_store,
                    })}
                  </SizableText>
                </Stack>
              ) : null}
              {!isPrimeSubscriptionActive &&
              isLoggedIn &&
              platformEnv.isNative ? (
                <Stack>
                  <SizableText
                    size="$bodyMd"
                    color="$textInteractive"
                    cursor="pointer"
                    onPress={() => {
                      void restorePurchases?.();
                    }}
                  >
                    {intl.formatMessage({
                      id: ETranslations.prime_restore_purchases,
                    })}
                  </SizableText>
                </Stack>
              ) : null}
            </YStack>

            {platformEnv.isDev ? (
              <PrimeDebugPanel
                shouldShowConfirmButton={shouldShowConfirmButton}
              />
            ) : null}
          </Page.Body>

          {shouldShowConfirmButton ? (
            <Page.Footer>
              <FooterGradient />
              <Stack p="$5" pt="$1" gap="$4">
                {/* Desktop layout: row with login left, subscribe right */}
                <XStack
                  display="none"
                  $gtMd={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: isLoggedInMaybe
                      ? 'flex-end'
                      : 'space-between',
                    alignItems: 'center',
                    gap: '$2.5',
                  }}
                >
                  {renderLoginPrompt}
                  <Page.FooterActions
                    p="$0"
                    confirmButtonProps={subscribeConfirmButtonProps}
                    onConfirm={subscribe}
                    onConfirmText={subscribeButtonText}
                  />
                </XStack>

                {/* Mobile layout: column with subscribe, login, terms */}
                <YStack
                  display="flex"
                  gap="$3"
                  alignItems="center"
                  $gtMd={{ display: 'none' }}
                >
                  <Page.FooterActions
                    p="$0"
                    width="100%"
                    confirmButtonProps={subscribeConfirmButtonProps}
                    onConfirm={subscribe}
                    onConfirmText={subscribeButtonText}
                  />
                  {renderLoginPrompt}
                </YStack>

                {/* Terms & Privacy — always at bottom on both platforms */}
                <Stack alignItems="center" $gtMd={{ alignItems: 'flex-start' }}>
                  <PrimeTermsAndPrivacy />
                </Stack>
              </Stack>
            </Page.Footer>
          ) : null}
        </Page>
      </Theme>
    </>
  );
}
