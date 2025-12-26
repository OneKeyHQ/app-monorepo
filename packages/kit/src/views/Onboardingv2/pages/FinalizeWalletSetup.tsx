import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useThrottledCallback } from 'use-debounce';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Image,
  LinearGradient,
  Page,
  SizableText,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EOnboardingPagesV2,
  ERootRoutes,
  type IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';
import { EMnemonicType } from '@onekeyhq/shared/src/utils/secret';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { withPromptPasswordVerify } from '../../../utils/passwordUtils';
import { OnboardingLayout } from '../components/OnboardingLayout';
import {
  useConnectDeviceError,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';

import type { SearchDevice } from '@onekeyfe/hd-core';

const MatrixBackground = ({
  lineCount = 30,
  charsPerLine = 60,
  updateInterval = 200,
  characterSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
}: {
  lineCount?: number;
  charsPerLine?: number;
  updateInterval?: number;
  characterSet?: string;
}) => {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    // generate lines of random characters
    const generateLines = () => {
      const newLines: string[] = [];

      for (let i = 0; i < lineCount; i += 1) {
        let line = '';
        for (let j = 0; j < charsPerLine; j += 1) {
          line += characterSet[Math.floor(Math.random() * characterSet.length)];
        }
        newLines.push(line);
      }
      setLines(() => newLines);
    };

    generateLines();

    // update all characters at regular intervals
    const interval = setInterval(generateLines, updateInterval);

    return () => clearInterval(interval);
  }, [lineCount, charsPerLine, updateInterval, characterSet]);

  return (
    <YStack>
      {lines.map((line, idx) => (
        <SizableText
          textAlign="center"
          fontFamily="$monoRegular"
          letterSpacing={2}
          key={idx}
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {line}
        </SizableText>
      ))}
    </YStack>
  );
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

type IStepData = { pathData: string; title: string } | null;

