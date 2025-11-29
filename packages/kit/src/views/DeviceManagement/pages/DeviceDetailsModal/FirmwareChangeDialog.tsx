import { memo, useCallback, useEffect, useRef, useState } from 'react';

import {
  EDeviceType,
  EFirmwareType,
  HardwareErrorCode,
} from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import semver from 'semver';

import { Dialog, YStack } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import type { AllFirmwareRelease } from '@onekeyfe/hd-core';

// ============== Types ==============

type IFirmwareChangeDialogState =
  | { type: 'loading' }
  | { type: 'device-not-found' }
  | { type: 'coming-soon' }
  | {
      type: 'bootloader-upgrade-needed';
      bootloaderVersion: string;
      minVersion: string;
    }
  | { type: 'error'; message: string }
  | { type: 'upgrade-firmware' }
  | { type: 'success' };

interface IFirmwareChangeDialogContentProps {
  device: IDBDevice;
  targetFirmwareType: EFirmwareType;
  fromFirmwareType: EFirmwareType;
  onStateChange: (state: IFirmwareChangeDialogState) => void;
  onCancel: () => void;
}

interface IUseFirmwareChangeDialogParams {
  device: IDBDevice | undefined;
  onSuccess: (
    targetFirmwareType: EFirmwareType,
    fromFirmwareType: EFirmwareType,
  ) => void;
  onUpgradeFirmware: () => void;
}

const CLASSIC1S_MIN_BOOTLOADER_VERSION = '2.1.0';

function FirmwareChangeDialogContentBase({
  device,
  targetFirmwareType,
  onStateChange,
  onCancel,
}: IFirmwareChangeDialogContentProps) {
  const intl = useIntl();
  const [state, setState] = useState<IFirmwareChangeDialogState>({
    type: 'loading',
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        if (!device) {
          const newState: IFirmwareChangeDialogState = {
            type: 'device-not-found',
          };
          setState(newState);
          onStateChange(newState);
          return;
        }

        let checkAllResultInfo: AllFirmwareRelease | undefined;
        let checkAllFirmwareError: Error | undefined;
        try {
          checkAllResultInfo =
            await backgroundApiProxy.serviceFirmwareUpdate.baseCheckAllFirmwareRelease(
              {
                connectId: device?.connectId,
                firmwareType: targetFirmwareType,
                retryCount: 0,
                silentMode: true,
              },
            );
        } catch (error) {
          checkAllFirmwareError = error as Error;
        }

        const checkFirmwareTypeAvailableResult =
          await backgroundApiProxy.serviceFirmwareUpdate.checkFirmwareTypeAvailable(
            {
              connectId: device.connectId,
              deviceType: device.deviceType,
              firmwareType: targetFirmwareType,
            },
          );

        if (!isMountedRef.current) return;

        // if firmware type is not available, return coming soon state
        if (!checkFirmwareTypeAvailableResult) {
          const newState: IFirmwareChangeDialogState = {
            type: 'coming-soon',
          };
          setState(newState);
          onStateChange(newState);
          return;
        }

        // if device type is Pro, return success state
        if (device.deviceType === EDeviceType.Pro) {
          const newState: IFirmwareChangeDialogState = {
            type: 'success',
          };
          setState(newState);
          onStateChange(newState);
          return;
        }

        if (checkAllFirmwareError) {
          if (
            isHardwareErrorByCode({
              error: checkAllFirmwareError,
              code: HardwareErrorCode.DeviceNotFound,
            })
          ) {
            const newState: IFirmwareChangeDialogState = {
              type: 'device-not-found',
            };
            setState(newState);
            onStateChange(newState);
            return;
          }

          const newState: IFirmwareChangeDialogState = {
            type: 'error',
            message: checkAllFirmwareError.message,
          };
          setState(newState);
          onStateChange(newState);
          return;
        }

        // get device version information
        const versions = await deviceUtils.getDeviceVersion({
          device,
          features: checkAllResultInfo?.features,
        });

        // check bootloader version
        const bootloaderVersion = versions?.bootloaderVersion || '0.0.0';

        if (
          semver.valid(bootloaderVersion) &&
          semver.lt(bootloaderVersion, CLASSIC1S_MIN_BOOTLOADER_VERSION)
        ) {
          const newState: IFirmwareChangeDialogState = {
            type: 'bootloader-upgrade-needed',
            bootloaderVersion,
            minVersion: CLASSIC1S_MIN_BOOTLOADER_VERSION,
          };
          setState(newState);
          onStateChange(newState);
          return;
        }

        // all conditions are met
        const newState: IFirmwareChangeDialogState = { type: 'success' };
        setState(newState);
        onStateChange(newState);
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error('Failed to check firmware type change:', error);
        const newState: IFirmwareChangeDialogState = {
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        };
        setState(newState);
        onStateChange(newState);
      }
    })();
  }, [device, targetFirmwareType, onStateChange]);

  // loading or success state
  if (state.type === 'loading' || state.type === 'success') {
    return (
      <YStack>
        <Dialog.Header>
          <Dialog.Icon icon="InfoCircleOutline" />
          <Dialog.Title>
            {intl.formatMessage({
              id: ETranslations.global_checking_device,
            })}
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Loading />
      </YStack>
    );
  }

  // device not found state
  if (state.type === 'device-not-found') {
    return (
      <Dialog.Header>
        <Dialog.Icon icon="ErrorSolid" tone="destructive" />
        <Dialog.Title>
          {intl.formatMessage({
            id: ETranslations.hardware_connect_failed,
          })}
        </Dialog.Title>
        <Dialog.Description>
          {intl.formatMessage({
            id: ETranslations.hardware_device_not_find_error,
          })}
        </Dialog.Description>
      </Dialog.Header>
    );
  }

  // coming soon state
  if (state.type === 'coming-soon') {
    return (
      <YStack>
        <Dialog.Header>
          <Dialog.Icon icon="InfoCircleOutline" />
          <Dialog.Title>
            {intl.formatMessage({
              id: ETranslations.wallet_feature_coming_soon,
            })}
          </Dialog.Title>
          <Dialog.Description>
            {intl.formatMessage({
              id: ETranslations.device_btc_only_coming_soon,
            })}
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer
          showCancelButton
          showConfirmButton={false}
          onCancelText={intl.formatMessage({
            id: ETranslations.global_close,
          })}
          onCancel={onCancel}
        />
      </YStack>
    );
  }

  // bootloader upgrade needed state
  if (state.type === 'bootloader-upgrade-needed') {
    return (
      <YStack>
        <Dialog.Header>
          <Dialog.Icon icon="InfoCircleOutline" />
          <Dialog.Title>
            {intl.formatMessage({
              id: ETranslations.device_firmware_update_required,
            })}
          </Dialog.Title>
          <Dialog.Description>
            {intl.formatMessage({
              id: ETranslations.device_desc_update_latest_firmware,
            })}
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer
          showCancelButton
          showConfirmButton
          onCancelText={intl.formatMessage({
            id: ETranslations.global_close,
          })}
          onCancel={onCancel}
          onConfirmText={intl.formatMessage({
            id: ETranslations.update_update_now,
          })}
          onConfirm={() => {
            onStateChange({ type: 'upgrade-firmware' });
          }}
        />
      </YStack>
    );
  }

  if (state.type === 'error') {
    return (
      <Dialog.Header>
        <Dialog.Icon icon="ErrorSolid" tone="destructive" />
        <Dialog.Title>
          {intl.formatMessage({
            id: ETranslations.hardware_connect_failed,
          })}
        </Dialog.Title>
        <Dialog.Description>{state.message}</Dialog.Description>
      </Dialog.Header>
    );
  }

  // close dialog
  return null;
}

