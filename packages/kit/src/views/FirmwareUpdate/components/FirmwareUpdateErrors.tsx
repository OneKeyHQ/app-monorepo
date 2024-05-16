import { useCallback, useMemo } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { Image, SizableText, Stack } from '@onekeyhq/components';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate';
import type { IFirmwareUpdateRetry } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  FIRMWARE_UPDATE_BRIDGE_GUIDE,
  FIRMWARE_UPDATE_FULL_RES_GUIDE,
  FIRMWARE_UPDATE_WEB_TOOLS_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import {
  ECustomOneKeyHardwareError,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EFirmwareUpdateTipMessages } from '@onekeyhq/shared/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import ImgEnterBootGuideMini from '../assets/enter-boot-guide-mini.png';

import { FirmwareUpdateBaseMessageView } from './FirmwareUpdateBaseMessageView';
import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';

import type { IDeviceType } from '@onekeyfe/hd-core';

// like: DeviceNotFound
function CommonError({
  message,
  title,
}: {
  message?: string | undefined;
  title?: string | undefined;
}) {
  return (
    <FirmwareUpdateBaseMessageView
      title={title || 'Error Occurred'}
      message={message}
    />
  );
}

function ShouldUpdateBridge({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  // HARDWARE_BRIDGE_DOWNLOAD_URL
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon="InfoCircleOutline"
        title="New Bridge Version Available for Update"
        message={`Hardware update requires the latest bridge software. Please visit our online tutorial  [Solution for failed firmware upgrade on Touch] ${FIRMWARE_UPDATE_BRIDGE_GUIDE} for detailed installation instructions.`}
      />
      <FirmwareUpdatePageFooter
        onConfirm={() => {
          openUrlExternal(FIRMWARE_UPDATE_BRIDGE_GUIDE);
        }}
        onConfirmText="Visit website"
      />
    </Stack>
  );
}

function ShouldUpdateByWeb() {
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon="InfoCircleOutline"
        title="Update in official web tool"
        message={`Your hardware wallet firmware requires an update. Please visit ${FIRMWARE_UPDATE_WEB_TOOLS_URL} on your computer to proceed with the upgrade.`}
      />
      <FirmwareUpdatePageFooter
        onConfirm={() => {
          openUrlExternal(FIRMWARE_UPDATE_WEB_TOOLS_URL);
        }}
        onConfirmText="Visit website"
      />
    </Stack>
  );
}

function HowToUpdateFullResource() {
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon="InfoCircleOutline"
        title="Outdated Version Detected"
        message={`Your current firmware version is too low. Please visit our online tutorial  [Solution for failed firmware upgrade on Touch] ${FIRMWARE_UPDATE_FULL_RES_GUIDE} and follow the step-by-step instructions to complete the update.`}
      />
      <FirmwareUpdatePageFooter
        onConfirm={() => {
          openUrlExternal(FIRMWARE_UPDATE_FULL_RES_GUIDE);
        }}
        onConfirmText="View tutorial"
      />
    </Stack>
  );
}

export function EnterBootModeGuide({
  deviceType,
}: {
  deviceType: IDeviceType | undefined;
}) {
  if (deviceType === 'mini') {
    return (
      <Stack mb="$6">
        <Image w={353} h={224} source={ImgEnterBootGuideMini} />
        <SizableText size="$headingMd">
          Manually Entering BootLoader Mode
        </SizableText>
        <SizableText mt="$2" color="$textSubdued">
          To enter BootLoader mode on your OneKey Mini, press and hold the lock
          screen button while inserting the data cable into the computer, then
          click 'Verify Status and Continue'.
        </SizableText>
      </Stack>
    );
  }
  return (
    <Stack mb="$6">
      <SizableText mt="$2">
        Follow the online tutorial to proceed manually, then click "Retry".
      </SizableText>
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
        content: <CommonError title={error?.message} />,
        detail: <EnterBootModeGuide deviceType={result?.deviceType} />,
        onRetryHandler: onRetry,
        retryText:
          result?.deviceType === 'mini'
            ? 'Verify Status and Continue'
            : defaultRetryText,
        // retryText: 'Continue',
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
  retryInfo,
  result,
  lastFirmwareTipMessage,
}: {
  retryInfo: IFirmwareUpdateRetry | undefined;
  result: ICheckAllFirmwareReleaseResult | undefined;
  lastFirmwareTipMessage: EFirmwareUpdateTipMessages | undefined;
}) {
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();

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
