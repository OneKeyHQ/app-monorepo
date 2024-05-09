import { useCallback, useMemo } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { Button, SizableText, Stack } from '@onekeyhq/components';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateRetryAtom,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ECustomOneKeyHardwareError,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';

import type { IDeviceType } from '@onekeyfe/hd-core';

// like: DeviceNotFound
function CommonError({
  onRetry,
  message,
}: {
  onRetry?: () => void;
  message: string | undefined;
}) {
  return (
    <Stack>
      <SizableText color="$textCaution">
        {message || 'Something went wrong'}
      </SizableText>
      {onRetry ? <Button onPress={onRetry}>Retry</Button> : null}
    </Stack>
  );
}

function ShouldUpdateBridge({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  return (
    <Stack>
      <SizableText>
        Your bridge is out of date, your should update to{' '}
        {result?.updateInfos?.bridge?.releaseVersion}
      </SizableText>
      <Button
        onPress={() =>
          openUrlExternal('https://www.onekey.so/download?client=bridge')
        }
      >
        Download Bridge
      </Button>
    </Stack>
  );
}

function ShouldUpdateByWeb() {
  return (
    <Stack>
      <SizableText>
        Your device is too old, your should update from web
        https://firmware.onekey.so/
      </SizableText>
      <Button onPress={() => openUrlExternal('https://firmware.onekey.so/')}>
        Update
      </Button>
    </Stack>
  );
}

function HowToUpdateFullResource() {
  return (
    <Stack>
      <SizableText>
        Your device is too old, your should update by this guide:
        https://help.onekey.so/hc/articles/8884680775951
      </SizableText>
      <Button
        onPress={() =>
          openUrlExternal('https://help.onekey.so/hc/articles/8884680775951')
        }
      >
        Update
      </Button>
    </Stack>
  );
}

function EnterBootModeGuide({
  deviceType,
}: {
  deviceType: IDeviceType | undefined;
}) {
  return (
    <Stack>
      <SizableText>How to enter boot mode for {deviceType}:</SizableText>
      <SizableText>1. xxxxxxx</SizableText>
      <SizableText>2. xxxxxxx</SizableText>
      <SizableText>3. xxxxxxx</SizableText>
    </Stack>
  );
}

export function useFirmwareUpdateErrors({
  error,
  onRetry,
  result,
  lastFirmwareTipMessage,
}: {
  onRetry?: () => void;
  error: IOneKeyError | undefined;
  result: ICheckAllFirmwareReleaseResult | undefined;
  lastFirmwareTipMessage: EFirmwareUpdateTipMessages | undefined;
}) {
  const defaultRetryText = 'Retry';
  return useMemo<{
    content: React.ReactNode;
    detail?: React.ReactNode;
    onRetryHandler?: () => void;
    retryText: string;
  }>(() => {
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
        content: <CommonError message={error?.message} />,
        detail: <EnterBootModeGuide deviceType={result?.deviceType} />,
        onRetryHandler: onRetry,
        retryText: 'Continue',
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: [
          HardwareErrorCode.BridgeNetworkError,
          HardwareErrorCode.BridgeTimeoutError,
          HardwareErrorCode.BridgeNotInstalled,
          ECustomOneKeyHardwareError.NeedOneKeyBridge,
        ],
      })
    ) {
      return {
        // content: <ShouldUpdateBridge result={result} />,
        content: <CommonError message={error?.message} />,
        onRetryHandler: onRetry,
        retryText: defaultRetryText,
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: ECustomOneKeyHardwareError.NeedOneKeyBridgeUpgrade,
      })
    ) {
      return {
        content: <ShouldUpdateBridge result={result} />,
        retryText: defaultRetryText,
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: ECustomOneKeyHardwareError.NeedFirmwareUpgradeFromWeb,
      })
    ) {
      return {
        content: <ShouldUpdateByWeb />,
        retryText: defaultRetryText,
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: HardwareErrorCode.UseDesktopToUpdateFirmware,
      })
    ) {
      return {
        content: <HowToUpdateFullResource />,
        retryText: defaultRetryText,
      };
    }

    if (error) {
      return {
        content: <CommonError message={error?.message} />,
        onRetryHandler: onRetry,
        retryText: defaultRetryText,
      };
    }

    return {
      content: null,
      retryText: defaultRetryText,
    };
  }, [error, lastFirmwareTipMessage, onRetry, result]);
}

function WorkflowErrors({
  onRetry,
  error,
  result,
}: {
  onRetry?: () => void;
  error: IOneKeyError;
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const { onRetryHandler, content, retryText } = useFirmwareUpdateErrors({
    error,
    onRetry,
    result,
    lastFirmwareTipMessage: undefined,
  });
  return (
    <>
      <FirmwareUpdatePageFooter
        onConfirm={onRetryHandler}
        onConfirmText={retryText || 'Retry'}
      />
      {content}
    </>
  );
}

function InstallingErrors({
  result,
  lastFirmwareTipMessage,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  lastFirmwareTipMessage: EFirmwareUpdateTipMessages | undefined;
}) {
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();
  const [retryInfo] = useFirmwareUpdateRetryAtom();

  const onRetry = useCallback(async () => {
    if (!retryInfo) {
      return null;
    }
    console.error('retry error', retryInfo?.error);
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
  }, [result, retryInfo, setStepInfo]);

  const { content, detail, onRetryHandler, retryText } =
    useFirmwareUpdateErrors({
      onRetry,
      result,
      lastFirmwareTipMessage,
      error: retryInfo?.error,
    });

  return (
    <>
      <FirmwareUpdatePageFooter
        onConfirm={onRetryHandler}
        onConfirmText={retryText || 'Retry'}
      />
      {content}
      {detail}
    </>
  );
}

export const FirmwareUpdateErrors = {
  ShouldUpdateBridge,
  CommonError,
  EnterBootModeGuide,
  WorkflowErrors,
  InstallingErrors,
};
