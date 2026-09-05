import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Anchor,
  Button,
  Dialog,
  HeightTransition,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  type OneKeyError,
  type OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { DefectiveFirmware } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { isLegacyHardwareUiActive } from '@onekeyhq/shared/src/hardware/deviceStageOwnership';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type {
  IDeviceVerifyVersionCompareResult,
  IOneKeyDeviceFeatures,
} from '@onekeyhq/shared/types/device';

import { useDeviceStageFirmwareVerify } from './useDeviceStageFirmwareVerify';

import type { SearchDevice } from '@onekeyfe/hd-core';

const AUTO_CLOSE_DELAY_MS = 1200;

function useAutoClose(callback: () => void, enabled: boolean) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const hasClosedRef = useRef(false);

  useEffect(() => {
    if (enabled && !hasClosedRef.current) {
      const timer = setTimeout(() => {
        if (!hasClosedRef.current) {
          hasClosedRef.current = true;
          callbackRef.current();
        }
      }, AUTO_CLOSE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [enabled]);
}

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
  unofficial_firmware_detected = 'unofficial_firmware_detected',
  defective_firmware_detected = 'defective_firmware_detected',
}

const FIRMWARE_VERIFY_SKIP_DEVICE_CANCEL_FLAG =
  'firmwareVerifySkipDeviceCancel';

function useFirmwareVerifyBase({
  device,
  skipDeviceCancel,
  useNewProcess,
}: {
  device: SearchDevice | IDBDevice;
  skipDeviceCancel?: boolean;
  useNewProcess?: boolean;
}) {
  const [result, setResult] = useState<IFirmwareAuthenticationState>('unknown'); // unknown, official, unofficial, error
  const [errorObj, setErrorObj] = useState<{ code: number; message?: string }>({
    code: 0,
  });
  const [contentType, setContentType] = useState(
    EFirmwareAuthenticationDialogContentType.default,
  );
  const [versionCompareResult, setVersionCompareResult] = useState<
    IDeviceVerifyVersionCompareResult | undefined
  >(undefined);
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
        // Set certificate to success first
        setVersionCompareResult({
          certificate: { isMatch: true, format: authResult.result?.data ?? '' },
        } as unknown as IDeviceVerifyVersionCompareResult);
        setContentType(
          useNewProcess
            ? EFirmwareAuthenticationDialogContentType.verification_verify
            : EFirmwareAuthenticationDialogContentType.verification_successful,
        );
      } else if (authResult.result?.code === 10_104) {
        setResult('error');
        setErrorObj({ code: authResult.result?.code || -99_999 });
        setContentType(EFirmwareAuthenticationDialogContentType.network_error);
      } else if (
        [10_106, 10_107].includes(authResult.result?.code ?? -99_999)
      ) {
        setResult('error');
        setErrorObj({ code: authResult.result?.code || -99_999 });
        setContentType(
          EFirmwareAuthenticationDialogContentType.verification_temporarily_unavailable,
        );
      } else {
        setResult('unofficial');
        setErrorObj({ code: authResult.result?.code || -99_999 });
        setContentType(
          EFirmwareAuthenticationDialogContentType.unofficial_device_detected,
        );
      }

      if (useNewProcess && authResult.verified) {
        // verify firmware hash
        const latestFeatures =
          await backgroundApiProxy.serviceHardware.getFirmwareVerificationFeatures(
            {
              connectId: device?.connectId ?? '',
              deviceType: device.deviceType,
            },
          );
        const verifyResult =
          await backgroundApiProxy.serviceHardware.verifyFirmwareHash({
            deviceType: device.deviceType,
            onekeyFeatures: latestFeatures,
          });
        console.log('=====>>>> verifyResult: ', verifyResult);
        setVersionCompareResult(verifyResult);
        const hasUnverifiedFirmware = Object.entries(verifyResult).some(
          ([, value]: [string, { isMatch: boolean }]) => !value.isMatch,
        );
        if (hasUnverifiedFirmware) {
          setContentType(
            EFirmwareAuthenticationDialogContentType.unofficial_firmware_detected,
          );
        }
      }
    } catch (error) {
      setResult('error');

      // Handle server-side exceptions
      if (
        (error as OneKeyServerApiError).className ===
        EOneKeyErrorClassNames.OneKeyServerApiError
      ) {
        const { code, message } = error as OneKeyError;
        setContentType(
          EFirmwareAuthenticationDialogContentType.verification_temporarily_unavailable,
        );
        setErrorObj({ code, message });
        return;
      }

      // Handle local exceptions
      const { code, message } = error as OneKeyError;

      // Handle DefectiveFirmware error specifically
      if (error instanceof DefectiveFirmware) {
        setContentType(
          EFirmwareAuthenticationDialogContentType.defective_firmware_detected,
        );
        setErrorObj({ code, message });
        return;
      }

      switch (code) {
        case HardwareErrorCode.ActionCancelled:
        case HardwareErrorCode.CallQueueActionCancelled:
        case HardwareErrorCode.NewFirmwareForceUpdate:
          void dialogInstance.close({
            flag: FIRMWARE_VERIFY_SKIP_DEVICE_CANCEL_FLAG,
          });
          break;
        case HardwareErrorCode.BleUnavailableWhileUsbConnected:
          void dialogInstance.close({
            flag: FIRMWARE_VERIFY_SKIP_DEVICE_CANCEL_FLAG,
          });
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
        case HardwareErrorCode.DefectiveFirmware:
          setContentType(
            EFirmwareAuthenticationDialogContentType.defective_firmware_detected,
          );
          setErrorObj({ code, message });
          return;
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
  }, [device, dialogInstance, skipDeviceCancel, useNewProcess]);

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
    versionCompareResult,
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
  releaseUrl,
}: {
  title: string;
  status: IVerifyHashRowStatus;
  result: string;
  releaseUrl?: string;
}) {
  const intl = useIntl();
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
            borderWidth={2}
            borderColor="$icon"
            opacity={0.2}
            borderRadius="$full"
          />
        </Stack>
      );
    }
    return <Icon name="XCircleSolid" size="$6" color="$iconCritical" />;
  }, [status]);
  const resultInfo = useMemo(() => {
    if (status === 'loading') {
      return (
        <SizableText size="$bodyMd">
          {intl.formatMessage({
            id: ETranslations.device_auth_verifying_component_label,
          })}
        </SizableText>
      );
    }
    if (status === 'success') {
      if (releaseUrl) {
        return (
          <Anchor
            href={releaseUrl}
            color="$textSuccess"
            size="$bodyMd"
            target="_blank"
            textDecorationLine="underline"
          >
            {result}
          </Anchor>
        );
      }
      return (
        <SizableText size="$bodyMd" color="$textSuccess">
          {result}
        </SizableText>
      );
    }
    if (status === 'error') {
      return (
        <SizableText size="$bodyMd" color="$textCritical">
          {intl.formatMessage({ id: ETranslations.global_failed })}
        </SizableText>
      );
    }

    return null;
  }, [intl, result, status, releaseUrl]);
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

