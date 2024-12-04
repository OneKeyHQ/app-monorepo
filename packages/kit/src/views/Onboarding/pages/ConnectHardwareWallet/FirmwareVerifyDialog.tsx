import { useCallback, useEffect, useMemo, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { FIRMWARE_CONTACT_US_URL } from '@onekeyhq/shared/src/config/appConfig';
import type {
  OneKeyError,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { SearchDevice } from '@onekeyfe/hd-core';
import type { Features } from '@onekeyfe/hd-transport';

type IFirmwareAuthenticationState =
  | 'unknown'
  | 'official'
  | 'unofficial'
  | 'error';

export enum EFirmwareAuthenticationDialogContentType {
  default = 'default',
  verifying = 'verifying',
  verification_verify = 'verification_verify',
  verification_successful = 'verification_successful',
  network_error = 'network_error',
  unofficial_device_detected = 'unofficial_device_detected',
  verification_temporarily_unavailable = 'verification_temporarily_unavailable',
  error_fallback = 'error_fallback',
}

function useFirmwareVerifyBase({
  device,
  skipDeviceCancel,
}: {
  device: SearchDevice | IDBDevice;
  skipDeviceCancel?: boolean;
}) {
  const [result, setResult] = useState<IFirmwareAuthenticationState>('unknown'); // unknown, official, unofficial, error
  const [errorObj, setErrorObj] = useState<{ code: number; message?: string }>({
    code: 0,
  });
  const [contentType, setContentType] = useState(
    EFirmwareAuthenticationDialogContentType.default,
  );
  const dialogInstance = useDialogInstance();
  useEffect(() => {
    const callback = () => {
      setContentType(EFirmwareAuthenticationDialogContentType.verifying);
    };
    appEventBus.on(
      EAppEventBusNames.HardwareVerifyAfterDeviceConfirm,
      callback,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.HardwareVerifyAfterDeviceConfirm,
        callback,
      );
    };
  }, []);
  const verify = useCallback(async () => {
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
        setErrorObj({ code: authResult.result?.code || -99_999 });
        setContentType(
          EFirmwareAuthenticationDialogContentType.unofficial_device_detected,
        );
      }
    } catch (error) {
      setResult('error');

      // Handle server-side exceptions
      if (
        (error as OneKeyServerApiError).className ===
        EOneKeyErrorClassNames.OneKeyServerApiError
      ) {
        const { code, message } = error as OneKeyError;
        setContentType(EFirmwareAuthenticationDialogContentType.error_fallback);
        setErrorObj({ code, message });
        return;
      }

      // Handle local exceptions
      const { code, message } = error as OneKeyError;
      switch (code) {
        case HardwareErrorCode.ActionCancelled:
        case HardwareErrorCode.NewFirmwareForceUpdate:
          void dialogInstance.close();
          break;
        case HardwareErrorCode.NetworkError:
        case HardwareErrorCode.BridgeNetworkError:
          setContentType(
            EFirmwareAuthenticationDialogContentType.network_error,
          );
          break;
        case 'ERR_NETWORK' as any:
          setContentType(
            EFirmwareAuthenticationDialogContentType.network_error,
          );
          break;
        case HardwareErrorCode.NotAllowInBootloaderMode:
          setContentType(
            EFirmwareAuthenticationDialogContentType.unofficial_device_detected,
          );
          setErrorObj({ code, message });
          break;
        default:
          setContentType(
            EFirmwareAuthenticationDialogContentType.error_fallback,
          );
          setErrorObj({ code, message });
          break;
      }
      throw error;
    } finally {
      await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
        connectId: device.connectId || '',
        skipDeviceCancel,
      });
    }
  }, [device, dialogInstance, skipDeviceCancel]);

  useEffect(() => {
    setTimeout(async () => {
      await verify();
    }, 50);
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

  return { result, reset, verify, contentType, setContentType, errorObj };
}

function useNewFirmwareVerifyBase({
  device,
  skipDeviceCancel,
}: {
  device: SearchDevice | IDBDevice;
  skipDeviceCancel?: boolean;
}) {
  const [result, setResult] = useState<IFirmwareAuthenticationState>('unknown'); // unknown, official, unofficial, error
  const hashInfo = {
    certificate: 'PRB09B0088A',
    firmware: '4.0.0 (2c4d945-ff9efe5)',
    bluetooth: '2.1.0 (deaf294-5206e9d)',
    bootloader: '2.2.0 (8a5b950-2bbd01c)',
    securityElement: '',
  };
  const [remoteHashInfo, setRemoteHashInfo] = useState({
    certificate: 'PRB09B0088A',
    firmware: '4.0.0 (2c4d945-ff9efe5)',
    bluetooth: '2.1.0 (deaf294-5206e9d)',
    bootloader: '2.2.0 (8a5b950-2bbd01c)',
    securityElement: '',
  });
  const [errorObj, setErrorObj] = useState<{ code: number; message?: string }>({
    code: 0,
  });
  const [contentType, setContentType] = useState(
    EFirmwareAuthenticationDialogContentType.default,
  );
  const dialogInstance = useDialogInstance();
  useEffect(() => {
    const callback = () => {
      setContentType(EFirmwareAuthenticationDialogContentType.verifying);
    };
    appEventBus.on(
      EAppEventBusNames.HardwareVerifyAfterDeviceConfirm,
      callback,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.HardwareVerifyAfterDeviceConfirm,
        callback,
      );
    };
  }, []);
  const verify = useCallback(async () => {
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
          EFirmwareAuthenticationDialogContentType.verification_verify,
        );
        setRemoteHashInfo({
          certificate: 'PRB09B0088A',
          firmware: '4.0.0 (2c4d945-ff9efe5)',
          bluetooth: '2.1.0 (deaf294-5206e9d)',
          bootloader: '2.2.0 (8a5b950-2bbd01c)',
          securityElement: '',
        });
      } else {
        setResult('unofficial');
        setErrorObj({ code: authResult.result?.code || -99_999 });
        setContentType(
          EFirmwareAuthenticationDialogContentType.unofficial_device_detected,
        );
      }
    } catch (error) {
      setResult('error');

      // Handle server-side exceptions
      if (
        (error as OneKeyServerApiError).className ===
        EOneKeyErrorClassNames.OneKeyServerApiError
      ) {
        const { code, message } = error as OneKeyError;
        setContentType(EFirmwareAuthenticationDialogContentType.error_fallback);
        setErrorObj({ code, message });
        return;
      }

      // Handle local exceptions
      const { code, message } = error as OneKeyError;
      switch (code) {
        case HardwareErrorCode.ActionCancelled:
        case HardwareErrorCode.NewFirmwareForceUpdate:
          void dialogInstance.close();
          break;
        case HardwareErrorCode.NetworkError:
        case HardwareErrorCode.BridgeNetworkError:
          setContentType(
            EFirmwareAuthenticationDialogContentType.network_error,
          );
          break;
        case 'ERR_NETWORK' as any:
          setContentType(
            EFirmwareAuthenticationDialogContentType.network_error,
          );
          break;
        case HardwareErrorCode.NotAllowInBootloaderMode:
          setContentType(
            EFirmwareAuthenticationDialogContentType.unofficial_device_detected,
          );
          setErrorObj({ code, message });
          break;
        default:
          setContentType(
            EFirmwareAuthenticationDialogContentType.error_fallback,
          );
          setErrorObj({ code, message });
          break;
      }
      throw error;
    } finally {
      await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog({
        connectId: device.connectId || '',
        skipDeviceCancel,
      });
    }
  }, [device, dialogInstance, skipDeviceCancel]);

  useEffect(() => {
    setTimeout(async () => {
      await verify();
    }, 50);
  }, [verify]);

  const reset = useCallback(() => {
    setResult('unknown');
  }, []);

  return {
    result,
    reset,
    verify,
    contentType,
    setContentType,
    errorObj,
    hashInfo,
    remoteHashInfo,
  };
}

