import { useCallback, useMemo } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import {
  Image,
  RichSizeableText,
  SizableText,
  Stack,
} from '@onekeyhq/components';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
  return (
    <FirmwareUpdateBaseMessageView
      title={
        title ||
        intl.formatMessage({ id: ETranslations.global_an_error_occurred })
      }
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
  const intl = useIntl();
  // HARDWARE_BRIDGE_DOWNLOAD_URL
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.update_outdated_version_detected,
        })}
        message={intl.formatMessage({
          id: ETranslations.update_hardware_update_requires_bridge,
        })}
        linkList={[{ url: FIRMWARE_UPDATE_BRIDGE_GUIDE }]}
      />
      <FirmwareUpdatePageFooter
        onConfirm={() => {
          openUrlExternal(FIRMWARE_UPDATE_BRIDGE_GUIDE);
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_view_tutorial,
        })}
      />
    </Stack>
  );
}

function ShouldUpdateByWeb() {
  const intl = useIntl();
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.update_update_in_official_web_tool,
        })}
        message={intl.formatMessage({
          id: ETranslations.update_update_in_official_web_tool_desc,
        })}
        linkList={[{ url: FIRMWARE_UPDATE_WEB_TOOLS_URL }]}
      />
      <FirmwareUpdatePageFooter
        onConfirm={() => {
          openUrlExternal(FIRMWARE_UPDATE_WEB_TOOLS_URL);
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_visit_website,
        })}
      />
    </Stack>
  );
}

function HowToUpdateFullResource() {
  const intl = useIntl();
  return (
    <Stack>
      <FirmwareUpdateBaseMessageView
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.update_outdated_version_detected,
        })}
        message={intl.formatMessage({
          id: ETranslations.update_outdated_version_detected_desc,
        })}
        linkList={[{ url: FIRMWARE_UPDATE_FULL_RES_GUIDE }]}
      />
      <FirmwareUpdatePageFooter
        onConfirm={() => {
          openUrlExternal(FIRMWARE_UPDATE_FULL_RES_GUIDE);
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_view_tutorial,
        })}
      />
    </Stack>
  );
}

export function EnterBootModeGuide({
  deviceType,
}: {
  deviceType: IDeviceType | undefined;
}) {
  const intl = useIntl();
  if (deviceType === 'mini') {
    return (
      <Stack mb="$6">
        <Image w={353} h={224} source={ImgEnterBootGuideMini} />
        <SizableText size="$headingMd">
          {intl.formatMessage({
            id: ETranslations.update_manually_entering_bootloader_mode_desc,
          })}
        </SizableText>
        <SizableText mt="$2" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.update_manually_entering_bootloader_mode_desc,
          })}
        </SizableText>
      </Stack>
    );
  }
  return (
    <Stack mb="$6">
      <RichSizeableText
        mt="$2"
        linkList={[{ url: FIRMWARE_UPDATE_FULL_RES_GUIDE }]}
      >
        {`Follow the <a>online tutorial</a> to proceed manually, then click "Retry".`}
      </RichSizeableText>
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
  console.error('useFirmwareUpdateErrors', error);
  const defaultRetryText = 'Retry';
  return useMemo<{
    content: React.ReactNode;
    detail?: React.ReactNode;
    onRetryHandler?: () => void;
    retryText: string;
  }>(() => {
    const intl = useIntl();
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
            ? intl.formatMessage({
                id: ETranslations.update_verify_status_and_continue,
              })
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
