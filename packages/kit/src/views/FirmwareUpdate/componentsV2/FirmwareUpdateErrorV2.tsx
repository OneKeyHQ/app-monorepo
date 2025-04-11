import { useCallback, useMemo } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import type { IFirmwareUpdateRetry } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ECustomOneKeyHardwareError,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function FirmwareUpdateBaseMessage({ message }: { message: string }) {
  return (
    <SizableText size="$bodyMd" color="$textCritical">
      {message}
    </SizableText>
  );
}

function FirmwareUpdateContactSupportMessage() {
  return (
    <YStack>
      <HyperlinkText
        size="$bodyMd"
        color="$textSubdued"
        translationId={ETranslations.global_help_message}
      />
    </YStack>
  );
}

export function useFirmwareUpdateErrors({
  error,
  lastFirmwareTipMessage,
}: {
  error: IOneKeyError | undefined;
  lastFirmwareTipMessage: EFirmwareUpdateTipMessages | undefined;
}) {
  const intl = useIntl();
  console.log('useFirmwareUpdateErrors', error);
  return useMemo<{
    errorMessage: string | React.ReactNode;
  }>(() => {
    if (
      isHardwareErrorByCode({
        error,
        code: [
          HardwareErrorCode.PinCancelled,
          HardwareErrorCode.ActionCancelled,
          HardwareErrorCode.DeviceInterruptedFromOutside,
        ],
      })
    ) {
      return {
        errorMessage: intl.formatMessage({
          id: ETranslations.update_operation_canceled_desc,
        }),
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: HardwareErrorCode.FirmwareUpdateDownloadFailed,
      })
    ) {
      return {
        errorMessage: intl.formatMessage({
          id: ETranslations.update_check_connection_try_again,
        }),
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: HardwareErrorCode.PinInvalid,
      })
    ) {
      return {
        errorMessage: intl.formatMessage({
          id: ETranslations.hardware_invalid_pin_error,
        }),
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: HardwareErrorCode.FirmwareUpdateManuallyEnterBoot,
      }) ||
      isHardwareErrorByCode({
        error,
        code: HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure,
      }) ||
      (error &&
        lastFirmwareTipMessage ===
          EFirmwareUpdateTipMessages.AutoRebootToBootloader)
    ) {
      return {
        errorMessage: intl.formatMessage({
          id: ETranslations.update_manually_entering_bootloader_mode,
        }),
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: [HardwareErrorCode.BridgeNetworkError],
      })
    ) {
      return {
        errorMessage: intl.formatMessage({
          id: ETranslations.update_unable_to_connect_to_bridge,
        }),
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: [HardwareErrorCode.BridgeTimeoutError],
      })
    ) {
      return {
        errorMessage: intl.formatMessage({
          id: ETranslations.update_connection_to_bridge_timed_out,
        }),
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: [
          HardwareErrorCode.BridgeNotInstalled,
          ECustomOneKeyHardwareError.NeedOneKeyBridge,
        ],
      })
    ) {
      return {
        errorMessage: intl.formatMessage({
          id: ETranslations.update_hardware_update_requires_bridge,
        }),
      };
    }

    if (error) {
      let message = error?.message;

      // web3Errors.provider.requestTimeout();
      if (error.code === 4500) {
        message = intl.formatMessage({
          id: ETranslations.feedback_hw_polling_time_out,
        });
      }

      return {
        errorMessage: message,
      };
    }

    return {
      errorMessage: '',
    };
  }, [intl, error, lastFirmwareTipMessage]);
}

export function FirmwareUpdateErrorV2({
  retryInfo,
  result,
  lastFirmwareTipMessage,
  onRetryBefore,
}: {
  retryInfo: IFirmwareUpdateRetry | undefined;
  result: ICheckAllFirmwareReleaseResult | undefined;
  lastFirmwareTipMessage: EFirmwareUpdateTipMessages | undefined;
  onRetryBefore?: () => void;
}) {
  const intl = useIntl();
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();

  const onRetry = useCallback(async () => {
    if (!retryInfo) {
      return null;
    }
    console.error('retry error', retryInfo?.error);
    // Call onRetryBefore before starting retry
    onRetryBefore?.();
    await backgroundApiProxy.serviceFirmwareUpdate.clearHardwareUiStateBeforeStartUpdateWorkflow();
    // TODO move atom action to service
    setStepInfo({
      step: EFirmwareUpdateSteps.updateStart,
      payload: {
        startAtTime: Date.now(),
      },
    });
    await backgroundApiProxy.serviceFirmwareUpdate.retryUpdateTask({
      id: retryInfo?.id,
      connectId: result?.updatingConnectId,
      releaseResult: result,
    });
  }, [result, retryInfo, setStepInfo, onRetryBefore]);

  const { errorMessage } = useFirmwareUpdateErrors({
    error: retryInfo?.error,
    lastFirmwareTipMessage,
  });

  if (!errorMessage || !retryInfo?.error) {
    return null;
  }

  return (
    <YStack gap="$3">
      <FirmwareUpdateBaseMessage
        // TODO: maybe hyperlink text
        message={typeof errorMessage === 'string' ? errorMessage : ''}
      />
      <Button
        size="medium"
        variant="primary"
        alignSelf="flex-start"
        onPress={onRetry}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
      <FirmwareUpdateContactSupportMessage />
    </YStack>
  );
}