export type IHashInfo = {
  certificate: string;
  firmware: string;
  bluetooth: string;
  bootloader: string;
  securityElement: string;
};

type IVerifyHashRowStatus = 'error' | 'success' | 'loading' | 'init';
function VerifyHashRow({
  title,
  status,
  result,
}: {
  title: string;
  status: IVerifyHashRowStatus;
  result: string;
}) {
  const icon = useMemo(() => {
    if (status === 'loading') {
      return (
        <Stack width="$6" height="$6" ai="center" jc="center">
          <Spinner size="small" />
        </Stack>
      );
    }
    if (status === 'success') {
      return <Icon name="CheckRadioSolid" size="$6" color="$iconSuccess" />;
    }
    if (status === 'init') {
      return (
        <Stack width="$6" height="$6" ai="center" jc="center">
          <Stack
            w="$5"
            h="$5"
            bg="$icon"
            opacity={0.2}
            borderRadius="$full"
            ai="center"
            jc="center"
          >
            <Stack w="$4" h="$4" borderRadius="$full" bg="$bgApp" />
          </Stack>
        </Stack>
      );
    }
    return <Icon name="XCircleSolid" size="$6" color="$iconCritical" />;
  }, [status]);
  const resultInfo = useMemo(() => {
    if (status === 'loading') {
      return <SizableText size="$bodyMd">In progress</SizableText>;
    }
    if (status === 'success') {
      return (
        <SizableText size="$bodyMd" color="$textSuccess">
          {result}
        </SizableText>
      );
    }
    return null;
  }, [result, status]);
  return (
    <XStack jc="space-between" ai="center">
      <XStack gap="$2" ai="center">
        {icon}
        <SizableText size="$bodyMd">{title}</SizableText>
      </XStack>
      {resultInfo}
    </XStack>
  );
}

