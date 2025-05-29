import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  IconButton,
  Page,
  SizableText,
  Spinner,
  Stack,
  Theme,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { PrimeSubscriptionPlans } from '../../components/PrimePurchaseDialog/PrimeSubscriptionPlans';
import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';

import { PrimeBenefitsList } from './PrimeBenefitsList';
import { PrimeDebugPanel } from './PrimeDebugPanel';
import { PrimeLottieAnimation } from './PrimeLottieAnimation';
import { PrimeUserInfo } from './PrimeUserInfo';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';

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

function PrimeTerms() {
  const termsTag = useCallback(
    () => (
      <SizableText
        size="$bodyMd"
        color="$textInteractive"
        cursor="pointer"
        onPress={() => {
          openUrlExternal('https://help.onekey.so/hc/articles/11967482818831');
        }}
      >
        OneKey Prime Terms
      </SizableText>
    ),
    [],
  );
  const privacyTag = useCallback(
    () => (
      <SizableText
        size="$bodyMd"
        color="$textInteractive"
        cursor="pointer"
        onPress={() => {
          openUrlExternal(
            'https://help.onekey.so/hc/articles/360002003315-Privacy-Policy',
          );
        }}
      >
        OneKey Prime Terms
      </SizableText>
    ),
    [],
  );
  return (
    <HyperlinkText
      size="$bodyMd"
      values={{
        termsTag,
        privacyTag,
      }}
      translationId={ETranslations.prime_agree_to_terms_privacy}
      defaultMessage={ETranslations.prime_agree_to_terms_privacy}
    />
  );
}

export default function PrimeDashboard() {
  const intl = useIntl();
  // const isReady = false;
  const {
    isReady,
    user,
    isLoggedIn,
    isPrimeSubscriptionActive,
    privyUser,
    authenticated,
    // logout,
  } = usePrimeAuthV2();

  const { gtMd } = useMedia();

  const {
    purchasePackageNative,
    getPackagesNative,
    purchasePackageWeb,
    restorePurchases,
    getPackagesWeb,
  } = usePrimePayment();

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

  useEffect(() => {
    const fn = async () => {
      // isFocused won't be triggered when Login Dialog is open or closed
      if (isFocused) {
        await timerUtils.wait(600);
        if (!isFocusedRef.current) {
          // may be blurred when auto navigate to Device Limit Page
          return;
        }
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      }
    };
    void fn();
  }, [isFocused]);

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

  const { result: packages, isLoading: isPackagesLoading } = usePromiseResult(
    async () => {
      if (!shouldShowSubscriptionPlans) {
        return [];
      }
      return platformEnv.isNative ? getPackagesNative?.() : getPackagesWeb?.();
    },
    [getPackagesNative, getPackagesWeb, shouldShowSubscriptionPlans],
    {
      watchLoading: true,
    },
  );

  const [isSubscribeLazyLoading, setIsSubscribeLazyLoading] = useState(false);
  const isSubscribeLazyLoadingRef = useRef(isSubscribeLazyLoading);
  isSubscribeLazyLoadingRef.current = isSubscribeLazyLoading;
  const subscribe = useCallback(async () => {
    if (isPackagesLoading) {
      return;
    }
    if (isSubscribeLazyLoadingRef.current) {
      return;
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
    });
  }, [
    ensurePrimeSubscriptionActive,
    isPackagesLoading,
    selectedSubscriptionPeriod,
  ]);

  const isLoggedInMaybe =
    authenticated ||
    privyUser?.id ||
    user?.isLoggedIn ||
    user?.isLoggedInOnServer ||
    isLoggedIn;

  // const shouldShowIOSAppStoreHint = useMemo(() => {
  //   // return true;
  //   return isPrimeSubscriptionActive && platformEnv.isNativeIOS;
  // }, [isPrimeSubscriptionActive]);

  const autoRenewText = useMemo(() => {
    if (!shouldShowConfirmButton || isPackagesLoading) {
      return null;
    }
    const selectedPackage = packages?.find(
      (p) => p.subscriptionPeriod === selectedSubscriptionPeriod,
    );
    const isMonthly = selectedPackage?.subscriptionPeriod === 'P1M';
    let text = intl.formatMessage(
      {
        id: ETranslations.prime_subscription_auto_renew_price_year,
      },
      {
        price: selectedPackage?.pricePerYearString,
      },
    );
    if (isMonthly) {
      text = intl.formatMessage(
        {
          id: ETranslations.prime_subscription_auto_renew_price_month,
        },
        {
          price: selectedPackage?.pricePerMonthString,
        },
      );
    }
    return (
      <SizableText
        size="$bodyMd"
        textAlign={gtMd ? 'left' : 'center'}
        alignSelf={gtMd ? 'flex-start' : 'center'}
      >
        {text}
      </SizableText>
    );
  }, [
    intl,
    isPackagesLoading,
    packages,
    selectedSubscriptionPeriod,
    shouldShowConfirmButton,
    gtMd,
  ]);

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
              pt={mobileTopValue}
              pb={isMobile ? '$10' : '$5'}
              gap="$5"
              overflow="hidden"
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderBottomColor="$borderSubdued"
            >
              <PrimeLottieAnimation />
              <PrimeBanner />
              {isLoggedInMaybe ? <PrimeUserInfo /> : null}
            </Stack>

            {shouldShowSubscriptionPlans ? (
              <Stack p="$5">
                <PrimeSubscriptionPlans
                  packages={packages}
                  selectedSubscriptionPeriod={selectedSubscriptionPeriod}
                  onSubscriptionPeriodSelected={setSelectedSubscriptionPeriod}
                />
              </Stack>
            ) : null}

            {isReady ? <PrimeBenefitsList /> : <Spinner my="$10" />}

            <YStack px="$5" py="$4" gap="$4">
              {gtMd ? autoRenewText : null}
              {platformEnv.isNativeIOS ? (
                <>
                  <Stack>
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {intl.formatMessage({
                        id: ETranslations.prime_subscription_manage_app_store,
                      })}
                    </SizableText>
                  </Stack>
                </>
              ) : null}
              {!isPrimeSubscriptionActive && platformEnv.isNative ? (
                <Stack>
                  <SizableText
                    size="$bodyMd"
                    color="$textInteractive"
                    cursor="pointer"
                    onPress={() => {
                      restorePurchases?.();
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

          <Page.Footer>
            <Stack
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              gap="$2.5"
              p="$5"
              $md={{
                alignItems: 'flex-start',
                flexDirection: 'column',
              }}
            >
              {shouldShowConfirmButton ? <PrimeTerms /> : null}

              <Page.FooterActions
                p="$0"
                $md={{
                  width: '100%',
                }}
                confirmButtonProps={{
                  loading: isSubscribeLazyLoading,
                  disabled: isPackagesLoading,
                }}
                onConfirm={shouldShowConfirmButton ? subscribe : undefined}
                onConfirmText={intl.formatMessage({
                  id: ETranslations.prime_subscribe,
                })}
              />

              {!gtMd ? autoRenewText : null}
            </Stack>
          </Page.Footer>
        </Page>
      </Theme>
    </>
  );
}