const keys = ['certificate', 'firmware', 'bluetooth', 'bootloader'];
function VerifyHash({
  certificateResult,
  onActionPress,
  initStatuses = {
    certificate: 'loading',
    firmware: 'init',
    bluetooth: 'init',
    bootloader: 'init',
  },
  versionCompareResult,
}: {
  certificateResult?: IFirmwareAuthenticationState;
  versionCompareResult?: IDeviceVerifyVersionCompareResult;
  onActionPress?: () => void;
  initStatuses?: {
    certificate: IVerifyHashRowStatus;
    firmware: IVerifyHashRowStatus;
    bluetooth: IVerifyHashRowStatus;
    bootloader: IVerifyHashRowStatus;
  };
}) {
  const [statues, setStatues] = useState(initStatuses);
  const intl = useIntl();
  const verifiedKeys = useRef(new Set<string>());

  useEffect(() => {
    keys.forEach((key) => {
      if (
        key !== 'certificate' &&
        !verifiedKeys.current.has(key) &&
        versionCompareResult?.[key as keyof IDeviceVerifyVersionCompareResult]
      ) {
        verifiedKeys.current.add(key);
        setStatues((prev) => ({
          ...prev,
          [key]: versionCompareResult[
            key as keyof IDeviceVerifyVersionCompareResult
          ].isMatch
            ? 'success'
            : 'error',
        }));
      }
    });
  }, [versionCompareResult]);

  useEffect(() => {
    if (
      certificateResult === 'official' ||
      certificateResult === 'unofficial'
    ) {
      verifiedKeys.current.add('certificate');
      setStatues((prev) => ({
        ...prev,
        certificate: certificateResult === 'official' ? 'success' : 'error',
        ...(certificateResult === 'official' ? { firmware: 'loading' } : {}),
      }));
    }
  }, [certificateResult]);

  const titles = useMemo(
    () => [
      intl.formatMessage({ id: ETranslations.device_auth_certificate }),
      intl.formatMessage({ id: ETranslations.global_firmware }),
      intl.formatMessage({ id: ETranslations.global_bluetooth }),
      'Bootloader',
      'Security Element',
    ],
    [intl],
  );

  const isShowContinue =
    Object.values(statues).filter((s) => s !== 'success').length === 0;

  useAutoClose(() => onActionPress?.(), isShowContinue);

  return (
    <YStack>
      {isShowContinue ? (
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
      ) : null}
      <YStack gap="$2">
        {keys.map((key, index) => (
          <VerifyHashRow
            key={key}
            title={titles[index]}
            status={statues[key as keyof typeof statues]}
            result={
              versionCompareResult?.[
                key as keyof IDeviceVerifyVersionCompareResult
              ]?.format ?? ''
            }
            releaseUrl={
              versionCompareResult?.[
                key as keyof IDeviceVerifyVersionCompareResult
              ]?.releaseUrl
            }
          />
        ))}
      </YStack>
    </YStack>
  );
}