const keys = [
  'certificate',
  'firmware',
  'bluetooth',
  'bootloader',
  'securityElement',
];
function VerifyHash({
  hashInfo,
  remoteHashInfo,
  onActionPress,
  initStatuses = {
    certificate: 'loading',
    firmware: 'init',
    bluetooth: 'init',
    bootloader: 'init',
    securityElement: 'init',
  },
}: {
  hashInfo: IHashInfo;
  remoteHashInfo: IHashInfo;
  onActionPress?: () => void;
  initStatuses?: {
    certificate: IVerifyHashRowStatus;
    firmware: IVerifyHashRowStatus;
    bluetooth: IVerifyHashRowStatus;
    bootloader: IVerifyHashRowStatus;
    securityElement: IVerifyHashRowStatus;
  };
}) {
  const [statues, setStatues] = useState(initStatuses);
  const intl = useIntl();
  const checkHash = useCallback(
    async (index = 0) => {
      if (index === keys.length) {
        return;
      }
      const key = keys[index] as keyof typeof hashInfo;
      setStatues((prev) => ({
        ...prev,
        [key]: 'loading',
      }));
      await timerUtils.wait(1200);
      if (hashInfo[key] === remoteHashInfo[key]) {
        setStatues((prev) => ({
          ...prev,
          [key]: 'success',
        }));
        await checkHash(index + 1);
      } else {
        setStatues((prev) => ({
          ...prev,
          [key]: 'error',
        }));
      }
    },
    [hashInfo, remoteHashInfo],
  );
  useEffect(() => {
    void checkHash();
  }, [checkHash]);
  const titles = useMemo(
    () => [
      'Certificate',
      'Firmware',
      'Bluetooth',
      'Bootloader',
      'Security Element',
    ],
    [],
  );

  const isShowContinue =
    Object.values(statues).filter((s) => s !== 'success').length === 0;
  return (
    <YStack>
      {isShowContinue ? (
        <Dialog.Header>
          <Dialog.Icon icon="BadgeVerifiedSolid" tone="success" />
          <Dialog.Title>Verification successful</Dialog.Title>
          <Dialog.Description>
            Your device is now officially verified!
          </Dialog.Description>
        </Dialog.Header>
      ) : null}
      <YStack gap="$2">
        {keys.map((key, index) => (
          <VerifyHashRow
            key={key}
            title={titles[index]}
            status={statues[key as keyof typeof hashInfo]}
            result={hashInfo[key as keyof typeof hashInfo]}
          />
        ))}
      </YStack>
      {isShowContinue ? (
        <Button
          mt="$5"
          $md={
            {
              size: 'large',
            } as any
          }
          variant="primary"
          onPress={onActionPress}
        >
          {intl.formatMessage({ id: ETranslations.global_continue })}
        </Button>
      ) : null}
    </YStack>
  );
}

