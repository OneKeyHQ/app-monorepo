import { useCallback, useEffect, useMemo, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import type { IButtonProps, IStackProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogTitleContextTitleProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { SearchDevice } from '@onekeyfe/hd-core';

type IFirmwareAuthenticationState =
  | 'unknown'
  | 'official'
  | 'unofficial'
  | 'error';

type IFirmwareErrorState = 'UnexpectedBootloaderMode' | undefined;

export enum EFirmwareAuthenticationDialogContentType {
  default = 'default',
  verifying = 'verifying',
  verification_successful = 'verification_successful',
  network_error = 'network_error',
  unofficial_device_detected = 'unofficial_device_detected',
  verification_temporarily_unavailable = 'verification_temporarily_unavailable',
  show_risky_warning = 'show_risky_warning',
}

function useFirmwareVerifyBase({
  device,
  skipDeviceCancel,
}: {
  device: SearchDevice | IDBDevice;
  skipDeviceCancel?: boolean;
}) {
  const [result, setResult] = useState<IFirmwareAuthenticationState>('unknown'); // unknown, official, unofficial, error
  const [errorState, setErrorState] = useState<IFirmwareErrorState>();
  const [contentType, setContentType] = useState(
    EFirmwareAuthenticationDialogContentType.default,
  );
  const verify = useCallback(async () => {
    setContentType(EFirmwareAuthenticationDialogContentType.verifying);
    try {
      setErrorState(undefined);
      const authResult =
        await backgroundApiProxy.serviceHardware.firmwareAuthenticate({
          device,
          skipDeviceCancel,
        });
      console.log('firmwareAuthenticate >>>> ', authResult);
      if (authResult.verified) {
        setResult('official');
        setContentType(
          EFirmwareAuthenticationDialogContentType.verification_successful,
        );
      } else {
        setResult('unofficial');
        setContentType(
          EFirmwareAuthenticationDialogContentType.unofficial_device_detected,
        );
      }
    } catch (error) {
      setResult('error');
      if (
        (error as OneKeyError).code ===
        HardwareErrorCode.DeviceUnexpectedBootloaderMode
      ) {
        setErrorState('UnexpectedBootloaderMode');
      }
      setContentType(
        EFirmwareAuthenticationDialogContentType.verification_temporarily_unavailable,
      );
      throw error;
    } finally {
      await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
        connectId: device.connectId || '',
        skipDeviceCancel,
      });
    }
  }, [device, skipDeviceCancel]);

  useEffect(() => {
    void verify();
    // setTimeout(() => {
    //   setIsConfirmOnDevice(true);
    //   setTimeout(() => {
    //     setResult('official');
    //   }, 3000);
    // }, 3000);
  }, [verify]);

  const reset = useCallback(() => {
    setResult('unknown');
    setErrorState(undefined);
  }, []);

  return { result, reset, errorState, verify, contentType, setContentType };
}

function BasicDialogContentContainer({ children, ...props }: IStackProps) {
  return (
    <Stack
      p="$5"
      space="$5"
      borderRadius="$3"
      borderCurve="continuous"
      borderWidth={StyleSheet.hairlineWidth}
      {...props}
    >
      {children}
    </Stack>
  );
}

export interface IBasicFirmwareAuthenticationDialogContent {
  titleProps?: IDialogTitleContextTitleProps;
  textContentContainerProps?: IStackProps;
  textContent?: string;
  showLoading?: boolean;
  showActions?: boolean;
  actionsProps?: IButtonProps;
  showContinueAnyway?: boolean;
}
export function BasicFirmwareAuthenticationDialogContent({
  titleProps,
  showLoading,
  showActions,
  actionsProps,
  showContinueAnyway,
}: IBasicFirmwareAuthenticationDialogContent) {
  const intl = useIntl();
  const [showRiskyWarning, setShowRiskyWarning] = useState(false);

  const content = useMemo(
    () => (
      <>
        <Dialog.Title showExitButton {...titleProps} />

        {showLoading ? (
          <Stack
            p="$5"
            alignItems="center"
            justifyContent="center"
            bg="$bgStrong"
            borderRadius="$3"
            borderCurve="continuous"
          >
            <Spinner size="large" />
          </Stack>
        ) : null}

        {showActions ? (
          <Button
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
            variant="primary"
            {...actionsProps}
          />
        ) : null}

        {showContinueAnyway ? (
          <Stack pt="$4">
            {!showRiskyWarning ? (
              <Button
                $md={
                  {
                    size: 'large',
                  } as IButtonProps
                }
                onPress={() => setShowRiskyWarning(true)}
              >
                {intl.formatMessage({
                  id: ETranslations.global_continue_anyway,
                })}
              </Button>
            ) : (
              <YStack
                p="$5"
                space="$5"
                bg="$bgCautionSubdued"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="$borderCautionSubdued"
                borderRadius="$3"
                borderCurve="continuous"
              >
                <SizableText size="$bodyLgMedium" color="$textCaution">
                  {intl.formatMessage({
                    id: ETranslations.device_auth_continue_anyway_warning_message,
                  })}
                </SizableText>
                <Button
                  $md={
                    {
                      size: 'large',
                    } as IButtonProps
                  }
                >
                  {intl.formatMessage({
                    id: ETranslations.global_i_understand,
                  })}
                </Button>
              </YStack>
            )}
          </Stack>
        ) : null}
      </>
    ),
    [
      actionsProps,
      intl,
      showActions,
      showContinueAnyway,
      showLoading,
      showRiskyWarning,
      titleProps,
    ],
  );
  return <YStack>{content} </YStack>;
}