export function EnumBasicDialogContentContainer({
  contentType,
  onActionPress,
  onDevSkipVerificationPress,
  certificateResult,
  versionCompareResult,
  useNewProcess,
}: {
  contentType: EFirmwareAuthenticationDialogContentType;
  errorObj: {
    code: number;
    message?: string;
  };
  onActionPress?: () => void;
  onDevSkipVerificationPress?: () => void;
  certificateResult?: IFirmwareAuthenticationState;
  versionCompareResult?: IDeviceVerifyVersionCompareResult;
  useNewProcess?: boolean;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const [devSkipUnlocked, setDevSkipUnlocked] = useState(false);
  const [devSettings] = useDevSettingsPersistAtom();
  const isUnofficial =
    contentType ===
      EFirmwareAuthenticationDialogContentType.unofficial_device_detected ||
    contentType ===
      EFirmwareAuthenticationDialogContentType.unofficial_firmware_detected;
  const isFailure =
    isUnofficial ||
    contentType === EFirmwareAuthenticationDialogContentType.network_error ||
    contentType ===
      EFirmwareAuthenticationDialogContentType.verification_temporarily_unavailable ||
    contentType === EFirmwareAuthenticationDialogContentType.error_fallback ||
    contentType ===
      EFirmwareAuthenticationDialogContentType.defective_firmware_detected;
  const canDevSkip =
    isFailure &&
    (platformEnv.isDev ||
      devSettings.enabled ||
      (isUnofficial && devSkipUnlocked));

  useEffect(() => {
    setDevSkipUnlocked(false);
  }, [contentType]);

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
            <Dialog.Description mb="$-5">
              {intl.formatMessage({
                id: ETranslations.device_auth_request_desc,
              })}
            </Dialog.Description>
          </Dialog.Header>
        );
      case EFirmwareAuthenticationDialogContentType.verifying:
        if (useNewProcess) {
          return (
            <>
              <Dialog.Header>
                <Dialog.Icon icon="DocumentSearch2Outline" tone="success" />
                <Dialog.Title>
                  {intl.formatMessage({
                    id: ETranslations.device_auth_verifying_title,
                  })}
                </Dialog.Title>
              </Dialog.Header>
              <VerifyHash
                certificateResult={certificateResult}
                versionCompareResult={versionCompareResult}
                onActionPress={onActionPress}
              />
            </>
          );
        }
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
              <Dialog.Title>
                {intl.formatMessage({
                  id: ETranslations.device_auth_verifying_title,
                })}
              </Dialog.Title>
            </Dialog.Header>
            <VerifyHash
              certificateResult={certificateResult}
              versionCompareResult={versionCompareResult}
              onActionPress={onActionPress}
            />
          </>
        );
      case EFirmwareAuthenticationDialogContentType.verification_successful:
        return (
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
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.global_network_error_help_text,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              testID="onboarding-btn"
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
            <Button
              testID="onboarding-contact-support-btn"
              $md={
                {
                  size: 'large',
                } as any
              }
              onPress={() => showIntercom()}
            >
              {intl.formatMessage({ id: ETranslations.global_contact_us })}
            </Button>
          </>
        );
      case EFirmwareAuthenticationDialogContentType.unofficial_device_detected:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon icon="ErrorOutline" tone="destructive" />
              <MultipleClickStack onPress={() => setDevSkipUnlocked(true)}>
                <Dialog.Title>
                  {intl.formatMessage({
                    id: ETranslations.device_auth_unofficial_device_detected,
                  })}
                </Dialog.Title>
              </MultipleClickStack>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.device_auth_unofficial_device_detected_help_text,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              testID="onboarding-btn"
              $md={
                {
                  size: 'large',
                } as any
              }
              variant="primary"
              onPress={() => showIntercom()}
            >
              {intl.formatMessage({ id: ETranslations.global_contact_us })}
            </Button>
          </>
        );
      case EFirmwareAuthenticationDialogContentType.unofficial_firmware_detected:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon icon="ErrorOutline" tone="destructive" />
              <MultipleClickStack onPress={() => setDevSkipUnlocked(true)}>
                <Dialog.Title>
                  {intl.formatMessage({
                    id: ETranslations.device_auth_unofficial_device_detected,
                  })}
                </Dialog.Title>
              </MultipleClickStack>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.device_auth_unofficial_device_detected_help_text,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <VerifyHash
              certificateResult={certificateResult}
              versionCompareResult={versionCompareResult}
              onActionPress={onActionPress}
            />
            <Button
              testID="onboarding-btn"
              mt="$5"
              $md={
                {
                  size: 'large',
                } as any
              }
              variant="primary"
              onPress={() => showIntercom()}
            >
              {intl.formatMessage({ id: ETranslations.global_contact_us })}
            </Button>
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
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.device_auth_temporarily_unavailable_help_text,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              testID="onboarding-btn"
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
            <Button
              testID="onboarding-contact-support-btn"
              $md={
                {
                  size: 'large',
                } as any
              }
              onPress={() => showIntercom()}
            >
              {intl.formatMessage({ id: ETranslations.global_contact_us })}
            </Button>
          </>
        );
      case EFirmwareAuthenticationDialogContentType.defective_firmware_detected:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon icon="CrossedLargeOutline" tone="destructive" />
              <Dialog.Title>
                {intl.formatMessage({
                  id: ETranslations.hardware_defective_firmware_error_title,
                })}
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.hardware_defective_firmware_error,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              testID="onboarding-btn"
              $md={
                {
                  size: 'large',
                } as any
              }
              variant="primary"
              onPress={async () => {
                await showIntercom();
                void dialogInstance.close();
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_contact_us })}
            </Button>
          </>
        );
      default:
        return (
          <>
            <Dialog.Header>
              <Dialog.Icon tone="warning" icon="ErrorOutline" />
              <Dialog.Title>
                {intl.formatMessage({
                  id: ETranslations.send_verification_failure,
                })}
              </Dialog.Title>
              <Dialog.Description>
                {intl.formatMessage({
                  id: ETranslations.global_unknown_error_retry_message,
                })}
              </Dialog.Description>
            </Dialog.Header>
            <Button
              testID="onboarding-btn"
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
            <Button
              testID="onboarding-contact-support-btn"
              $md={
                {
                  size: 'large',
                } as any
              }
              onPress={() => showIntercom()}
            >
              {intl.formatMessage({ id: ETranslations.global_contact_us })}
            </Button>
          </>
        );
    }
  }, [
    contentType,
    intl,
    useNewProcess,
    certificateResult,
    versionCompareResult,
    onActionPress,
    dialogInstance,
  ]);
  return (
    <YStack>
      {content}
      {canDevSkip && onDevSkipVerificationPress ? (
        <Button
          testID="onboarding-dev-skip-verification-btn"
          onPress={onDevSkipVerificationPress}
        >
          Skip it And Create Wallet(Only in Dev)
        </Button>
      ) : null}
    </YStack>
  );
}

