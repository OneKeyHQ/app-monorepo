import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Divider,
  HeightTransition,
  Icon,
  Image,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EOneKeyDeviceMode } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { OnboardingPage } from '../components/Layout';
import {
  useConnectDeviceError,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';
import { OnboardingTestIDs } from '../testIDs';
import { getForceTransportType } from '../utils';

import type { SearchDevice } from '@onekeyfe/hd-core';

// DEBUG(pro2): the bulk of OneKey Pro 2 onboarding work happens on this page, so
// while it's under active development we keep an already-initialized device parked
// on DeviceSetup instead of auto-jumping to FinalizeWalletSetup after the check
// passes. Flip back to false (or delete the guard at its use site) to restore the
// production flash-through behavior.
const DEBUG_DISABLE_AUTO_FINALIZE = true;

enum EDeviceSetupState {
  // Initial device-status check in flight (also the brief "flash" state shown
  // to already-initialized devices right before they jump to Finalize).
  Checking = 'checking',
  // Device is not initialized: show the on-device setup instructions + Done.
  NeedSetup = 'needSetup',
  // Connection / permission error surfaced via useConnectDeviceError.
  Error = 'error',
  // Device initialized: navigating to FinalizeWalletSetup.
  Success = 'success',
}

function DeviceSetupPage({
  route,
}: IPageScreenProps<IOnboardingParamListV2, EOnboardingPagesV2.DeviceSetup>) {
  const intl = useIntl();
  const { deviceData, tabValue, isFirmwareVerified } = route?.params ?? {};
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();

  const [currentDevice, setCurrentDevice] = useState<SearchDevice | undefined>(
    deviceData?.device as SearchDevice | undefined,
  );
  const [setupState, setSetupState] = useState<EDeviceSetupState>(
    EDeviceSetupState.Checking,
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  // Pending "jump to FinalizeWalletSetup" timer for the already-initialized
  // flash path; cleared on unmount so a back-press mid-flash cannot navigate
  // after this page is gone.
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getActiveDevice } = useDeviceConnect({ setCurrentDevice });

  const ensureTransportType = useCallback(async () => {
    if (!tabValue) {
      return;
    }
    const forceTransportType = await getForceTransportType(tabValue);
    if (forceTransportType) {
      await backgroundApiProxy.serviceHardware.setForceTransportType({
        forceTransportType,
      });
    }
  }, [tabValue]);

  const deviceImage = useMemo(() => {
    const device = currentDevice as SearchDevice;
    const deviceType = device?.deviceType || EDeviceType.Pro;
    return HwWalletAvatarImages[deviceType];
  }, [currentDevice]);

  const DEVICE_SETUP_INSTRUCTIONS = useMemo(() => {
    const deviceType = (currentDevice as SearchDevice)?.deviceType;
    const isClassicOrMini =
      deviceType === EDeviceType.Classic ||
      deviceType === EDeviceType.Classic1s ||
      deviceType === EDeviceType.ClassicPure ||
      deviceType === EDeviceType.Mini;

    const chooseOptionStep = {
      title: intl.formatMessage({
        id: ETranslations.setup_choose_option_title,
      }),
      details: [
        intl.formatMessage({
          id: ETranslations.setup_choose_option_create_new_wallet,
        }),
        intl.formatMessage({
          id: ETranslations.setup_choose_option_import_wallet,
        }),
      ],
    };

    const pinStep = {
      title: intl.formatMessage({
        id: ETranslations.setup_pin,
      }),
      details: [
        intl.formatMessage({
          id: ETranslations.setup_pin_limit,
        }),
        intl.formatMessage({
          id: ETranslations.setup_pin_reminder,
        }),
      ],
    };

    const recoveryPhraseStep = {
      title: intl.formatMessage({
        id: ETranslations.setup_recovery_phrase,
      }),
      details: [
        intl.formatMessage({
          id: ETranslations.setup_recovery_phrase_write_down,
        }),
        intl.formatMessage({
          id: ETranslations.setup_recovery_phrase_matches,
        }),
        intl.formatMessage({
          id: ETranslations.setup_recovery_phrase_charging,
        }),
        intl.formatMessage({
          id: ETranslations.setup_recovery_phrase_do_not_power_off,
        }),
      ],
    };

    const finishOnboardingOnDevice = {
      title: intl.formatMessage({
        id: ETranslations.setup_recovery_phrase_follow_instructions,
      }),
      details: [] as string[],
    };

    // For Classic or Mini devices, swap the order of PIN and recovery phrase
    if (isClassicOrMini) {
      return [
        chooseOptionStep,
        recoveryPhraseStep,
        pinStep,
        finishOnboardingOnDevice,
      ];
    }

    return [
      chooseOptionStep,
      pinStep,
      recoveryPhraseStep,
      finishOnboardingOnDevice,
    ];
  }, [intl, currentDevice]);

  const checkDeviceInitialized = useCallback(async () => {
    setErrorMessage(undefined);
    setSetupState(EDeviceSetupState.Checking);
    try {
      await ensureTransportType();
      const baseDevice =
        getActiveDevice() ??
        currentDevice ??
        (deviceData?.device as SearchDevice | undefined);
      if (!baseDevice) {
        setSetupState(EDeviceSetupState.NeedSetup);
        return;
      }
      const latestDevice = getActiveDevice() ?? baseDevice;
      setCurrentDevice(latestDevice);
      if (latestDevice.connectId) {
        const [features] = await Promise.all([
          backgroundApiProxy.serviceHardware.getFeaturesWithoutCache({
            connectId: latestDevice.connectId,
          }),
          new Promise<void>((resolve) => {
            setTimeout(resolve, 1200);
          }),
        ]);
        const deviceMode = await deviceUtils.getDeviceModeFromFeatures({
          features,
        });
        if (deviceMode === EOneKeyDeviceMode.notInitialized) {
          setSetupState(EDeviceSetupState.NeedSetup);
          return;
        }
      } else {
        setSetupState(EDeviceSetupState.NeedSetup);
        return;
      }
    } catch {
      // Mirror the original CheckAndUpdate behavior: a failed status read
      // falls back to showing the on-device setup instructions (the user can
      // re-trigger via Done once the device finishes responding). Hard
      // connection/permission errors are surfaced separately through
      // useConnectDeviceError below.
      setSetupState(EDeviceSetupState.NeedSetup);
      return;
    }
    setSetupState(EDeviceSetupState.Success);
    // DEBUG(pro2): gate the auto-navigation so the page stays put for debugging.
    if (!DEBUG_DISABLE_AUTO_FINALIZE) {
      const deviceForFinalize =
        getActiveDevice() ??
        currentDevice ??
        (deviceData?.device as SearchDevice | undefined);
      navigateTimeoutRef.current = setTimeout(() => {
        navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
          deviceData: {
            ...deviceData,
            device: (deviceForFinalize ?? currentDevice) as SearchDevice,
          },
          isFirmwareVerified,
        });
      }, 1200);
    }
  }, [
    ensureTransportType,
    getActiveDevice,
    currentDevice,
    deviceData,
    navigation,
    isFirmwareVerified,
  ]);

  const handleDeviceSetupDone = useCallback(() => {
    void checkDeviceInitialized();
  }, [checkDeviceInitialized]);

  // Run the device-status check on mount. Already-initialized devices flash
  // through to FinalizeWalletSetup; not-initialized devices land on the
  // instructions.
  useEffect(() => {
    void checkDeviceInitialized();
    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defense in depth: clear forceTransportType when this page is removed so an
  // abandoned onboarding (exit while on DeviceSetup) cannot leak the forced
  // transport into later device connections. CheckAndUpdate and
  // FinalizeWalletSetup also clear on their own exits; clearing is idempotent.
  useEffect(() => {
    const unsubscribe = reactNavigation.addListener('beforeRemove', () => {
      void backgroundApiProxy.serviceHardware.clearForceTransportType();
    });
    return unsubscribe;
  }, [reactNavigation]);

  useConnectDeviceError(
    useCallback(
      (errorMessageId: ETranslations) => {
        setErrorMessage(intl.formatMessage({ id: errorMessageId }));
        setSetupState(EDeviceSetupState.Error);
      },
      [intl],
    ),
  );

  return (
    <OnboardingPage
      testID={OnboardingTestIDs.deviceSetupPage}
      headerTitle={intl.formatMessage({
        id: ETranslations.check_and_update,
      })}
      scrollable
      alignTop
      narrow
      contentContainerProps={{ gap: '$10' }}
    >
      <YStack>
        <XStack alignItems="center" gap="$5">
          <YStack
            w="$16"
            h="$16"
            borderRadius="$2"
            bg="$bg"
            borderCurve="continuous"
            $platform-web={{
              boxShadow:
                '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
            }}
            $theme-dark={{
              bg: '$whiteA1',
              borderWidth: 1,
              borderColor: '$neutral3',
            }}
            $platform-native={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '$neutral3',
            }}
            $platform-ios={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 0.5 },
              shadowOpacity: 0.2,
              shadowRadius: 0.5,
            }}
            $platform-android={{ elevation: 0.5 }}
            alignItems="center"
            justifyContent="center"
          >
            <Image source={deviceImage} width={48} height={48} />
            <YStack
              position="absolute"
              right={-9}
              bottom={-9}
              w={26}
              h={26}
              borderWidth={1}
              bg="$bg"
              borderRadius="$full"
              borderColor="$borderSubdued"
              alignItems="center"
              justifyContent="center"
            >
              <AnimatePresence exitBeforeEnter initial={false}>
                {setupState === EDeviceSetupState.Checking ? (
                  <Spinner
                    key="spinner"
                    size="small"
                    animation="quick"
                    animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                    enterStyle={{ scale: 0.7, opacity: 0 }}
                    exitStyle={{ scale: 0.7, opacity: 0 }}
                    scale={0.8}
                  />
                ) : null}
                {setupState === EDeviceSetupState.Error ? (
                  <YStack
                    animation="quick"
                    animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                    enterStyle={{ scale: 0.8, opacity: 0 }}
                    exitStyle={{ scale: 0.8, opacity: 0 }}
                    key="error"
                  >
                    <Icon
                      name="CrossedSmallOutline"
                      color="$iconCritical"
                      size="$5"
                    />
                  </YStack>
                ) : null}
                {setupState === EDeviceSetupState.NeedSetup ? (
                  <YStack
                    animation="quick"
                    animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                    enterStyle={{ scale: 0.8, opacity: 0 }}
                    exitStyle={{ scale: 0.8, opacity: 0 }}
                    key="warning"
                  >
                    <Icon
                      name="InfoCircleOutline"
                      color="$iconInfo"
                      size="$5"
                    />
                  </YStack>
                ) : null}
                {setupState === EDeviceSetupState.Success ? (
                  <YStack
                    animation="quick"
                    animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                    enterStyle={{ scale: 0.8, opacity: 0 }}
                    exitStyle={{ scale: 0.8, opacity: 0 }}
                    key="checkmark"
                  >
                    <Icon
                      name="Checkmark2SmallOutline"
                      color="$iconSuccess"
                      size="$5"
                    />
                  </YStack>
                ) : null}
              </AnimatePresence>
            </YStack>
          </YStack>
          <YStack gap="$1" flex={1}>
            <SizableText size="$headingSm">
              {intl.formatMessage({
                id: ETranslations.device_setup_check_title,
              })}
            </SizableText>
            <SizableText color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.device_setup_check_desc,
              })}
            </SizableText>
          </YStack>
        </XStack>
        <HeightTransition initialHeight={0}>
          {setupState === EDeviceSetupState.NeedSetup ? (
            <YStack pt="$8" gap="$5">
              <SizableText size="$bodyMdMedium" color="$textInfo">
                {intl.formatMessage({
                  id: ETranslations.setup_device_prompt,
                })}
              </SizableText>
              {DEVICE_SETUP_INSTRUCTIONS.map((instruction, idx) => (
                <YStack key={instruction.title} gap="$5">
                  <Divider />
                  <YStack gap={instruction.details.length ? '$2' : undefined}>
                    <XStack gap="$2">
                      <YStack
                        w="$5"
                        h="$5"
                        borderRadius="$1"
                        borderCurve="continuous"
                        bg="$bgStrong"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <SizableText textAlign="center">{idx + 1}</SizableText>
                      </YStack>
                      <SizableText size="$bodyMdMedium" flex={1}>
                        {instruction.title}
                      </SizableText>
                    </XStack>
                    {instruction.details.map((detail) => (
                      <XStack key={detail} gap="$2">
                        <YStack
                          w="$5"
                          h="$5"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <YStack
                            w={5}
                            h={5}
                            borderRadius="$full"
                            bg="$iconDisabled"
                          />
                        </YStack>
                        <SizableText color="$textSubdued" flex={1}>
                          {detail}
                        </SizableText>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>
              ))}
              <Button
                testID={OnboardingTestIDs.deviceSetupDoneBtn}
                variant="primary"
                $platform-native={{
                  size: 'large',
                }}
                onPress={handleDeviceSetupDone}
              >
                {intl.formatMessage({
                  id: ETranslations.global_done,
                })}
              </Button>
            </YStack>
          ) : null}
          {setupState === EDeviceSetupState.Error ? (
            <XStack
              gap="$2"
              mt="$4"
              pt="$4"
              borderWidth={0}
              borderTopWidth={StyleSheet.hairlineWidth}
              borderTopColor="$borderSubdued"
              alignItems="center"
            >
              <SizableText
                size="$bodyMdMedium"
                color="$textCritical"
                flex={1}
                textAlign="left"
              >
                {errorMessage ??
                  intl.formatMessage({
                    id: ETranslations.global_an_error_occurred,
                  })}
              </SizableText>
              <Button
                testID={OnboardingTestIDs.deviceSetupRetryBtn}
                variant="primary"
                onPress={handleDeviceSetupDone}
              >
                {intl.formatMessage({
                  id: ETranslations.global_retry,
                })}
              </Button>
            </XStack>
          ) : null}
        </HeightTransition>
      </YStack>
    </OnboardingPage>
  );
}

export default function DeviceSetup({
  route,
  navigation,
}: IPageScreenProps<IOnboardingParamListV2, EOnboardingPagesV2.DeviceSetup>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home, // TODO read from router
      }}
    >
      <DeviceSetupPage route={route} navigation={navigation} />
    </AccountSelectorProviderMirror>
  );
}
