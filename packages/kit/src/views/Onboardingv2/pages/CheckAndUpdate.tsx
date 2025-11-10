import { useCallback, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { noop } from 'lodash';
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
  useDesktopBluetoothStatusPolling,
  useDeviceConnect,
} from '../hooks/useDeviceConnect';

import type { KnownDevice, SearchDevice } from '@onekeyfe/hd-core';

enum ECheckAndUpdateStepState {
  Idle = 'idle',
  InProgress = 'inProgress',
  Warning = 'warning',
  Success = 'success',
  Error = 'error',
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

  const deviceLabel = useMemo(() => {
    if ((deviceData.device as KnownDevice)?.label) {
      return (deviceData.device as KnownDevice).label;
    }
    return (deviceData.device as SearchDevice).name;
  }, [deviceData]);

  const { verifyHardware, connectDevice } = useDeviceConnect();

  const [steps, setSteps] = useState<
    {
      image: IImageProps['source'];
      id: string;
      title: string;
      description?: string;
      state?: ECheckAndUpdateStepState;
      neededAction?: boolean;
      errorMessage?: string;
    }[]
  >([
    {
      id: 'genuine-check',
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
      id: 'firmware-check',
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
      id: 'setup-on-device',
      image: require('@onekeyhq/shared/src/assets/wallet/avatar/ProBlack.png'),
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
      newSteps[0] = {
        ...newSteps[0],
        state: ECheckAndUpdateStepState.Success,
      };
      newSteps[1] = {
        ...newSteps[1],
        state: ECheckAndUpdateStepState.Success,
      };
      newSteps[2] = {
        ...newSteps[2],
        state: ECheckAndUpdateStepState.InProgress,
      };
      return newSteps;
    });
    try {
      const [features] = await Promise.all([
        connectDevice(deviceData.device as SearchDevice),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 1200);
        }),
      ]);
      if (features) {
        const deviceMode = await deviceUtils.getDeviceModeFromFeatures({
          features,
        });
        console.log('deviceMode', deviceMode);
        if (deviceMode === EOneKeyDeviceMode.notInitialized) {
          setWarningStep();
          return;
        }
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
    setTimeout(async () => {
      navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
        deviceData,
        isFirmwareVerified: true,
      });
    }, 1200);
  }, [connectDevice, deviceData, navigation]);

  const checkFirmwareUpdate = useCallback(async () => {
    await connectDevice(deviceData.device as SearchDevice);
    if (!deviceData.device?.connectId) {
      return;
    }
    const compatibleConnectId =
      await backgroundApiProxy.serviceHardware.getCompatibleConnectId({
        connectId: deviceData.device.connectId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    const r =
      await backgroundApiProxy.serviceFirmwareUpdate.checkAllFirmwareRelease({
        connectId: compatibleConnectId,
      });
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
        void checkDeviceInitialized();
      }
    }
  }, [connectDevice, deviceData.device, checkDeviceInitialized]);

  const firmwareStepStateRef = useRef<ECheckAndUpdateStepState>(steps[1].state);
  firmwareStepStateRef.current = steps[1].state;
  useFocusEffect(
    useCallback(() => {
      if (firmwareStepStateRef.current === ECheckAndUpdateStepState.Warning) {
        setSteps((prev) => {
          const newSteps = [...prev];
          newSteps[0] = {
            ...newSteps[0],
            state: ECheckAndUpdateStepState.Success,
          };
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

  useDesktopBluetoothStatusPolling(tabValue, noop);

  const handleVerifyHardware = useCallback(async () => {
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
          state: result.verified
            ? ECheckAndUpdateStepState.Success
            : ECheckAndUpdateStepState.Error,
          errorMessage: result.verified ? undefined : result.result?.message,
        };
        if (result.verified) {
          newSteps[1] = {
            ...newSteps[1],
            state: ECheckAndUpdateStepState.InProgress,
          };
        }
        return newSteps;
      });
      if (result.verified) {
        setTimeout(() => {
          void checkFirmwareUpdate();
        }, 150);
      }
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
  }, [verifyHardware, deviceData.device, tabValue, intl, checkFirmwareUpdate]);

  const handleRetry = useCallback(async () => {
    await handleVerifyHardware();
  }, [handleVerifyHardware]);

  const handleDeviceSetupDone = useCallback(() => {
    void checkDeviceInitialized();
  }, [checkDeviceInitialized]);

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
        // Execute skip logic after confirmation
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
    return [
      {
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
      },
      {
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
      },
      {
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
      },
    ];
  }, [intl]);

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
                step.id === 'setup-on-device' &&
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
                        }}
                        exitStyle={{
                          opacity: 0,
                          scale: 0.97,
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
                    steps[index + 1]?.id === 'setup-on-device' &&
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
                        width={step.id === 'setup-on-device' ? 48 : 64}
                        height={step.id === 'setup-on-device' ? 48 : 64}
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
                            {step.state === ECheckAndUpdateStepState.Warning ? (
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
                    {step.id === 'setup-on-device' &&
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
                    {step.id === 'firmware-check' &&
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
                          <Button
                            variant="primary"
                            onPress={() => handleRetry()}
                          >
                            {intl.formatMessage({
                              id: ETranslations.global_retry,
                            })}
                          </Button>
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
