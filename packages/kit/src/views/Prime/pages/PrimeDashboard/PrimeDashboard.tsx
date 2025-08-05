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
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IPrimeParamList } from '@onekeyhq/shared/src/routes/prime';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeServerUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { usePrimePurchaseCallback } from '../../components/PrimePurchaseDialog/PrimePurchaseDialog';
import { PrimeSubscriptionPlans } from '../../components/PrimePurchaseDialog/PrimeSubscriptionPlans';
import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';
import { usePrimePayment } from '../../hooks/usePrimePayment';
import { usePrimePaymentMethodsWeb } from '../../hooks/usePrimePaymentMethodsWeb';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';

import { PrimeBenefitsList } from './PrimeBenefitsList';
import { PrimeDebugPanel } from './PrimeDebugPanel';
import { PrimeLottieAnimation } from './PrimeLottieAnimation';
import { PrimeTermsAndPrivacy } from './PrimeTermsAndPrivacy';
import { PrimeUserInfo } from './PrimeUserInfo';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';
import type { RouteProp } from '@react-navigation/core';

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

export default function PrimeDashboard({
  route,
}: {
  route: RouteProp<IPrimeParamList, EPrimePages.PrimeDashboard>;
}) {
  const intl = useIntl();
  // const isReady = false;
  const {
    user,
    isLoggedIn,
    isPrimeSubscriptionActive,
    privyUser,
    authenticated,
    // logout,
  } = usePrimeAuthV2();

  const { isReady, getPackagesNative, restorePurchases, getPackagesWeb } =
    usePrimePayment();

  const [selectedSubscriptionPeriod, setSelectedSubscriptionPeriod] =
    useState<ISubscriptionPeriod>('P1Y');
  const [serverUserInfo, setServerUserInfo] = useState<
    IPrimeServerUserInfo | undefined
  >(undefined);

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

  useEffect(() => {
    const fn = async () => {
      // isFocused won't be triggered when Login Dialog is open or closed
      if (isFocused) {
        await timerUtils.wait(600);
        if (!isFocusedRef.current) {
          // may be blurred when auto navigate to Device Limit Page
          return;
        }
        const result =
          await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
        setServerUserInfo(result.serverUserInfo);
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
    if (!user?.privyUserId) {
      return false;
    }
    return true;
  }, [isPrimeSubscriptionActive, shouldShowConfirmButton, user?.privyUserId]);

  const { getPackagesWeb: getPackagesWeb2 } = usePrimePaymentMethodsWeb();
  // const getPackagesWeb2 = useCallback(async () => {
  //   console.log('getPackagesWeb2');
  //   return [];
  // }, []);

  const { result: webPackages } = usePromiseResult(async () => {
    if (isReady) {
      console.log('getPackagesWeb2__isReady', isReady);
      const shouldPolyfillRandomUUIDTemporarily =
        !globalThis?.crypto?.randomUUID && platformEnv.isNativeAndroid;
      if (shouldPolyfillRandomUUIDTemporarily) {
        // getPackagesWeb2() require randomUUID, so polyfill it temporarily
        globalThis.crypto.randomUUID = () => {
          return stringUtils.generateUUID() as `${string}-${string}-${string}-${string}-${string}`;
        };
      }
      try {
        if (platformEnv.isNativeAndroid) {
          const pkgList2 = await getPackagesWeb2?.();
          console.log('getPackagesWeb2__pkgList22222222', pkgList2);
          return pkgList2;
        }
      } finally {
        if (shouldPolyfillRandomUUIDTemporarily) {
          // randomUUID may cause RevenueCat native SDK not ready, so reset it to undefined
          globalThis.crypto.randomUUID = undefined as any;
        }
      }
    }
  }, [getPackagesWeb2, isReady]);

  const { result: sdkPackages, isLoading: isPackagesLoading } =
    usePromiseResult(
      async () => {
        if (!shouldShowSubscriptionPlans || !isReady) {
          return [];
        }

        if (!user?.privyUserId) {
          return [];
        }

        // TODO There was a problem with the store.
        return errorToastUtils.withErrorAutoToast(async () => {
          try {
            const pkgList = await (platformEnv.isNative
              ? getPackagesNative?.()
              : getPackagesWeb?.());
            console.log('pkgList1111111', pkgList);
            return pkgList;
          } catch (error) {
            const e = error as IOneKeyError | undefined;

            console.log(
              'revenueCatSDK.getPackages() ERROR >>>>>>> ',
              e,
              errorUtils.toPlainErrorObject(e),
            );
            let shouldThrow = true;
            if (
              platformEnv.isNativeAndroid &&
              e &&
              e?.code === ('3' as unknown as number) &&
              e?.message ===
                'The device or user is not allowed to make the purchase.'
            ) {
              // SDK errors:
              // - There was a problem with the store. (maybe network issue, or not login GooglePlayStore\AppStore)
              // - The device or user is not allowed to make the purchase.
              //    (GooglePlay Service not available on this device, so we should not throw error)
              shouldThrow = false;
            }
            if (shouldThrow) {
              throw error;
            }
          }
        });
      },
      [
        getPackagesNative,
        getPackagesWeb,
        isReady,
        shouldShowSubscriptionPlans,
        user?.privyUserId,
      ],
      {
        watchLoading: true,
      },
    );

  const packages = useMemo(() => {
    if (sdkPackages?.length) {
      return sdkPackages;
    }
    return webPackages || [];
  }, [sdkPackages, webPackages]);

  const selectedPackage = useMemo(() => {
    return packages?.find(
      (p) => p.subscriptionPeriod === selectedSubscriptionPeriod,
    );
  }, [packages, selectedSubscriptionPeriod]);

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

  const subscribe = useCallback(async () => {
    if (!subscribeButtonEnabled) {
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
    selectedSubscriptionPeriod,
    subscribeButtonEnabled,
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

  return (
    <>
      <Theme name="dark">
        <Page.CloseButton />
        <Stack position="absolute" right="$5" top={top || '$5'} zIndex="$5">
          <IconButton
            onPress={() => {
              // navigation.push(EModalRoutes.PrimeModal, {
              //   screen: EPrimePages.PrimeFeatures,
              // });

              navigation.push(EPrimePages.PrimeFeatures, {
                showAllFeatures: true,
                selectedFeature: EPrimeFeatures.OneKeyCloud,
                selectedSubscriptionPeriod,
                serverUserInfo,
              });
            }}
            icon="QuestionmarkOutline"
            variant="tertiary"
          />
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
              <PrimeBanner />
              {isLoggedInMaybe ? <PrimeUserInfo /> : null}
            </Stack>

            {shouldShowSubscriptionPlans ? (
              <Stack p="$5" gap="$2">
                <PrimeSubscriptionPlans
                  packages={packages}
                  selectedSubscriptionPeriod={selectedSubscriptionPeriod}
                  onSubscriptionPeriodSelected={setSelectedSubscriptionPeriod}
                />
              </Stack>
            ) : null}

            {isReady ? (
              <>
                <PrimeBenefitsList
                  selectedSubscriptionPeriod={selectedSubscriptionPeriod}
                  networkId={route.params?.networkId}
                  serverUserInfo={serverUserInfo}
                />
              </>
            ) : (
              <Spinner my="$10" />
            )}

            <YStack px="$5" py="$4" gap="$4">
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
              <Stack
                flexDirection="row-reverse"
                justifyContent="space-between"
                alignItems="center"
                gap="$2.5"
                p="$5"
                $md={{
                  alignItems: 'flex-start',
                  flexDirection: 'column',
                }}
              >
                <Page.FooterActions
                  p="$0"
                  $md={{
                    width: '100%',
                  }}
                  confirmButtonProps={
                    shouldShowConfirmButton
                      ? {
                          loading: isSubscribeLazyLoading,
                          disabled: !subscribeButtonEnabled,
                        }
                      : undefined
                  }
                  onConfirm={shouldShowConfirmButton ? subscribe : undefined}
                  onConfirmText={(() => {
                    if (!packages?.length) {
                      return intl.formatMessage({
                        id: ETranslations.prime_subscribe,
                      });
                    }
                    return selectedSubscriptionPeriod === 'P1Y'
                      ? intl.formatMessage(
                          {
                            id: ETranslations.prime_subscribe_yearly_price,
                          },
                          {
                            price: selectedPackage?.pricePerYearString,
                          },
                        )
                      : intl.formatMessage(
                          {
                            id: ETranslations.prime_subscribe_monthly_price,
                          },
                          {
                            price: selectedPackage?.pricePerMonthString,
                          },
                        );
                  })()}
                />
                {shouldShowConfirmButton ? <PrimeTermsAndPrivacy /> : null}
              </Stack>
            </Page.Footer>
          ) : null}
        </Page>
      </Theme>
    </>
  );
}