export function FirmwareAuthenticationDialogContent({
  onContinue,
  onDevSkipVerificationPress,
  device,
  skipDeviceCancel,
  useNewProcess,
}: {
  onContinue: (params: { checked: boolean }) => void;
  onDevSkipVerificationPress?: () => void;
  device: SearchDevice | IDBDevice;
  skipDeviceCancel?: boolean;
  useNewProcess?: boolean;
}) {
  const {
    result,
    reset,
    verify,
    contentType,
    setContentType,
    errorObj,
    versionCompareResult,
  } = useFirmwareVerifyBase({
    device,
    skipDeviceCancel,
    useNewProcess,
  });

  useAutoClose(
    () => onContinue({ checked: true }),
    !useNewProcess &&
      contentType ===
        EFirmwareAuthenticationDialogContentType.verification_successful &&
      result === 'official',
  );

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
          await showIntercom();
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
        useNewProcess={useNewProcess}
        errorObj={errorObj}
        contentType={contentType}
        onActionPress={propsMap[result].onPress}
        onDevSkipVerificationPress={() => {
          onDevSkipVerificationPress?.();
          onContinue({ checked: false });
        }}
        certificateResult={result}
        versionCompareResult={versionCompareResult}
      />
    );
  }, [
    useNewProcess,
    errorObj,
    contentType,
    result,
    versionCompareResult,
    onContinue,
    onDevSkipVerificationPress,
    reset,
    setContentType,
    verify,
  ]);

  return (
    <HeightTransition initialHeight={0}>
      <Stack gap="$5">{content}</Stack>
    </HeightTransition>
  );
}

