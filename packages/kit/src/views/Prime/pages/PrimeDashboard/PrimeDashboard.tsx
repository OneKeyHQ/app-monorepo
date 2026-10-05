/* cspell:ignore Infini */
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
  useIsModalPage,
  useSafeAreaInsets,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  isPrimeAppleStorePayment,
  isPrimeStorePayment,
} from '@onekeyhq/shared/src/prime/primePaymentCapabilities';
import {
  EPrimePages,
  type IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { showOneKeyIdLoginFailedToast } from '../../components/oneKeyIdLoginToastUtils';
import { PrimeSubscriptionPlans } from '../../components/PrimePurchaseDialog/PrimeSubscriptionPlans';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';
import { usePrimeSubscriptionPackages } from '../../hooks/usePrimeSubscriptionPackages';

import { PrimeBenefitsList } from './PrimeBenefitsList';
import { PrimeDebugPanel } from './PrimeDebugPanel';
import { PrimeLottieAnimation } from './PrimeLottieAnimation';
import { runPrimeSubscribeWithMinimumLoadingDuration } from './primeSubscribeLoadingUtils';
import { PrimeTermsAndPrivacy } from './PrimeTermsAndPrivacy';
import { PrimeUserInfo } from './PrimeUserInfo';
import { usePrimeSubscribeResume } from './usePrimeSubscribeResume';

import type { IPrimePendingSubscribe } from './usePrimeSubscribeResume';
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
  const { fromFeature, networkId, fromDeepLink } = route.params || {};
  const isTravelMode =
    travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
    'travel-mode';
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
  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });

  const { top } = useSafeAreaInsets();
  const isModalPage = useIsModalPage();
  const { isNative, isWebMobile } = platformEnv;
  const isMobile = isNative || isWebMobile;
  // iOS sheets already exclude the status-bar inset from their content frame.
  const safeAreaTop = platformEnv.isNativeIOS && isModalPage ? 0 : top;
  const mobileTopValue = isMobile ? safeAreaTop + 25 : '$10';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { ensureOneKeyIDLoggedIn, ensurePrimeSubscriptionActive } =
    usePrimeRequirements({ networkId: networkId ?? network?.id });
  // Subscribe may await an in-flight login; read the post-login callback so
  // purchase eligibility sees the logged-in user instead of the click closure.
  const ensurePrimeSubscriptionActiveRef = useRef(
    ensurePrimeSubscriptionActive,
  );
  ensurePrimeSubscriptionActiveRef.current = ensurePrimeSubscriptionActive;

  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  const navigation = useAppNavigation();

  const pendingSubscribeRef = useRef<IPrimePendingSubscribe | null>(null);
  const subscribeInFlightRef = useRef(false);
  const loginInFlightRef = useRef<Promise<void> | null>(null);
  const fromDeepLinkRef = useRef(Boolean(fromDeepLink));
  const consumedDeepLinkHandoffRef = useRef(false);
  const isMountedRef = useIsMounted();
  const [isSubscribeLazyLoading, setIsSubscribeLazyLoading] = useState(false);
  const [didDashboardLoginFail, setDidDashboardLoginFail] = useState(false);

  if (fromDeepLink && !fromDeepLinkRef.current) {
    consumedDeepLinkHandoffRef.current = false;
  }
  fromDeepLinkRef.current = Boolean(fromDeepLink);

  usePrimeSubscribeResume({
    ensurePrimeSubscriptionActive,
    featureName: fromFeature,
    isLoggedIn,
    onLoadingChange: setIsSubscribeLazyLoading,
    pendingSubscribeRef,
    subscribeInFlightRef,
  });

  const ensureDashboardLogin = useCallback(() => {
    if (!loginInFlightRef.current) {
      loginInFlightRef.current = loginOneKeyId().finally(() => {
        loginInFlightRef.current = null;
      });
    }
    return loginInFlightRef.current;
  }, [loginOneKeyId]);

  const handleDashboardLoginError = useCallback(
    (error: unknown) => {
      if (!isMountedRef.current) {
        return;
      }
      if (error instanceof PrimeLoginDialogCancelError) {
        setDidDashboardLoginFail(false);
        if (fromDeepLinkRef.current) {
          navigation.setParams({ fromDeepLink: undefined });
        }
        return;
      }
      setDidDashboardLoginFail(true);
      showOneKeyIdLoginFailedToast({ error, intl });
    },
    [intl, isMountedRef, navigation],
  );

  const consumeDeepLinkHandoff = useCallback(() => {
    if (
      !isMountedRef.current ||
      consumedDeepLinkHandoffRef.current ||
      pendingSubscribeRef.current ||
      subscribeInFlightRef.current ||
      !fromDeepLinkRef.current
    ) {
      return;
    }
    consumedDeepLinkHandoffRef.current = true;
    setDidDashboardLoginFail(false);
    // Clear the route flag so a remount / pop-back cannot push Infini again.
    navigation.setParams({ fromDeepLink: undefined });
    navigation.push(EPrimePages.PrimeInfiniSubscription);
  }, [isMountedRef, navigation]);

  const handleDashboardLogin = useCallback(async () => {
    try {
      // Checks the service token and resolves after the login dialog closes.
      await ensureDashboardLogin();
    } catch (error) {
      handleDashboardLoginError(error);
      return;
    }
    if (!isMountedRef.current) {
      return;
    }
    setDidDashboardLoginFail(false);
    consumeDeepLinkHandoff();
  }, [
    consumeDeepLinkHandoff,
    ensureDashboardLogin,
    handleDashboardLoginError,
    isMountedRef,
  ]);

  useEffect(() => {
    if (!fromDeepLink || !isAuthReady) {
      return;
    }
    let cancelled = false;
    // Checks the service token and resolves after the login dialog closes.
    ensureDashboardLogin().then(
      () => {
        if (!cancelled) consumeDeepLinkHandoff();
      },
      (error: unknown) => {
        if (!cancelled) handleDashboardLoginError(error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [
    consumeDeepLinkHandoff,
    ensureDashboardLogin,
    fromDeepLink,
    handleDashboardLoginError,
    isAuthReady,
  ]);

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

  const selectedPackage = useMemo(
    () =>
      packages?.find(
        (p) => p.subscriptionPeriod === selectedSubscriptionPeriod,
      ),
    [packages, selectedSubscriptionPeriod],
  );

  const subscribeButtonEnabled = !isTravelMode && Boolean(selectedPackage);

  const subscribeConfirmButtonProps = useMemo(
    () => ({
      loading: isSubscribeLazyLoading,
      disabled: !subscribeButtonEnabled,
    }),
    [isSubscribeLazyLoading, subscribeButtonEnabled],
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
    if (subscribeInFlightRef.current) {
      return;
    }
    // An explicit purchase replaces the subscription-management intent.
    if (fromDeepLinkRef.current) {
      navigation.setParams({ fromDeepLink: undefined });
    }
    subscribeInFlightRef.current = true;
    try {
      setIsSubscribeLazyLoading(true);
      const pendingLogin = loginInFlightRef.current;
      if (pendingLogin) {
        try {
          await pendingLogin;
        } catch (error) {
          handleDashboardLoginError(error);
          return;
        }
      }

      defaultLogger.prime.subscription.primeSubscribeButtonClick({
        subscriptionPeriod: selectedSubscriptionPeriod,
        featureName: fromFeature,
        isLoggedIn,
      });

      if (isLoggedIn || pendingLogin) {
        pendingSubscribeRef.current = null;
      } else {
        pendingSubscribeRef.current = {
          subscriptionPeriod: selectedSubscriptionPeriod,
          freeTrial: selectedPackage?.freeTrial,
        };
      }

      await runPrimeSubscribeWithMinimumLoadingDuration(() =>
        ensurePrimeSubscriptionActiveRef.current({
          skipDialogConfirm: true,
          selectedSubscriptionPeriod,
          featureName: fromFeature,
          freeTrial: selectedPackage?.freeTrial,
        }),
      );
    } finally {
      subscribeInFlightRef.current = false;
      setIsSubscribeLazyLoading(false);
    }
  }, [
    handleDashboardLoginError,
    navigation,
    selectedSubscriptionPeriod,
    subscribeButtonEnabled,
    fromFeature,
    isLoggedIn,
    selectedPackage?.freeTrial,
  ]);

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

  // Persisted Prime flags hide the purchase footer, but a failed service-token
  // login still needs the retry CTA in that footer.
  const shouldShowLoginPrompt = !isLoggedInMaybe || didDashboardLoginFail;

  const renderLoginPrompt = useMemo(() => {
    if (!shouldShowLoginPrompt) {
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
            void handleDashboardLogin();
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
            void handleDashboardLogin();
          }}
        >
          {action}
        </SizableText>
      </XStack>
    );
  }, [handleDashboardLogin, intl, shouldShowLoginPrompt]);

  return (
    <>
      <Theme name="dark">
        <Stack
          position="absolute"
          left="$5"
          top={safeAreaTop || '$5'}
          zIndex="$5"
        >
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
              {isPrimeAppleStorePayment() ? (
                <Stack>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.prime_subscription_manage_app_store,
                    })}
                  </SizableText>
                </Stack>
              ) : null}
              {shouldShowConfirmButton ? (
                <Stack alignItems="center" $gtMd={{ alignItems: 'flex-start' }}>
                  <PrimeTermsAndPrivacy />
                </Stack>
              ) : null}
              {!isPrimeSubscriptionActive &&
              isLoggedIn &&
              isPrimeStorePayment() ? (
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

          {shouldShowConfirmButton || shouldShowLoginPrompt ? (
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
                  {shouldShowConfirmButton ? (
                    <Page.FooterActions
                      p="$0"
                      confirmButtonProps={subscribeConfirmButtonProps}
                      onConfirm={subscribe}
                      onConfirmText={subscribeButtonText}
                    />
                  ) : null}
                </XStack>

                {/* Mobile layout: column with subscribe and login */}
                <YStack
                  display="flex"
                  gap="$3"
                  alignItems="center"
                  $gtMd={{ display: 'none' }}
                >
                  {shouldShowConfirmButton ? (
                    <Page.FooterActions
                      p="$0"
                      width="100%"
                      confirmButtonProps={subscribeConfirmButtonProps}
                      onConfirm={subscribe}
                      onConfirmText={subscribeButtonText}
                    />
                  ) : null}
                  {renderLoginPrompt}
                </YStack>
              </Stack>
            </Page.Footer>
          ) : null}
        </Page>
      </Theme>
    </>
  );
}