export function EnumBasicDialogContentContainer({
  contentType,
}: {
  contentType: EFirmwareAuthenticationDialogContentType;
} & IBasicFirmwareAuthenticationDialogContent) {
  const intl = useIntl();

  const restProps = useMemo(() => {
    switch (contentType) {
      case EFirmwareAuthenticationDialogContentType.default:
        return {
          titleProps: {
            tone: 'success',
            icon: 'DocumentSearch2Outline',
            title: intl.formatMessage({
              id: ETranslations.device_auth_request_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.device_auth_request_desc,
            }),
          },
        };
      case EFirmwareAuthenticationDialogContentType.verifying:
        return {
          titleProps: {
            tone: 'success',
            icon: 'DotHorOutline',
            title: intl.formatMessage({
              id: ETranslations.device_auth_verifying_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.device_auth_verifying_desc,
            }),
          },
          showLoading: true,
        };
      case EFirmwareAuthenticationDialogContentType.verification_successful:
        return {
          titleProps: {
            tone: 'success',
            icon: 'BadgeVerifiedSolid',
            title: intl.formatMessage({
              id: ETranslations.device_auth_successful_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.device_auth_successful_desc,
            }),
          },
          showActions: true,
          actionsProps: {
            children: intl.formatMessage({ id: ETranslations.global_continue }),
          },
        };
      case EFirmwareAuthenticationDialogContentType.network_error:
        return {
          titleProps: {
            icon: 'WorldOutline',
            title: intl.formatMessage({
              id: ETranslations.global_network_error,
            }),
            description: intl.formatMessage({
              id: ETranslations.global_network_error_help_text,
            }),
          },
          showActions: true,
          actionsProps: {
            children: intl.formatMessage({ id: ETranslations.global_retry }),
          },
          showContinueAnyway: true,
        };
      case EFirmwareAuthenticationDialogContentType.unofficial_device_detected:
        return {
          titleProps: {
            icon: 'ErrorOutline',
            tone: 'destructive',
            title: intl.formatMessage({
              id: ETranslations.device_auth_unofficial_device_detected,
            }),
            description: intl.formatMessage({
              id: ETranslations.device_auth_unofficial_device_detected_help_text,
            }),
          },
          showActions: true,
          actionsProps: {
            children: intl.formatMessage({
              id: ETranslations.global_contact_us,
            }),
            onPress: () =>
              Linking.openURL('https://help.onekey.so/hc/requests/new'),
          },
        };
      case EFirmwareAuthenticationDialogContentType.verification_temporarily_unavailable:
        return {
          titleProps: {
            icon: 'ServerOutline',
            title: intl.formatMessage({
              id: ETranslations.device_auth_temporarily_unavailable,
            }),
            description: intl.formatMessage({
              id: ETranslations.device_auth_temporarily_unavailable_help_text,
            }),
          },
          showActions: true,
          actionsProps: {
            children: intl.formatMessage({ id: ETranslations.global_retry }),
          },
          showContinueAnyway: true,
        };
      default:
        return undefined;
    }
  }, [contentType, intl]);
  return <BasicFirmwareAuthenticationDialogContent {...restProps} />;
}