const FirmwareChangeDialogContent = memo(FirmwareChangeDialogContentBase);

// ============== Custom Hook ==============

export function useFirmwareChangeDialog({
  device,
  onSuccess,
  onUpgradeFirmware,
}: IUseFirmwareChangeDialogParams) {
  const intl = useIntl();
  const dialogRef = useRef<IDialogInstance | null>(null);
  const stateRef = useRef<IFirmwareChangeDialogState>({ type: 'loading' });
  const targetFirmwareTypeRef = useRef<EFirmwareType | null>(null);
  const fromFirmwareTypeRef = useRef<EFirmwareType | null>(null);

  const handleStateChange = useCallback(
    (newState: IFirmwareChangeDialogState) => {
      stateRef.current = newState;

      // success: close dialog and execute callback
      if (newState.type === 'success' && targetFirmwareTypeRef.current) {
        void dialogRef.current?.close();
        onSuccess(
          targetFirmwareTypeRef.current ?? EFirmwareType.Universal,
          fromFirmwareTypeRef.current ?? EFirmwareType.Universal,
        );
      }

      // upgrade firmware: close dialog and execute callback
      if (newState.type === 'upgrade-firmware') {
        void dialogRef.current?.close();
        onUpgradeFirmware();
      }
    },
    [onSuccess, onUpgradeFirmware],
  );

  const handleCancel = useCallback(() => {
    void dialogRef.current?.close({ flag: 'cancel' });
  }, []);

  // use useCallback to cache show function
  const show = useCallback(
    ({
      hasAllowChangeFirmwareType,
      targetFirmwareType,
      fromFirmwareType,
    }: {
      hasAllowChangeFirmwareType: boolean;
      targetFirmwareType: EFirmwareType;
      fromFirmwareType: EFirmwareType;
    }) => {
      if (!hasAllowChangeFirmwareType) {
        onUpgradeFirmware();
        return;
      }

      if (!device) return;

      targetFirmwareTypeRef.current = targetFirmwareType;
      fromFirmwareTypeRef.current = fromFirmwareType;
      stateRef.current = { type: 'loading' };

      if (
        targetFirmwareType !== EFirmwareType.BitcoinOnly ||
        fromFirmwareType !== EFirmwareType.Universal
      ) {
        onSuccess(targetFirmwareType, fromFirmwareType);
        return;
      }

      dialogRef.current = Dialog.show({
        icon: 'InfoCircleOutline',
        title: intl.formatMessage({
          id: ETranslations.update_update_incomplete_text,
        }),
        dismissOnOverlayPress: false,
        showFooter: false,
        renderContent: (
          <FirmwareChangeDialogContent
            device={device}
            targetFirmwareType={targetFirmwareType}
            fromFirmwareType={fromFirmwareType}
            onStateChange={handleStateChange}
            onCancel={handleCancel}
          />
        ),
      });
    },
    [
      device,
      intl,
      handleStateChange,
      handleCancel,
      onSuccess,
      onUpgradeFirmware,
    ],
  );

  return { show };
}
