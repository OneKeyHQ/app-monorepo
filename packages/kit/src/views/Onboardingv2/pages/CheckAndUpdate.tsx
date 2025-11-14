import { useCallback, useMemo, useRef, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IImageProps, IPageScreenProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  Button,
  Dialog,
  Divider,
  HeightTransition,
  Icon,
  Image,
  Page,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes/onboardingv2';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  EHardwareCallContext,
  EOneKeyDeviceMode,
} from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { useFirmwareUpdateActions } from '../../FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { OnboardingLayout } from '../components/OnboardingLayout';
import {
  useConnectDeviceError,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';
import { getForceTransportType } from '../utils';

import type { KnownDevice, SearchDevice } from '@onekeyfe/hd-core';

enum ECheckAndUpdateStepState {
  Idle = 'idle',
  InProgress = 'inProgress',
  Warning = 'warning',
  Skipped = 'skipped',
  Success = 'success',
  Error = 'error',
}

enum ECheckAndUpdateStepId {
  GenuineCheck = 'genuine-check',
  FirmwareCheck = 'firmware-check',
  SetupOnDevice = 'setup-on-device',
}

function CheckAndUpdatePage({
  route: routeParams,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.CheckAndUpdate
>) {
  const intl = useIntl();
  const { deviceData, tabValue } = routeParams?.params || {};
  console.log('deviceData', deviceData);
  const themeVariant = useThemeVariant();
  const navigation = useAppNavigation();
  const isFirmwareVerifiedRef = useRef<boolean | undefined>(undefined);

  const deviceLabel = useMemo(() => {
    if ((deviceData.device as KnownDevice)?.label) {
      return (deviceData.device as KnownDevice).label;
    }
    return (deviceData.device as SearchDevice).name;
  }, [deviceData]);

  const {
    verifyHardware,
    ensureActiveConnection,
    getActiveDevice,
    ensureStopScan,
  } = useDeviceConnect();
  const [currentDevice, setCurrentDevice] = useState<SearchDevice | undefined>(
    deviceData.device as SearchDevice | undefined,
  );
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
    const device = deviceData.device as SearchDevice;
    const deviceType = device?.deviceType || EDeviceType.Pro;
    return HwWalletAvatarImages[deviceType];
  }, [deviceData]);

  const [steps, setSteps] = useState<
    {
      image: IImageProps['source'];
      id: ECheckAndUpdateStepId;
      title: string;
      description?: string;
      state?: ECheckAndUpdateStepState;
      neededAction?: boolean;
      errorMessage?: string;
    }[]
  >(() => [
    {
      id: ECheckAndUpdateStepId.GenuineCheck,
      image:
        themeVariant === 'light'
          ? require('@onekeyhq/kit/assets/onboarding/genuine-check.png')
          : require('@onekeyhq/kit/assets/onboarding/genuine-check-dark.png'),
      title: intl.formatMessage({
        id: ETranslations.device_auth_request_title,
      }),
      description: intl.formatMessage(
        {
          id: ETranslations.genuine_check_desc,
        },
        { deviceLabel },
      ),
      state: ECheckAndUpdateStepState.Idle,
    },
    {
      id: ECheckAndUpdateStepId.FirmwareCheck,
      image:
        themeVariant === 'light'
          ? require('@onekeyhq/kit/assets/onboarding/firmware-check.png')
          : require('@onekeyhq/kit/assets/onboarding/firmware-check-dark.png'),
      title: intl.formatMessage({
        id: ETranslations.firmware_check,
      }),
      description: intl.formatMessage(
        {
          id: ETranslations.firmware_check_desc,
        },
        { deviceLabel },
      ),
      state: ECheckAndUpdateStepState.Idle,
    },
    {
      id: ECheckAndUpdateStepId.SetupOnDevice,
      image: deviceImage,
      title: intl.formatMessage({ id: ETranslations.device_setup_check_title }),
      description: intl.formatMessage({
        id: ETranslations.device_setup_check_desc,
      }),
      state: ECheckAndUpdateStepState.Idle,
    },
  ]);

  const actions = useFirmwareUpdateActions();
  const toFirmwareUpgradePage = useCallback(() => {
    if (deviceData.device?.connectId) {
      actions.openChangeLogModal({
        connectId: deviceData.device?.connectId,
      });
    }
  }, [actions, deviceData.device?.connectId]);

  const createStepTimeout = useCallback(() => {
    const timeout = setTimeout(() => {
      setSteps((prev) => {
        const newSteps = [...prev];
        const inProgressStep = newSteps.find(
          (step) => step.state === ECheckAndUpdateStepState.InProgress,
        );
        if (inProgressStep) {
          if (inProgressStep.id === ECheckAndUpdateStepId.SetupOnDevice) {
            inProgressStep.state = ECheckAndUpdateStepState.Warning;
          } else {
            inProgressStep.state = ECheckAndUpdateStepState.Error;
            inProgressStep.errorMessage = intl.formatMessage({
              id: ETranslations.swap_history_status_discard,
            });
          }
        }
        return newSteps;
      });
    }, 30 * 1000);
    return () => clearTimeout(timeout);
  }, [intl]);

  const checkDeviceInitialized = useCallback(async () => {
    const setWarningStep = () => {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[2] = {
          ...newSteps[2],
          state: ECheckAndUpdateStepState.Warning,
        };
        return newSteps;
      });
    };
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[2] = {
        ...newSteps[2],
        state: ECheckAndUpdateStepState.InProgress,
      };
      return newSteps;
    });
    try {
      await ensureTransportType();
      const baseDevice =
        getActiveDevice() ??
        currentDevice ??
        (deviceData.device as SearchDevice | undefined);
      if (!baseDevice) {
        setWarningStep();
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
        console.log('deviceMode', deviceMode);
        if (deviceMode === EOneKeyDeviceMode.notInitialized) {
          setWarningStep();
          return;
        }
      } else {
        setWarningStep();
        return;
      }
    } catch (error) {
      setWarningStep();
      throw error;
    }
    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[2] = {
        ...newSteps[2],
        state: ECheckAndUpdateStepState.Success,
      };
      return newSteps;
    });
    const deviceForFinalize =
      getActiveDevice() ??
      currentDevice ??
      (deviceData.device as SearchDevice | undefined);
    setTimeout(async () => {
      navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
        deviceData: {
          ...deviceData,
          device: (deviceForFinalize ?? deviceData.device) as SearchDevice,
        },
        isFirmwareVerified: isFirmwareVerifiedRef.current,
      });
    }, 1200);
  }, [
    currentDevice,
    deviceData,
    ensureTransportType,
    getActiveDevice,
    navigation,
  ]);

  const checkFirmwareUpdate = useCallback(async () => {
    const setDeviceNotFoundErrorMessageStep = () => {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[1] = {
          ...newSteps[1],
          state: ECheckAndUpdateStepState.Error,
          errorMessage: intl.formatMessage({
            id: ETranslations.device_not_connected,
          }),
        };
        return newSteps;
      });
    };
    const cancelTimeout = createStepTimeout();
    await ensureTransportType();
    const baseDevice = getActiveDevice() ?? currentDevice ?? deviceData.device;
    if (!baseDevice?.connectId) {
      cancelTimeout();
      setDeviceNotFoundErrorMessageStep();
      return;
    }
    await ensureActiveConnection(baseDevice as SearchDevice);
    const latestDevice = getActiveDevice() ?? baseDevice;
    setCurrentDevice(latestDevice as SearchDevice);

    if (!latestDevice?.connectId) {
      cancelTimeout();
      setDeviceNotFoundErrorMessageStep();
      return;
    }
    const compatibleConnectId =
      await backgroundApiProxy.serviceHardware.getCompatibleConnectId({
        connectId: latestDevice.connectId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    const r =
      await backgroundApiProxy.serviceFirmwareUpdate.checkAllFirmwareRelease({
        connectId: compatibleConnectId,
        skipCancel: true,
      });
    cancelTimeout();
    if (r) {
      if (r.hasUpgrade) {
        setSteps((prev) => {
          const newSteps = [...prev];
          newSteps[0] = {
            ...newSteps[0],
            state: ECheckAndUpdateStepState.Success,
          };
          newSteps[1] = {
            ...newSteps[1],
            state: r.hasUpgrade
              ? ECheckAndUpdateStepState.Warning
              : ECheckAndUpdateStepState.Success,
          };
          return newSteps;
        });
      } else {
        setSteps((prev) => {
          const newSteps = [...prev];
          newSteps[0] = {
            ...newSteps[0],
            state: ECheckAndUpdateStepState.Success,
          };
          newSteps[1] = {
            ...newSteps[1],
            state: ECheckAndUpdateStepState.Success,
          };
          return newSteps;
        });
        void checkDeviceInitialized();
      }
    } else {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[1] = {
          ...newSteps[1],
          state: ECheckAndUpdateStepState.Error,
          errorMessage: intl.formatMessage({
            id: ETranslations.hardware_hardware_device_not_find_error,
          }),
        };
        return newSteps;
      });
    }
  }, [
    createStepTimeout,
    ensureTransportType,
    getActiveDevice,
    currentDevice,
    deviceData.device,
    ensureActiveConnection,
    intl,
    checkDeviceInitialized,
  ]);

  const firmwareStepStateRef = useRef<ECheckAndUpdateStepState>(steps[1].state);
  firmwareStepStateRef.current = steps[1].state;
  useFocusEffect(
    useCallback(() => {
      if (firmwareStepStateRef.current === ECheckAndUpdateStepState.Warning) {
        setSteps((prev) => {
          const newSteps = [...prev];
          newSteps[1] = {
            ...newSteps[1],
            state: ECheckAndUpdateStepState.InProgress,
          };
          return newSteps;
        });
        setTimeout(() => {
          void checkFirmwareUpdate();
        });
      }
    }, [checkFirmwareUpdate]),
  );

  const handleVerifyHardware = useCallback(async () => {
    // Double-check: ensure device scanning is fully stopped before starting verification
    await ensureStopScan();

    setSteps((prev) => {
      const newSteps = [...prev];
      newSteps[0] = {
        ...newSteps[0],
        state: ECheckAndUpdateStepState.InProgress,
      };
      return newSteps;
    });

    try {
      const [result] = await Promise.all([
        verifyHardware(deviceData.device as SearchDevice, tabValue),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 1200);
        }),
      ]);
      const latestDevice =
        getActiveDevice() ??
        currentDevice ??
        (deviceData.device as SearchDevice | undefined);
      setCurrentDevice(latestDevice);
      console.log('verifyHardware', result);
      if (!result) {
        throw new OneKeyLocalError(
          intl.formatMessage({ id: ETranslations.global_unknown_error }),
        );
      }
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[0] = {
          ...newSteps[0],
          state:
            result.verified || result.skipVerification
              ? ECheckAndUpdateStepState.Success
              : ECheckAndUpdateStepState.Error,
          errorMessage: result.verified ? undefined : result.result?.message,
        };
        if (result.verified || result.skipVerification) {
          newSteps[1] = {
            ...newSteps[1],
            state: ECheckAndUpdateStepState.InProgress,
          };
        }
        return newSteps;
      });
      if (result.verified || result.skipVerification) {
        setTimeout(() => {
          void checkFirmwareUpdate();
        }, 150);
      }
      isFirmwareVerifiedRef.current = !!result.verified;
    } catch (error) {
      setSteps((prev) => {
        const newSteps = [...prev];
        newSteps[0] = {
          ...newSteps[0],
          state: ECheckAndUpdateStepState.Error,
        };
        return newSteps;
      });
    }
  }, [
    ensureStopScan,
    verifyHardware,
    deviceData.device,
    tabValue,
    intl,
    checkFirmwareUpdate,
    getActiveDevice,
    currentDevice,
  ]);

  const handleDeviceSetupDone = useCallback(() => {
    void checkDeviceInitialized();
  }, [checkDeviceInitialized]);

  const handleRetry = useCallback(async () => {
    const currentErrorStep = steps.find(
      (step) => step.state === ECheckAndUpdateStepState.Error,
    );
    if (!currentErrorStep) {
      await handleVerifyHardware();
      return;
    }
    if (currentErrorStep.id === ECheckAndUpdateStepId.GenuineCheck) {
      await handleVerifyHardware();
    } else if (currentErrorStep.id === ECheckAndUpdateStepId.FirmwareCheck) {
      await checkFirmwareUpdate();
    } else if (currentErrorStep.id === ECheckAndUpdateStepId.SetupOnDevice) {
      await checkDeviceInitialized();
    }
  }, [
    checkFirmwareUpdate,
    checkDeviceInitialized,
    handleVerifyHardware,
    steps,
  ]);

  const handleSkipUpdate = useCallback(() => {
    Dialog.show({
      icon: 'InfoCircleOutline',
      tone: 'warning',
      title: intl.formatMessage({
        id: ETranslations.skip_firmware_check_dialog_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.skip_firmware_check_dialog_desc,
      }),
      onConfirm: () => {
        setSteps((prev) => {
          const newSteps = [...prev];
          newSteps[1] = {
            ...newSteps[1],
            state: ECheckAndUpdateStepState.Success,
          };
          return newSteps;
        });
        void checkDeviceInitialized();
      },
    });
  }, [checkDeviceInitialized, intl]);

  useConnectDeviceError(
    useCallback(
      (errorMessageId: ETranslations) => {
        setSteps((prev) => {
          const inProgressStep = prev.find(
            (step) => step.state === ECheckAndUpdateStepState.InProgress,
          );
          if (inProgressStep) {
            inProgressStep.state = ECheckAndUpdateStepState.Error;
            inProgressStep.errorMessage = intl.formatMessage({
              id: errorMessageId,
            });
          }
          return [...prev];
        });
      },
      [intl],
    ),
  );

  const DEVICE_SETUP_INSTRUCTIONS = useMemo(() => {
    const deviceType = (deviceData.device as SearchDevice)?.deviceType;
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

    // For Classic or Mini devices, swap the order of PIN and recovery phrase
    if (isClassicOrMini) {
      return [chooseOptionStep, recoveryPhraseStep, pinStep];
    }

    return [chooseOptionStep, pinStep, recoveryPhraseStep];
  }, [intl, deviceData]);

  const handleSkipCurrentStep = useCallback(() => {
    let currentStepId: ECheckAndUpdateStepId | undefined;
    setSteps((prev) => {
      const index = prev.findIndex(
        (step) => step.state === ECheckAndUpdateStepState.Error,
      );
      if (index === -1) {
        return prev;
      }
      currentStepId = prev[index].id;
      const newSteps = [...prev];
      newSteps[index] = {
        ...newSteps[index],
        state: ECheckAndUpdateStepState.Success,
      };
      return newSteps;
    });
    setTimeout(() => {
      if (currentStepId === ECheckAndUpdateStepId.FirmwareCheck) {
        void handleDeviceSetupDone();
      } else if (currentStepId === ECheckAndUpdateStepId.GenuineCheck) {
        void checkFirmwareUpdate();
      } else {
        void handleVerifyHardware();
      }
    }, 150);
  }, [checkFirmwareUpdate, handleDeviceSetupDone, handleVerifyHardware]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.check_and_update,
          })}
        />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent
            gap="$10"
            $platform-native={{
              py: '$5',
            }}
          >
            {steps.map((step, index) => {
              // Don't show setup-on-device until firmware-check is completed
              if (
                step.id === ECheckAndUpdateStepId.SetupOnDevice &&
                steps[1].state !== ECheckAndUpdateStepState.Success
              ) {
                return null;
              }

              return (
                <YStack key={step.title}>
                  {/* highlight background */}
                  <AnimatePresence>
                    {step.state &&
                    step.state !== ECheckAndUpdateStepState.Success &&
                    step.state !== ECheckAndUpdateStepState.Idle ? (
                      <YStack
                        animation="quick"
                        animateOnly={['opacity', 'transform']}
                        enterStyle={{
                          opacity: 0,
                          scale: 0.97,
                          filter: 'blur(4px)',
                        }}
                        exitStyle={{
                          opacity: 0,
                          scale: 0.97,
                          filter: 'blur(4px)',
                        }}
                        position="absolute"
                        left={-10}
                        top={-10}
                        right={-10}
                        bottom={-10}
                        $gtMd={{
                          left: -16,
                          top: -16,
                          right: -16,
                          bottom: -16,
                        }}
                        bg="$bgSubdued"
                        borderRadius="$4"
                        borderCurve="continuous"
                        $platform-web={{
                          boxShadow:
                            '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                        }}
                        zIndex={0}
                      />
                    ) : null}
                  </AnimatePresence>
                  {/* connected line */}
                  {index !== steps.length - 1 &&
                  !(
                    steps[index + 1]?.id ===
                      ECheckAndUpdateStepId.SetupOnDevice &&
                    steps[1].state !== ECheckAndUpdateStepState.Success
                  ) ? (
                    <YStack
                      w={2}
                      position="absolute"
                      left={31}
                      top={64}
                      bottom={-40}
                      gap="$1"
                      overflow="hidden"
                    >
                      {Array.from({ length: 20 }).map((_, i) => (
                        <YStack
                          key={i}
                          w="100%"
                          h="$1"
                          bg="$neutral3"
                          borderRadius="$full"
                        />
                      ))}
                    </YStack>
                  ) : null}
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
                      <Image
                        source={step.image}
                        width={
                          step.id === ECheckAndUpdateStepId.SetupOnDevice
                            ? 48
                            : 64
                        }
                        height={
                          step.id === ECheckAndUpdateStepId.SetupOnDevice
                            ? 48
                            : 64
                        }
                      />
                      {step.state !== ECheckAndUpdateStepState.Idle ? (
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
                            {step.state ===
                            ECheckAndUpdateStepState.InProgress ? (
                              <Spinner
                                key="spinner"
                                size="small"
                                animation="quick"
                                enterStyle={{ scale: 0.7, opacity: 0 }}
                                exitStyle={{ scale: 0.7, opacity: 0 }}
                                scale={0.8}
                              />
                            ) : null}
                            {step.state === ECheckAndUpdateStepState.Error ? (
                              <YStack
                                animation="quick"
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
                            {step.state === ECheckAndUpdateStepState.Warning ||
                            step.state === ECheckAndUpdateStepState.Skipped ? (
                              <YStack
                                animation="quick"
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
                            {step.state === ECheckAndUpdateStepState.Success ? (
                              <YStack
                                animation="quick"
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
                      ) : null}
                    </YStack>
                    <YStack gap="$1" flex={1}>
                      <SizableText size="$headingSm">{step.title}</SizableText>
                      {step.description ? (
                        <SizableText color="$textSubdued">
                          {step.description}
                        </SizableText>
                      ) : null}
                    </YStack>
                  </XStack>
                  <HeightTransition initialHeight={0}>
                    {step.id === ECheckAndUpdateStepId.SetupOnDevice &&
                    step.state === ECheckAndUpdateStepState.Warning ? (
                      <YStack pt="$8" gap="$5">
                        <SizableText size="$bodyMdMedium" color="$textInfo">
                          {intl.formatMessage({
                            id: ETranslations.setup_device_prompt,
                          })}
                        </SizableText>
                        {DEVICE_SETUP_INSTRUCTIONS.map((instruction, idx) => (
                          <YStack key={instruction.title} gap="$5">
                            <Divider />
                            <YStack
                              gap={instruction.details ? '$2' : undefined}
                            >
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
                                  <SizableText textAlign="center">
                                    {idx + 1}
                                  </SizableText>
                                </YStack>
                                <SizableText size="$bodyMdMedium" flex={1}>
                                  {instruction.title}
                                </SizableText>
                              </XStack>
                              {instruction.details?.map((detail) => (
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
                    {/* update */}
                    {step.id === ECheckAndUpdateStepId.FirmwareCheck &&
                    step.state === ECheckAndUpdateStepState.Warning ? (
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
                          color="$textInfo"
                          flex={1}
                          textAlign="left"
                        >
                          {intl.formatMessage({
                            id: ETranslations.hardware_status_update_available,
                          })}
                        </SizableText>
                        <XStack gap="$2">
                          <Button
                            variant="primary"
                            onPress={toFirmwareUpgradePage}
                          >
                            {intl.formatMessage({
                              id: ETranslations.update_update_now,
                            })}
                          </Button>
                          <Button onPress={handleSkipUpdate}>
                            {intl.formatMessage({
                              id: ETranslations.global_skip,
                            })}
                          </Button>
                        </XStack>
                      </XStack>
                    ) : null}
                    {/* fallback */}
                    {step.state === ECheckAndUpdateStepState.Error ? (
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
                          {step.errorMessage ??
                            intl.formatMessage({
                              id: ETranslations.genuine_check_interrupt,
                            })}
                        </SizableText>
                        <XStack gap="$2">
                          <Button variant="primary" onPress={handleRetry}>
                            {intl.formatMessage({
                              id: ETranslations.global_retry,
                            })}
                          </Button>
                          {step.id !== ECheckAndUpdateStepId.GenuineCheck ? (
                            <Button onPress={handleSkipCurrentStep}>
                              {intl.formatMessage({
                                id: ETranslations.global_skip,
                              })}
                            </Button>
                          ) : null}
                        </XStack>
                      </XStack>
                    ) : null}
                  </HeightTransition>
                </YStack>
              );
            })}
            <AnimatePresence initial={false}>
              {!steps.some(
                (step) => step.state !== ECheckAndUpdateStepState.Idle,
              ) ? (
                <Button
                  animation="quick"
                  animateOnly={['opacity', 'transform']}
                  variant="primary"
                  size="large"
                  onPress={handleVerifyHardware}
                  exitStyle={{
                    opacity: 0,
                    scale: 0.97,
                  }}
                >
                  {intl.formatMessage(
                    {
                      id: ETranslations.check_my_deviceLabel,
                    },
                    { deviceLabel },
                  )}
                </Button>
              ) : null}
            </AnimatePresence>
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
      </OnboardingLayout>
    </Page>
  );
}

export default function CheckAndUpdate({
  route,
  navigation,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.CheckAndUpdate
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home, // TODO read from router
      }}
    >
      <CheckAndUpdatePage route={route} navigation={navigation} />
    </AccountSelectorProviderMirror>
  );
}
