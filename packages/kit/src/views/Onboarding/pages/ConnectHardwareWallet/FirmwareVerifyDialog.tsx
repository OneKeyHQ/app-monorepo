import { useCallback, useEffect, useMemo, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import type { IButtonProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import type {
  IDialogProps,
  IDialogTitleContextTitleProps,
} from '@onekeyhq/components/src/composite/Dialog/type';
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
  const [contentType, setContentType] = useState(
    EFirmwareAuthenticationDialogContentType.default,
  );
  const verify = useCallback(async () => {
    setContentType(EFirmwareAuthenticationDialogContentType.verifying);
    try {
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
      switch ((error as OneKeyError).code) {
        case HardwareErrorCode.ActionCancelled:
          setContentType(EFirmwareAuthenticationDialogContentType.default);
          break;
        case HardwareErrorCode.NetworkError:
        case HardwareErrorCode.BridgeNetworkError:
          setContentType(
            EFirmwareAuthenticationDialogContentType.network_error,
          );
          break;
        case HardwareErrorCode.DeviceUnexpectedBootloaderMode:
        default:
          setContentType(
            EFirmwareAuthenticationDialogContentType.verification_temporarily_unavailable,
          );
          break;
      }
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
  }, []);

  return { result, reset, verify, contentType, setContentType };
}

export interface IBasicFirmwareAuthenticationDialogContent {
  titleProps?: IDialogTitleContextTitleProps;
  showLoading?: boolean;
  showActions?: boolean;
  actionsProps?: IButtonProps;
  showContinueAnyway?: boolean;
  onActionPress?: () => void;
  onContinuePress?: () => void;
}
export function BasicFirmwareAuthenticationDialogContent({
  titleProps,
  showLoading,
  showActions,
  actionsProps,
  showContinueAnyway,
  onContinuePress,
}: IBasicFirmwareAuthenticationDialogContent) {
  const intl = useIntl();
  const [showRiskyWarning, setShowRiskyWarning] = useState(false);

  const content = useMemo(
    () => (
      <>
        <Dialog.Header showExitButton {...titleProps} />

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
                  onPress={onContinuePress}
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
      onContinuePress,
      showActions,
      showContinueAnyway,
      showLoading,
      showRiskyWarning,
      titleProps,
    ],
  );
  return <YStack>{content}</YStack>;
}

export function EnumBasicDialogContentContainer({
  contentType,
  onActionPress,
  onContinuePress,
}: {
  contentType: EFirmwareAuthenticationDialogContentType;
} & IBasicFirmwareAuthenticationDialogContent) {
  const intl = useIntl();

  const restProps = useMemo(() => {
    switch (contentType) {
      case EFirmwareAuthenticationDialogContentType.default:
        return {
          titleProps: {
            tone: 'success' as IDialogProps['tone'],
            icon: 'DocumentSearch2Outline' as IKeyOfIcons,
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
            tone: 'success' as IDialogProps['tone'],
            icon: 'DotHorOutline' as IKeyOfIcons,
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
            tone: 'success' as IDialogProps['tone'],
            icon: 'BadgeVerifiedSolid' as IKeyOfIcons,
            title: intl.formatMessage({
              id: ETranslations.device_auth_successful_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.device_auth_successful_desc,
            }),
          },
          showActions: true,
          actionsProps: {
            onPress: onActionPress,
            children: intl.formatMessage({ id: ETranslations.global_continue }),
          },
        };
      case EFirmwareAuthenticationDialogContentType.network_error:
        return {
          titleProps: {
            icon: 'WorldOutline' as IKeyOfIcons,
            title: intl.formatMessage({
              id: ETranslations.global_network_error,
            }),
            description: intl.formatMessage({
              id: ETranslations.global_network_error_help_text,
            }),
          },
          showActions: true,
          actionsProps: {
            onPress: onActionPress,
            children: intl.formatMessage({ id: ETranslations.global_retry }),
          },
          showContinueAnyway: true,
        };
      case EFirmwareAuthenticationDialogContentType.unofficial_device_detected:
        return {
          titleProps: {
            icon: 'ErrorOutline' as IKeyOfIcons,
            tone: 'destructive' as IDialogProps['tone'],
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
            icon: 'ServerOutline' as IKeyOfIcons,
            title: intl.formatMessage({
              id: ETranslations.device_auth_temporarily_unavailable,
            }),
            description: intl.formatMessage({
              id: ETranslations.device_auth_temporarily_unavailable_help_text,
            }),
          },
          showActions: true,
          actionsProps: {
            onPress: onActionPress,
            children: intl.formatMessage({ id: ETranslations.global_retry }),
          },
          showContinueAnyway: true,
          onContinuePress,
        };
      default:
        return undefined;
    }
  }, [contentType, intl, onActionPress, onContinuePress]);
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
  const { result, reset, verify, contentType, setContentType } =
    useFirmwareVerifyBase({
      device,
      skipDeviceCancel,
    });

  const requestsUrl = useHelpLink({ path: 'requests/new' });

  // const textContent = useMemo(() => {
  //   if (result === 'official') {
  //     return 'Your device is running official firmware';
  //   }

  //   if (result === 'unofficial') {
  //     return 'Unofficial firmware detected!';
  //   }

  //   return '';
  // }, [result]);

  const handleContinuePress = useCallback(() => {
    if (noContinue) {
      onContinue({ checked: false });
      return;
    }
    setContentType(EFirmwareAuthenticationDialogContentType.show_risky_warning);
  }, [noContinue, onContinue, setContentType]);

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
      }
    > = {
      unknown: {
        onPress: () => {},
      },
      official: {
        onPress: () => onContinue({ checked: true }),
      },
      unofficial: {
        onPress: async () => {
          await Linking.openURL(requestsUrl);
        },
      },
      error: {
        onPress: async () => {
          reset();
          setContentType(EFirmwareAuthenticationDialogContentType.verifying);
          await verify();
        },
      },
    };

    return (
      <EnumBasicDialogContentContainer
        contentType={contentType}
        onActionPress={propsMap[result].onPress}
        onContinuePress={handleContinuePress}
      />
    );
  }, [
    result,
    contentType,
    handleContinuePress,
    onContinue,
    requestsUrl,
    reset,
    setContentType,
    verify,
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
