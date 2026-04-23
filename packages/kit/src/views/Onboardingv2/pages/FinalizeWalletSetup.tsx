import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Image,
  LinearGradient,
  SizableText,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import type {
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EOnboardingPagesV2,
  ERootRoutes,
  type IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { getKeylessOnboardingPin } from '../../../components/KeylessWallet/useKeylessWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useKeylessWebFlowAutoConnectDapp } from '../../../hooks/useWebDapp/useKeylessWebFlow';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { withPromptPasswordVerify } from '../../../utils/passwordUtils';
import { OnboardingPage } from '../components/Layout';
import {
  useConnectDeviceError,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';

import MatrixBackground from './MatrixBackground';

import type { SearchDevice } from '@onekeyfe/hd-core';

// React Navigation's default Android screen transition is ~300ms.
// Deferring worklet-heavy operations by this amount prevents a collision
// between outgoing screen cleanup and incoming animated props registration,
// which can trigger SIGSEGV in Value::~Value on Fabric/New Architecture.
const NAVIGATION_TRANSITION_SETTLE_MS = 300;

// Slow-step hint thresholds. ConnectingDevice gets more slack because hardware
// prompts legitimately take longer than the backend pipeline.
const SLOW_THRESHOLD_DEFAULT_MS = 8000;
const SLOW_THRESHOLD_CONNECTING_MS = 12_000;

type IStepData = { pathData: string; title: string } | null;

// Step definitions aligned with real backend phases (see spec).
// EncryptingData is intentionally omitted — there is no corresponding real work.
const STEPS_DATA: Partial<Record<EFinalizeWalletSetupSteps, IStepData>> = {
  [EFinalizeWalletSetupSteps.ConnectingDevice]: {
    // NOTE: pathData below is a working placeholder (rounded square + plus
    // shape, roughly "device slot"). Designer to provide the final icon in
    // a follow-up visual pass. The 48×48 viewBox is fixed.
    pathData:
      'M10 14C10 11.7909 11.7909 10 14 10H34C36.2091 10 38 11.7909 38 14V34C38 36.2091 36.2091 38 34 38H14C11.7909 38 10 36.2091 10 34V14ZM18 24H30M24 18V30',
    // TODO(i18n): replace with ETranslations.onboarding_finalize_connecting_device once Lokalise key is created
    title: 'Connecting to device',
  },
  [EFinalizeWalletSetupSteps.CreatingWallet]: {
    pathData:
      'M7 12V35C7 38.3138 9.6863 41 13 41H35C38.3138 41 41 38.3138 41 35V23C41 19.6863 38.3138 17 35 17H33M7 12C7 14.7614 9.23858 17 12 17H33M7 12C7 9.23858 9.23858 7 12 7H28.6666C31.06 7 33 8.9401 33 11.3333V17M35 29C35 31.2091 33.2091 33 31 33C28.7909 33 27 31.2091 27 29C27 26.7909 28.7909 25 31 25C33.2091 25 35 26.7909 35 29Z',
    title: appLocale.intl.formatMessage({
      id: ETranslations.onboarding_finalize_creating_wallet,
    }),
  },
  [EFinalizeWalletSetupSteps.GeneratingAccounts]: {
    pathData:
      'M31.9971 13C31.9971 17.4183 28.4153 21 23.9971 21C19.5788 21 15.9971 17.4183 15.9971 13C15.9971 8.58172 19.5788 5 23.9971 5C28.4153 5 31.9971 8.58172 31.9971 13ZM23.9974 25C17.3083 25 12.1116 28.9362 9.58956 34.6762C8.17334 37.8996 11.0262 41 14.5469 41H33.4478C36.9686 41 39.8214 37.8996 38.4052 34.6762C35.883 28.9362 30.6864 25 23.9974 25Z',
    title: appLocale.intl.formatMessage({
      id: ETranslations.onboarding_finalize_generating_accounts,
    }),
  },
  [EFinalizeWalletSetupSteps.Ready]: null,
};

const fixErrorString = (errorMessage: string) => {
  if (errorMessage.toLowerCase() === 'no wallet creation strategy') {
    return ETranslations.hardware_user_cancel_error;
  }
  return errorMessage;
};
function FinalizeWalletSetupPage({
  route,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.FinalizeWalletSetup
>) {
  const {
    activeAccount: { wallet: _wallet },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const navigation = useAppNavigation();
  const theme = useTheme();
  const bgAppColor = theme.bgApp.val;
  const borderActiveColor = theme.borderActive.val;
  const neutral1Color = theme.neutral1.val;
  const neutral4Color = theme.neutral4.val;
  const iconSuccessColor = theme.iconSuccess.val;
  const [setupError, setSetupError] = useState<
    | {
        messageId: ETranslations;
      }
    | undefined
  >(undefined);

  const created = useRef(false);
  const mnemonic = route?.params?.mnemonic;
  const mnemonicType = route?.params?.mnemonicType;
  const keylessPackSetId = route?.params?.keylessPackSetId;
  const deviceData = route?.params?.deviceData;
  const isFirmwareVerified = route?.params?.isFirmwareVerified;
  const isWalletBackedUp = route?.params?.isWalletBackedUp;
  const isKeylessWallet = route?.params?.isKeylessWallet;
  const keylessDetailsInfo = route?.params?.keylessDetailsInfo;
  const shouldAutoResetKeylessPinAfterRestore =
    route?.params?.shouldAutoResetKeylessPinAfterRestore;

  // Hardware path starts with "Connecting to device" because connectDevice()
  // runs before the backend wallet creation pipeline emits any events.
  const initialStep = route?.params?.deviceData
    ? EFinalizeWalletSetupSteps.ConnectingDevice
    : EFinalizeWalletSetupSteps.CreatingWallet;

  const [currentStep, setCurrentStep] =
    useState<EFinalizeWalletSetupSteps>(initialStep);

  // Step queue — starts empty; real backend events fill it as they arrive.
  const stepQueue = useRef<EFinalizeWalletSetupSteps[]>([]);

  const [isStepSlow, setIsStepSlow] = useState(false);

  useEffect(() => {
    setIsStepSlow(false);
    // Don't surface a slow hint on the terminal Ready state.
    if (currentStep === EFinalizeWalletSetupSteps.Ready) {
      return;
    }
    const threshold =
      currentStep === EFinalizeWalletSetupSteps.ConnectingDevice
        ? SLOW_THRESHOLD_CONNECTING_MS
        : SLOW_THRESHOLD_DEFAULT_MS;
    const timer = setTimeout(() => setIsStepSlow(true), threshold);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const closePageCalled = useRef(false);

  const closePage = useCallback(() => {
    closePageCalled.current = true;
    void backgroundApiProxy.serviceHardware.clearForceTransportType();
    navigation.navigate(ERootRoutes.Main, undefined, {
      pop: true,
    });
  }, [navigation]);

  const isFirstCreateWallet = useRef(false);
  const readIsFirstCreateWallet = async () => {
    const { isOnboardingDone } =
      await backgroundApiProxy.serviceOnboarding.isOnboardingDone();
    isFirstCreateWallet.current = !isOnboardingDone;
  };

  const {
    setPendingKeylessAutoConnectWalletId,
    openKeylessAutoConnectDappModal,
  } = useKeylessWebFlowAutoConnectDapp();

  const unmountedRef = useRef(false);
  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    [],
  );

  // Ready state waits for the user's Let's-go press instead of auto-closing.
  // The 600ms after closePage gives the page-dismiss animation time to finish
  // before the auto-connect dapp modal appears on top of the main screen.
  const handleLetsGo = useCallback(() => {
    closePage();
    setTimeout(() => {
      if (unmountedRef.current) return;
      void openKeylessAutoConnectDappModal();
    }, 600);
  }, [closePage, openKeylessAutoConnectDappModal]);

  // Step transitions are driven purely by real events.
  // No animation lock, no polling — whenever goNextStep pushes, we react.
  const processNextStep = useCallback(() => {
    while (stepQueue.current.length > 0) {
      const nextStep = stepQueue.current.shift();
      if (nextStep) {
        setCurrentStep(nextStep);
      }
    }
  }, []);

  const goNextStep = useCallback(
    (step: EFinalizeWalletSetupSteps) => {
      if (!stepQueue.current.includes(step)) {
        stepQueue.current.push(step);
      }
      processNextStep();
    },
    [processNextStep],
  );

  const actions = useAccountSelectorActions();

  const { connectDevice, createHWWallet } = useDeviceConnect();
  const createWallet = useCallback(async () => {
    try {
      let hdWalletCreatedResult:
        | {
            wallet: IDBWallet;
            indexedAccount: IDBIndexedAccount | undefined;
            isOverrideWallet: boolean | undefined;
          }
        | undefined;
      // **** hd wallet case
      if (mnemonic && !created.current) {
        await withPromptPasswordVerify({
          run: async () => {
            if (mnemonicType === EMnemonicType.TON) {
              // createTonImportedWallet now emits CreatingWallet + Ready events itself
              // (with a 1s floor). UI advances via appEventBus listener, no manual sequencing.
              await actions.current.createTonImportedWallet({ mnemonic });
              return;
            }
            const shouldRunAutoReset =
              !!isKeylessWallet && !!shouldAutoResetKeylessPinAfterRestore;
            hdWalletCreatedResult = await actions.current.createHDWallet({
              mnemonic,
              isWalletBackedUp,
              isKeylessWallet,
              keylessDetailsInfo,
            });
            if (shouldRunAutoReset) {
              void (async () => {
                try {
                  if (!keylessDetailsInfo?.keylessOwnerId) {
                    return;
                  }
                  const refreshResult =
                    await backgroundApiProxy.serviceKeylessWallet.tryRefreshTokenFromStorage(
                      {
                        ownerId: keylessDetailsInfo?.keylessOwnerId,
                        forceRefresh: true,
                      },
                    );
                  if (
                    !refreshResult?.accessToken ||
                    !refreshResult?.refreshToken
                  ) {
                    return;
                  }
                  const [token, refreshToken, pin] = await Promise.all([
                    refreshResult.accessToken,
                    refreshResult.refreshToken,
                    getKeylessOnboardingPin(),
                  ]);
                  if (!token || !pin || !refreshToken) {
                    console.error(
                      'Skip keyless auto reset pin: missing onboarding token or pin.',
                    );
                    return;
                  }

                  await backgroundApiProxy.serviceKeylessWallet.autoResetKeylessWalletPinAfterRestoreForSameEmailAccount(
                    {
                      token,
                      refreshToken: refreshToken || undefined,
                      pin,
                    },
                  );
                } catch (autoResetError) {
                  console.error(
                    'autoResetKeylessWalletPinAfterRestoreForSameEmailAccount error:',
                    autoResetError,
                  );
                }
              })();
            }

            // const { wallet: createdWallet } =
            //   await actions.current.createHDWallet({
            //     mnemonic,
            //     isWalletBackedUp,
            //     isKeylessWallet,
            //     keylessDetailsInfo,
            //   });
            // Track keyless wallet creation success
            if (isKeylessWallet && keylessDetailsInfo) {
              defaultLogger.account.wallet.walletAdded({
                status: 'success',
                addMethod: 'CreateKeylessWallet',
                isSoftwareWalletOnlyUser: true,
                details: {
                  provider:
                    keylessDetailsInfo.keylessProvider ===
                    EOAuthSocialLoginProvider.Google
                      ? 'google'
                      : 'apple',
                },
              });

              if (
                platformEnv.isExtension &&
                accountUtils.isKeylessWallet({
                  walletId: hdWalletCreatedResult?.wallet.id,
                })
              ) {
                setPendingKeylessAutoConnectWalletId(
                  hdWalletCreatedResult?.wallet.id,
                );
              }
            }
          },
        });
        created.current = true;
      } else if (deviceData && isFirmwareVerified !== undefined) {
        // Show "Connecting to device" while the transport is being established
        // and the user confirms on the device. Backend emits CreatingWallet once
        // createHWWallet enters withFinalizeWalletSetupStep.
        goNextStep(EFinalizeWalletSetupSteps.ConnectingDevice);
        await connectDevice(deviceData.device as SearchDevice);
        await createHWWallet({
          device: deviceData.device as SearchDevice,
          isFirmwareVerified,
        });
      } else if (keylessPackSetId && !created.current) {
        // Create keyless wallet
        // await actions.current.createKeylessWallet({
        //   packSetId: keylessPackSetId,
        // });
        created.current = true;
      }
    } catch (error) {
      console.error('createWallet error:', error);
      const hardwareError = error as {
        messageId: ETranslations;
        message: string;
      };
      setSetupError({
        messageId: fixErrorString(
          hardwareError
            ? hardwareError.messageId ||
                hardwareError.message ||
                ETranslations.global_unknown_error
            : ETranslations.global_unknown_error,
        ) as ETranslations,
      });
    }
  }, [
    mnemonic,
    deviceData,
    isFirmwareVerified,
    keylessPackSetId,
    mnemonicType,
    actions,
    isWalletBackedUp,
    isKeylessWallet,
    keylessDetailsInfo,
    shouldAutoResetKeylessPinAfterRestore,
    connectDevice,
    createHWWallet,
    setPendingKeylessAutoConnectWalletId,
    goNextStep,
  ]);

  useEffect(() => {
    // Defer createWallet until after navigation transition completes.
    // Queue starts empty; backend events drive all step transitions.
    void timerUtils.setTimeoutPromised(() => {
      if (!unmountedRef.current) {
        void createWallet();
      }
    }, NAVIGATION_TRANSITION_SETTLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentStep === EFinalizeWalletSetupSteps.CreatingWallet) {
      void readIsFirstCreateWallet();
    }
  }, [currentStep]);

  useEffect(() => {
    const fn = (
      event: IAppEventBusPayload[EAppEventBusNames.FinalizeWalletSetupStep],
    ) => {
      console.log('FinalizeWalletSetupStep', event.step);
      goNextStep(event.step);
    };

    appEventBus.on(EAppEventBusNames.FinalizeWalletSetupStep, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.FinalizeWalletSetupStep, fn);
    };
  }, [goNextStep]);

  useConnectDeviceError(
    useCallback((errorMessageId) => {
      setSetupError({
        messageId: errorMessageId,
      });
    }, []),
  );

  const retrySetup = useCallback(() => {
    setSetupError(undefined);
    setCurrentStep(initialStep);
    stepQueue.current = [];
    setTimeout(() => {
      void createWallet();
    });
  }, [createWallet, initialStep]);

  const isReady = currentStep === EFinalizeWalletSetupSteps.Ready;

  const currentStepData = isReady
    ? null
    : STEPS_DATA[currentStep] ||
      STEPS_DATA[EFinalizeWalletSetupSteps.CreatingWallet];

  let stepIconNode: JSX.Element | null = null;
  if (isReady) {
    stepIconNode = (
      <Svg width="48" height="48" viewBox="0 0 48 48">
        {/* Success checkmark */}
        <Path
          d="M12 24L20 32L36 16"
          stroke={iconSuccessColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  } else if (currentStepData) {
    stepIconNode = (
      <Svg width="48" height="48" viewBox="0 0 48 48">
        <Path
          d={currentStepData.pathData}
          stroke={borderActiveColor}
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    );
  }

  const svgMask = (
    <Svg
      height="100%"
      width="100%"
      style={{
        position: 'absolute',
        inset: 0,
      }}
    >
      <Defs>
        <RadialGradient
          id="finalize-grad"
          cx="50%"
          cy="50%"
          {...(platformEnv.isNative && {
            rx: '60%',
            ry: '30%',
          })}
        >
          <Stop offset="0%" stopColor={bgAppColor} stopOpacity="0" />
          <Stop offset="50%" stopColor={bgAppColor} stopOpacity="0.5" />
          <Stop offset="100%" stopColor={bgAppColor} stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#finalize-grad)" />
    </Svg>
  );

  return (
    <OnboardingPage
      headerBack={false}
      showLanguageSelector={false}
      enterAnimation={false}
    >
      <YStack flex={1}>
        {setupError ? (
          <YStack
            gap="$4"
            alignSelf="center"
            w="100%"
            maxWidth="$96"
            flex={1}
            justifyContent="center"
          >
            <SizableText size="$heading2xl">
              🤔{' '}
              {intl.formatMessage({
                id: ETranslations.failed_to_create_wallet,
              })}
            </SizableText>
            <SizableText size="$bodyLg">
              {intl.formatMessage({
                id: setupError.messageId,
                defaultMessage: setupError.messageId,
              })}
            </SizableText>
            <XStack gap="$2.5" mt="$4">
              <Button
                flex={1}
                variant="primary"
                size="large"
                onPress={retrySetup}
              >
                {intl.formatMessage({
                  id: ETranslations.global_retry,
                })}
              </Button>
              <Button flex={1} size="large" onPress={closePage}>
                {intl.formatMessage({
                  id: ETranslations.global_exit,
                })}
              </Button>
            </XStack>
          </YStack>
        ) : null}
        {!setupError && (currentStepData || isReady) ? (
          <YStack flex={1} w="100%">
            <YStack
              position="absolute"
              left="50%"
              top="50%"
              x="-50%"
              y="-50%"
              opacity={0.15}
            >
              <MatrixBackground />
              {!platformEnv.isNativeAndroid ? svgMask : null}
            </YStack>
            {platformEnv.isNativeAndroid ? svgMask : null}
            <YStack
              animation="quick"
              animateOnly={ANIMATE_ONLY_OPACITY}
              enterStyle={{
                opacity: 0,
              }}
              flex={1}
              alignItems="center"
              justifyContent="center"
              gap="$6"
            >
              <YStack w="$16" h="$16">
                <Image
                  position="absolute"
                  $theme-dark={{
                    opacity: 0.5,
                  }}
                  bottom={0}
                  left="50%"
                  x="-50%"
                  y="50%"
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  source={require('@onekeyhq/kit/assets/onboarding/tiny-shadow-illus.png')}
                  w={87}
                  h={49}
                />
                <YStack
                  w="100%"
                  h="100%"
                  bg="$bg"
                  borderRadius="$2"
                  borderCurve="continuous"
                  alignItems="center"
                  justifyContent="center"
                  $platform-web={{
                    boxShadow:
                      '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 2px rgba(0, 0, 0, 0.10), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
                  }}
                  $theme-dark={{
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: '$borderSubdued',
                  }}
                  $platform-native={{
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: '$borderSubdued',
                  }}
                  $platform-android={{ elevation: 1 }}
                  $platform-ios={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 1,
                  }}
                >
                  <LinearGradient
                    colors={[neutral1Color, neutral4Color]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    w="$14"
                    h="$14"
                    borderRadius="$1"
                    borderCurve="continuous"
                    alignItems="center"
                    justifyContent="center"
                    borderWidth={1}
                    borderColor="$borderSubdued"
                  >
                    <AnimatePresence exitBeforeEnter initial={false}>
                      <YStack
                        key={`icon-${currentStep}`}
                        animation="quick"
                        animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                        enterStyle={{
                          y: 4,
                          opacity: 0,
                        }}
                        exitStyle={{
                          y: -4,
                          opacity: 0,
                        }}
                      >
                        {stepIconNode}
                      </YStack>
                    </AnimatePresence>
                  </LinearGradient>
                </YStack>
              </YStack>
              <AnimatePresence exitBeforeEnter initial={false}>
                <SizableText
                  key={`title-${currentStep}`}
                  size="$heading2xl"
                  textAlign="center"
                  animation="quick"
                  animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                  enterStyle={{
                    y: 8,
                    opacity: 0,
                    filter: 'blur(4px)',
                  }}
                  exitStyle={{
                    y: -8,
                    opacity: 0,
                    filter: 'blur(4px)',
                  }}
                >
                  {isReady
                    ? // TODO(i18n): ETranslations.onboarding_finalize_wallet_ready
                      'Wallet ready'
                    : currentStepData?.title || ''}
                </SizableText>
              </AnimatePresence>
              <AnimatePresence>
                {isStepSlow ? (
                  <SizableText
                    key={`hint-${currentStep}`}
                    size="$bodySm"
                    color="$textSubdued"
                    textAlign="center"
                    animation="quick"
                    animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                    enterStyle={{ y: 8, opacity: 0 }}
                    exitStyle={{ y: -8, opacity: 0 }}
                    mt="$2"
                  >
                    {currentStep === EFinalizeWalletSetupSteps.ConnectingDevice
                      ? // TODO(i18n): ETranslations.onboarding_finalize_check_your_device
                        'Check your device — you may need to confirm'
                      : // TODO(i18n): ETranslations.onboarding_finalize_taking_a_moment
                        'This is taking a moment'}
                  </SizableText>
                ) : null}
              </AnimatePresence>
            </YStack>
          </YStack>
        ) : null}
        {!setupError ? (
          <YStack pt="$4" alignItems="center">
            {isReady ? (
              <Button
                variant="primary"
                size="large"
                onPress={handleLetsGo}
                $md={{ w: '100%' }}
                $gtMd={{ minWidth: 240 }}
              >
                {/* TODO(i18n): ETranslations.onboarding_finalize_lets_go */}
                Let&apos;s go
              </Button>
            ) : (
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.do_not_exit_app_during_setup,
                })}
              </SizableText>
            )}
          </YStack>
        ) : null}
      </YStack>
    </OnboardingPage>
  );
}

export function FinalizeWalletSetup({
  route,
  navigation,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.FinalizeWalletSetup
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <FinalizeWalletSetupPage route={route} navigation={navigation} />
    </AccountSelectorProviderMirror>
  );
}

export default FinalizeWalletSetup;