export function FirmwareAuthenticationDialogContent({
  onContinue,
  device,
  skipDeviceCancel,
  noContinue,
}: {
  onContinue: (params: { checked: boolean }) => void;
  device: SearchDevice | IDBDevice;
  skipDeviceCancel?: boolean;
  noContinue?: boolean;
}) {
  const { result, reset, errorState, verify, contentType, setContentType } =
    useFirmwareVerifyBase({
      device,
      skipDeviceCancel,
    });

  const requestsUrl = useHelpLink({ path: 'requests/new' });

  const textContent = useMemo(() => {
    if (result === 'official') {
      return 'Your device is running official firmware';
    }

    if (result === 'unofficial') {
      return 'Unofficial firmware detected!';
    }

    return '';
  }, [result]);

  const content = useMemo(() => {
    if (result === 'unknown') {
      return (
        <Stack
          p="$5"
          bg="$bgSubdued"
          borderRadius="$3"
          borderCurve="continuous"
        >
          <Spinner size="large" />
        </Stack>
      );
    }
    const propsMap: Record<
      IFirmwareAuthenticationState,
      {
        onPress: () => void;
        button: string;
        textStackProps?: IStackProps;
      }
    > = {
      unknown: {
        onPress: () => {},
        button: 'Loading',
      },
      official: {
        onPress: () => onContinue({ checked: true }),
        button: 'Continue',
        textStackProps: {
          bg: '$bgSuccessSubdued',
          borderColor: '$borderSuccessSubdued',
        },
      },
      unofficial: {
        onPress: async () => {
          await Linking.openURL(requestsUrl);
        },
        button: 'Contact us',
        textStackProps: {
          bg: '$bgCriticalSubdued',
          borderColor: '$borderCriticalSubdued',
        },
      },
      error: {
        onPress: async () => {
          reset();
          setContentType(EFirmwareAuthenticationDialogContentType.verifying);
          await verify();
        },
        button: 'Retry',
        textStackProps: {
          bg: '$bgCautionSubdued',
          borderColor: '$borderCautionSubdued',
        },
      },
    };

    const continueProps = {
      key: 'continue-anyway',
      variant: 'tertiary',
      children: 'Continue Anyway',
      onPress: () => onContinue({ checked: false }),
    } as IButtonProps;

    const riskyWarningProps = {
      message:
        result === 'error' && errorState === 'UnexpectedBootloaderMode'
          ? 'Device is in unexpected bootloader mode.'
          : `We're currently unable to verify your device. Continuing may pose
  security risks.`,
      buttonProps: {
        onPress: () =>
          noContinue
            ? onContinue({ checked: false })
            : setContentType(
                EFirmwareAuthenticationDialogContentType.show_risky_warning,
              ),
        children: 'I Understand',
      },
    };

    return (
      <EnumBasicDialogContentContainer
        contentType={contentType}
        textContentContainerProps={propsMap[result].textStackProps}
        textContent={textContent}
        actionsProps={{
          onPress: propsMap[result].onPress,
          children: propsMap[result].button,
        }}
      />
    );
  }, [
    result,
    errorState,
    contentType,
    textContent,
    onContinue,
    requestsUrl,
    reset,
    setContentType,
    verify,
    noContinue,
  ]);

  return <Stack space="$5">{content}</Stack>;
}

export function useFirmwareVerifyDialog({
  noContinue,
}: {
  noContinue?: boolean;
} = {}) {
  const showFirmwareVerifyDialog = useCallback(
    async ({
      device,
      onContinue,
    }: {
      device: SearchDevice | IDBDevice;
      onContinue: (params: { checked: boolean }) => Promise<void> | void;
    }) => {
      const firmwareAuthenticationDialog = Dialog.show({
        tone: 'success',
        icon: 'DocumentSearch2Outline',
        title: 'Device Authentication',
        description:
          'Confirm on your device to verify its authenticity and secure your connection.',
        dismissOnOverlayPress: false,
        showFooter: false,
        renderContent: (
          <FirmwareAuthenticationDialogContent
            device={device}
            noContinue={noContinue}
            onContinue={async ({ checked }) => {
              await firmwareAuthenticationDialog.close();
              await onContinue({ checked });
            }}
            {...{
              skipDeviceCancel: true, // FirmwareAuthenticationDialogContent
            }}
          />
        ),
        async onClose() {
          if (device.connectId) {
            await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog(
              {
                connectId: device.connectId,
                skipDeviceCancel: true, // FirmwareAuthenticationDialogContent onClose
              },
            );
          }
        },
      });
    },
    [noContinue],
  );
  return {
    showFirmwareVerifyDialog,
  };
}