// Regular wallet setup steps
const STEPS_DATA: Partial<Record<EFinalizeWalletSetupSteps, IStepData>> = {
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
  [EFinalizeWalletSetupSteps.EncryptingData]: {
    pathData:
      'M31 19V12C31 8.134 27.866 5 24 5C20.134 5 17 8.134 17 12V19M24 28V34M15 43H33C36.3138 43 39 40.3138 39 37V25C39 21.6862 36.3138 19 33 19H15C11.6863 19 9 21.6862 9 25V37C9 40.3138 11.6863 43 15 43Z',
    title: appLocale.intl.formatMessage({
      id: ETranslations.onboarding_finalize_encrypting_data,
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
  const borderDisabledColor = theme.borderDisabled.val;
  const borderActiveColor = theme.borderActive.val;
  const neutral1Color = theme.neutral1.val;
  const neutral4Color = theme.neutral4.val;
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

  const initialStep = EFinalizeWalletSetupSteps.CreatingWallet;

  const [currentStep, setCurrentStep] =
    useState<EFinalizeWalletSetupSteps>(initialStep);
  const progress = useSharedValue(0);
  const pathLength = 150;

  // 队列管理
  const stepQueue = useRef<EFinalizeWalletSetupSteps[]>([initialStep]);
  const isProcessing = useRef(false);

  const animatedProps = useAnimatedProps(() => {
    // eslint-disable-next-line spellcheck/spell-checker
    const strokeDashoffset = pathLength * (1 - progress.value);

    return {
      // eslint-disable-next-line spellcheck/spell-checker
      strokeDashoffset,
      // eslint-disable-next-line spellcheck/spell-checker
      strokeDasharray: pathLength,
    };
  });

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

  const handleWalletSetupReadyInner = useCallback(async () => {
    setTimeout(() => {
      closePage();
    }, 1000);
  }, [closePage]);

  const handleWalletSetupReady = useThrottledCallback(
    handleWalletSetupReadyInner,
    500,
    { leading: true, trailing: false },
  );

  const changeIdProgress = useCallback((value: boolean) => {
    isProcessing.current = value;
  }, []);

  const stepQueueIndex = useRef<number>(0);
  const processNextStep = useCallback(() => {
    if (isProcessing.current || stepQueue.current.length === 0) {
      return;
    }
    isProcessing.current = true;
    const nextStep = stepQueue.current[stepQueueIndex.current];
    if (!nextStep) {
      setTimeout(() => {
        isProcessing.current = false;
        void processNextStep();
      }, 250);
      return;
    }
    if (nextStep === EFinalizeWalletSetupSteps.Ready) {
      setTimeout(() => {
        void handleWalletSetupReady();
      }, 150);
      return;
    }
    setCurrentStep(nextStep);
    setTimeout(() => {
      stepQueueIndex.current += 1;
      progress.value = 0;
      progress.value = withTiming(
        1,
        {
          duration: 2000,
          easing: Easing.linear,
        },
        (finished) => {
          if (finished) {
            runOnJS(setCurrentStep)(nextStep);
            runOnJS(changeIdProgress)(false);
            runOnJS(processNextStep)();
          }
        },
      );
    }, 150);
  }, [changeIdProgress, handleWalletSetupReady, progress]);

  const goNextStep = useCallback((step: EFinalizeWalletSetupSteps) => {
    if (!stepQueue.current.includes(step)) {
      stepQueue.current.push(step);
    }
  }, []);

  const actions = useAccountSelectorActions();

  const { connectDevice, createHWWallet } = useDeviceConnect();
  const createWallet = useCallback(async () => {
    try {
      // **** hd wallet case
      if (mnemonic && !created.current) {
        await withPromptPasswordVerify({
          run: async () => {
            if (mnemonicType === EMnemonicType.TON) {
              // TODO check TON case
              // **** TON mnemonic case
              // Create TON imported account when mnemonicType is TON
              await actions.current.createTonImportedWallet({ mnemonic });
              goNextStep(EFinalizeWalletSetupSteps.EncryptingData);
              await timerUtils.wait(2200);
              goNextStep(EFinalizeWalletSetupSteps.GeneratingAccounts);
              await timerUtils.wait(2200);
              goNextStep(EFinalizeWalletSetupSteps.Ready);
              return;
            }
            await actions.current.createHDWallet({
              mnemonic,
              isWalletBackedUp,
            });
          },
        });
        created.current = true;
      } else if (deviceData && isFirmwareVerified !== undefined) {
        await connectDevice(deviceData.device as SearchDevice);
        await createHWWallet({
          device: deviceData.device as SearchDevice,
          isFirmwareVerified,
        });
      } else if (keylessPackSetId && !created.current) {
        // Create keyless wallet
        await actions.current.createKeylessWallet({
          packSetId: keylessPackSetId,
        });
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
    mnemonicType,
    actions,
    isWalletBackedUp,
    goNextStep,
    connectDevice,
    createHWWallet,
    keylessPackSetId,
  ]);

  useEffect(() => {
    processNextStep();
    void createWallet();
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
    stepQueueIndex.current = 0;
    setTimeout(() => {
      void createWallet();
    });
  }, [createWallet, initialStep]);

  const currentStepData =
    STEPS_DATA[currentStep] ||
    STEPS_DATA[EFinalizeWalletSetupSteps.EncryptingData];

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
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          showBackButton={false}
          showLanguageSelector={false}
        />
        <OnboardingLayout.Body constrained={false} scrollable={false}>
          {setupError ? (
            <YStack
              gap="$4"
              alignSelf="center"
              w="100%"
              maxWidth="$96"
              h="100%"
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
          {!setupError && currentStepData ? (
            <YStack w="100%" h="100%">
              <YStack
                position="absolute"
                left="50%"
                top="50%"
                x="-50%"
                y="-50%"
                opacity={0.15}
              >
                <MatrixBackground
                  {...(platformEnv.isNative && { lineCount: 60 })}
                />
                {!platformEnv.isNativeAndroid ? svgMask : null}
              </YStack>
              {platformEnv.isNativeAndroid ? svgMask : null}
              <YStack
                animation="quick"
                animateOnly={['opacity']}
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
                          animateOnly={['transform', 'opacity']}
                          enterStyle={{
                            y: 4,
                            opacity: 0,
                          }}
                          exitStyle={{
                            y: -4,
                            opacity: 0,
                          }}
                        >
                          <Svg width="48" height="48" viewBox="0 0 48 48">
                            <Path
                              d={currentStepData.pathData}
                              stroke={borderDisabledColor}
                              strokeWidth="2"
                              fill="none"
                            />

                            <AnimatedPath
                              d={currentStepData.pathData}
                              stroke={borderActiveColor}
                              fill="none"
                              stroke-width="2"
                              stroke-linecap="square"
                              stroke-linejoin="round"
                              animatedProps={animatedProps}
                            />
                          </Svg>
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
                    animateOnly={['transform', 'opacity']}
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
                    {currentStepData?.title || ''}
                  </SizableText>
                </AnimatePresence>
              </YStack>
            </YStack>
          ) : null}
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.do_not_exit_app_during_setup,
            })}
          </SizableText>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
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