export function EnumBasicDialogContentContainer({
  contentType,
  onActionPress,
  onContinuePress,
  errorObj,
  hashInfo,
  remoteHashInfo,
}: {
  contentType: EFirmwareAuthenticationDialogContentType;
  errorObj: {
    code: number;
    message?: string;
  };
  hashInfo: IHashInfo;
  remoteHashInfo: IHashInfo;
  onActionPress?: () => void;
  onContinuePress?: () => void;
}) {
  const intl = useIntl();

  const [showRiskyWarning, setShowRiskyWarning] = useState(false);
  const renderFooter = useCallback(
    () => (
      <Stack pt="$4">
        {!showRiskyWarning ? (
          <Button
            $md={
              {
                size: 'large',
              } as any
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
            gap="$5"
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
                } as any
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
    ),
    [intl, onContinuePress, showRiskyWarning],
  );

  const content = useMemo(() => {
    switch (contentType) {
      case EFirmwareAuthenticationDialogContentType.default:
        return (
          <Dialog.Header>
            <Dialog.Icon icon="DocumentSearch2Outline" tone="success" />
            <Dialog.Title>
              {intl.formatMessage({
                id: ETranslations.device_auth_request_title,
              })}
            </Dialog.Title>
            <Dialog.Description>
              {intl.formatMessage({
                id: ETranslations.device_auth_request_desc,
              })}
            </Dialog.Description>
          </Dialog.Header>
        );
      case EFirmwareAuthenticationDialogContentType.verifying:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon icon="DocumentSearch2Outline" tone="success" />
              <Dialog.Title>
                {intl.formatMessage({
                  id: ETranslations.device_auth_verifying_title,
                })}
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.device_auth_verifying_desc,
                })}
              </Dialog.Description>
            </Dialog.Header>
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
          </>
        );
      case EFirmwareAuthenticationDialogContentType.verification_verify:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon icon="DocumentSearch2Outline" tone="success" />
              <Dialog.Title>Verifying device</Dialog.Title>
            </Dialog.Header>
            <VerifyHash
              hashInfo={hashInfo}
              remoteHashInfo={remoteHashInfo}
              onActionPress={onActionPress}
            />
          </>
        );
      case EFirmwareAuthenticationDialogContentType.verification_successful:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon icon="BadgeVerifiedSolid" tone="success" />
              <Dialog.Title>
                {intl.formatMessage({
                  id: ETranslations.device_auth_successful_title,
                })}
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.device_auth_successful_desc,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              $md={
                {
                  size: 'large',
                } as any
              }
              variant="primary"
              onPress={onActionPress}
            >
              {intl.formatMessage({ id: ETranslations.global_continue })}
            </Button>
          </>
        );
      case EFirmwareAuthenticationDialogContentType.network_error:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon icon="WorldOutline" />
              <Dialog.Title>
                {intl.formatMessage({
                  id: ETranslations.global_network_error,
                })}
                <SizableText>{`(${errorObj.code})`}</SizableText>
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.global_network_error_help_text,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              $md={
                {
                  size: 'large',
                } as any
              }
              variant="primary"
              onPress={onActionPress}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
            {renderFooter()}
          </>
        );
      case EFirmwareAuthenticationDialogContentType.unofficial_device_detected:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon icon="ErrorOutline" tone="destructive" />
              <Dialog.Title>
                {intl.formatMessage({
                  id: ETranslations.device_auth_unofficial_device_detected,
                })}
                <SizableText>{`(${errorObj.code})`}</SizableText>
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.device_auth_unofficial_device_detected_help_text,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              $md={
                {
                  size: 'large',
                } as any
              }
              variant="primary"
              onPress={() => Linking.openURL(FIRMWARE_CONTACT_US_URL)}
            >
              {intl.formatMessage({ id: ETranslations.global_contact_us })}
            </Button>
            {platformEnv.isDev ? (
              <Button
                $md={
                  {
                    size: 'large',
                  } as any
                }
                onPress={onContinuePress}
              >
                Skip it And Create Wallet(Only in Dev)
              </Button>
            ) : null}
          </>
        );
      case EFirmwareAuthenticationDialogContentType.verification_temporarily_unavailable:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon icon="ServerOutline" />
              <Dialog.Title>
                {intl.formatMessage({
                  id: ETranslations.device_auth_temporarily_unavailable,
                })}
                <SizableText>{`(${errorObj.code})`}</SizableText>
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.device_auth_temporarily_unavailable_help_text,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              $md={
                {
                  size: 'large',
                } as any
              }
              variant="primary"
              onPress={onActionPress}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
            {renderFooter()}
          </>
        );
      default:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon tone="warning" icon="ErrorOutline" />
              <Dialog.Title>
                {errorObj.message ||
                  intl.formatMessage({
                    id: ETranslations.global_unknown_error,
                  })}
                ({errorObj.code || 'unknown'})
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.global_unknown_error_retry_message,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              $md={
                {
                  size: 'large',
                } as any
              }
              variant="primary"
              onPress={onActionPress}
            >
              {intl.formatMessage({ id: ETranslations.global_retry })}
            </Button>
            {renderFooter()}
          </>
        );
    }
  }, [
    contentType,
    errorObj.code,
    errorObj.message,
    intl,
    onActionPress,
    onContinuePress,
    renderFooter,
  ]);
  return <YStack>{content}</YStack>;
}