export type IFirmwareVerifyDialogHost = Pick<typeof Dialog, 'show'>;

export function useFirmwareVerifyDialog() {
  const [isLoading, setIsLoading] = useState(false);
  // OK-59934: the check plays as the stage's authenticity steps instead
  // of this dialog — every caller inherits it here.
  const { runDeviceStageFirmwareVerify } = useDeviceStageFirmwareVerify();
  const showFirmwareVerifyDialog = useCallback(
    async ({
      device,
      features,
      onVerified,
      onContinue,
      onDevSkipVerificationPress,
      onClose,
      dialogHost = Dialog,
    }: {
      device: SearchDevice | IDBDevice;
      features: IOneKeyDeviceFeatures | undefined;
      onContinue: (params: { checked: boolean }) => Promise<void> | void;
      onClose: () => Promise<void> | void;
      onVerified?: (params: { checked: boolean }) => Promise<void> | void;
      onDevSkipVerificationPress?: () => void;
      // A page-owned dialog host (useInPageDialog) renders this dialog into the
      // page's own portal instead of the global full-window overlay. On iOS the
      // global overlay stacks children by render order only, so a retry loop
      // that re-mounts this dialog while the hardware checking Sheet is still
      // exiting can strand a backdrop above it that swallows every tap.
      dialogHost?: IFirmwareVerifyDialogHost;
    }) => {
      if (!deviceUtils.isFirmwareVerifySupported(device.deviceType)) {
        await onContinue({ checked: false });
        return;
      }

      let hasHandledClose = false;
      const onCloseFn = async (extra?: { flag?: string }) => {
        if (hasHandledClose) {
          return;
        }
        hasHandledClose = true;
        await onClose?.();
        setIsLoading(false);
        if (device.connectId) {
          await backgroundApiProxy.serviceHardwareUI.closeHardwareUiStateDialog(
            {
              connectId: device.connectId,
              skipDeviceCancel:
                extra?.flag === FIRMWARE_VERIFY_SKIP_DEVICE_CANCEL_FLAG,
              deviceType: device.deviceType,
            },
          );
        }
      };

      // OK-59934: the stage replaced this dialog. The dialog itself is
      // kept (not deleted) until the integration is proven on real
      // devices — isLegacyHardwareUiActive() is the single step back.
      if (isLegacyHardwareUiActive()) {
        setIsLoading(true);
        let shouldUseNewAuthenticateVersion = false;
        try {
          console.log('====> features: ', features);
          // use old features to quick check if need new version
          shouldUseNewAuthenticateVersion =
            await backgroundApiProxy.serviceHardware.shouldAuthenticateFirmwareByHash(
              {
                features,
              },
            );
          console.log(
            'shouldUseNewAuthenticateVersion: ====>>>: ',
            shouldUseNewAuthenticateVersion,
          );
        } catch (error) {
          await onCloseFn({ flag: FIRMWARE_VERIFY_SKIP_DEVICE_CANCEL_FLAG });
          throw error;
        } finally {
          // await backgroundApiProxy.serviceApp.hideDialogLoading();
        }
        const firmwareAuthenticationDialog = dialogHost.show({
          tone: 'success',
          icon: 'DocumentSearch2Outline',
          title: ' ',
          description: ' ',
          dismissOnOverlayPress: false,
          showFooter: false,
          renderContent: (
            <FirmwareAuthenticationDialogContent
              skipDeviceCancel
              device={device}
              onContinue={async ({ checked }) => {
                await onVerified?.({ checked });
                await firmwareAuthenticationDialog.close({
                  flag: FIRMWARE_VERIFY_SKIP_DEVICE_CANCEL_FLAG,
                });
                await onContinue({ checked });
              }}
              onDevSkipVerificationPress={onDevSkipVerificationPress || noop}
              useNewProcess={shouldUseNewAuthenticateVersion}
            />
          ),
          onClose: onCloseFn,
        });
        return;
      }

      setIsLoading(true);
      try {
        const result = await runDeviceStageFirmwareVerify({
          device,
          features,
          skipDeviceCancel: true,
        });
        if (result.closed) {
          // The run ended with no verdict: either an abort code that must
          // not cancel the device, or a dismissal the stage already
          // answered with its own cancel. Either way, do not cancel twice.
          await onCloseFn({ flag: FIRMWARE_VERIFY_SKIP_DEVICE_CANCEL_FLAG });
          return;
        }
        if (!result.checked) {
          onDevSkipVerificationPress?.();
        }
        await onVerified?.({ checked: result.checked });
        await onContinue({ checked: result.checked });
      } finally {
        setIsLoading(false);
      }
    },
    [runDeviceStageFirmwareVerify],
  );
  return {
    showFirmwareVerifyDialog,
    isLoading,
  };
}