export function FirmwareAuthenticationDialogContent({
  onContinue,
  device,
  skipDeviceCancel,
}: {
  onContinue: (params: { checked: boolean }) => void;
  device: SearchDevice | IDBDevice;
  features: Features;
  skipDeviceCancel?: boolean;
}) {
  const { result, reset, verify, contentType, setContentType, errorObj } =
    useFirmwareVerifyBase({
      device,
      skipDeviceCancel,
    });

  const requestsUrl = useHelpLink({ path: 'requests/new' });

  const handleContinuePress = useCallback(() => {
    onContinue({ checked: false });
  }, [onContinue]);

  const content = useMemo(() => {
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
        errorObj={errorObj}
        hashInfo={{
          certificate: '',
          firmware: '',
          bluetooth: '',
          bootloader: '',
          securityElement: '',
        }}
        newHashINfo={{
          certificate: '',
          firmware: '',
          bluetooth: '',
          bootloader: '',
          securityElement: '',
        }}
        contentType={contentType}
        onActionPress={propsMap[result].onPress}
        onContinuePress={handleContinuePress}
      />
    );
  }, [
    result,
    errorObj,
    contentType,
    handleContinuePress,
    onContinue,
    requestsUrl,
    reset,
    setContentType,
    verify,
  ]);

  return <Stack gap="$5">{content}</Stack>;
}

function NewFirmwareAuthenticationDialogContent({
  onContinue,
  device,
  features,
  skipDeviceCancel,
}: {
  onContinue: (params: { checked: boolean }) => void;
  device: SearchDevice | IDBDevice;
  features: Features;
  skipDeviceCancel?: boolean;
}) {
  const {
    result,
    reset,
    verify,
    contentType,
    setContentType,
    errorObj,
    hashInfo,
    remoteHashInfo,
  } = useNewFirmwareVerifyBase({
    device,
    skipDeviceCancel,
  });

  const requestsUrl = useHelpLink({ path: 'requests/new' });

  const handleContinuePress = useCallback(() => {
    onContinue({ checked: false });
  }, [onContinue]);

  const content = useMemo(() => {
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
        hashInfo={hashInfo}
        remoteHashInfo={remoteHashInfo}
        errorObj={errorObj}
        contentType={contentType}
        onActionPress={propsMap[result].onPress}
        onContinuePress={handleContinuePress}
      />
    );
  }, [
    result,
    errorObj,
    contentType,
    handleContinuePress,
    onContinue,
    requestsUrl,
    reset,
    setContentType,
    verify,
  ]);

  return <Stack gap="$5">{content}</Stack>;
}

const NEW_PROGRESS_VERSION = '3.1.1';
export function useFirmwareVerifyDialog() {
  const showFirmwareVerifyDialog = useCallback(
    async ({
      device,
      features,
      onContinue,
    }: {
      device: SearchDevice | IDBDevice;
      features: Features;
      onContinue: (params: { checked: boolean }) => Promise<void> | void;
    }) => {
      const isNewVersion = true;
      const Component = isNewVersion
        ? NewFirmwareAuthenticationDialogContent
        : FirmwareAuthenticationDialogContent;
      const firmwareAuthenticationDialog = Dialog.show({
        tone: 'success',
        icon: 'DocumentSearch2Outline',
        title: ' ',
        description: ' ',
        dismissOnOverlayPress: false,
        showFooter: false,
        renderContent: (
          <Component
            skipDeviceCancel
            device={device}
            features={features}
            onContinue={async ({ checked }) => {
              await firmwareAuthenticationDialog.close();
              await onContinue({ checked });
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
    [],
  );
  return {
    showFirmwareVerifyDialog,
  };
}
