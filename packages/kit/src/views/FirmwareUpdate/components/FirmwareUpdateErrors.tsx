import { useCallback, useMemo } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
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
  FIRMWARE_MANUAL_ENTERING_BOOTLOADER_MODE_GUIDE,
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
  icon,
  displayTroubleshooting,
}: {
  message?: string | undefined;
  title?: string | undefined;
  icon?: IKeyOfIcons | undefined;
  displayTroubleshooting?: boolean;
}) {
  const intl = useIntl();
  return (
    <FirmwareUpdateBaseMessageView
      icon={icon}
      tone="destructive"
      title={
        title ||
        intl.formatMessage({ id: ETranslations.global_an_error_occurred })
      }
      message={message}
      displayTroubleshooting={displayTroubleshooting}
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
        linkList={{ url: { url: FIRMWARE_UPDATE_BRIDGE_GUIDE } }}
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
        linkList={{ url: { url: FIRMWARE_UPDATE_WEB_TOOLS_URL } }}
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
        linkList={{ url: { url: FIRMWARE_UPDATE_FULL_RES_GUIDE } }}
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
            id: ETranslations.update_manually_entering_bootloader_mode,
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
        linkList={{
          url: { url: FIRMWARE_MANUAL_ENTERING_BOOTLOADER_MODE_GUIDE },
        }}
      >
        {ETranslations.update_follow_online_tutorial_to_proceed_manually}
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
  const intl = useIntl();
  console.error('useFirmwareUpdateErrors', error);
  const defaultRetryText = intl.formatMessage({
    id: ETranslations.global_retry,
  });
  return useMemo<{
    content: React.ReactNode;
    detail?: React.ReactNode;
    onRetryHandler?: () => void;
    retryText: string;
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
        content: (
          <CommonError
            icon="CrossedLargeOutline"
            title={intl.formatMessage({
              id: ETranslations.update_operation_canceled,
            })}
            message={intl.formatMessage({
              id: ETranslations.update_operation_canceled_desc,
            })}
          />
        ),
        onRetryHandler: onRetry,
        retryText: defaultRetryText,
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: HardwareErrorCode.FirmwareUpdateDownloadFailed,
      })
    ) {
      return {
        content: (
          <CommonError
            icon="DownloadOutline"
            title={intl.formatMessage({
              id: ETranslations.update_download_failed,
            })}
            message={intl.formatMessage({
              id: ETranslations.update_check_connection_try_again,
            })}
          />
        ),
        onRetryHandler: onRetry,
        retryText: defaultRetryText,
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: HardwareErrorCode.PinInvalid,
      })
    ) {
      return {
        content: (
          <CommonError
            icon="CrossedLargeOutline"
            message={intl.formatMessage({
              id: ETranslations.hardware_invalid_pin_error,
            })}
          />
        ),
        onRetryHandler: onRetry,
        retryText: defaultRetryText,
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
        content: (
          <CommonError
            icon="CrossedLargeOutline"
            title={intl.formatMessage({
              id: ETranslations.update_manually_entering_bootloader_mode,
            })}
          />
        ),
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
        code: [HardwareErrorCode.BridgeNetworkError],
      })
    ) {
      return {
        content: (
          <CommonError
            icon="CrossedLargeOutline"
            title={intl.formatMessage({
              id: ETranslations.update_bridge_network_error,
            })}
            message={intl.formatMessage({
              id: ETranslations.update_unable_to_connect_to_bridge,
            })}
          />
        ),
        onRetryHandler: onRetry,
        retryText: defaultRetryText,
      };
    }

    if (
      isHardwareErrorByCode({
        error,
        code: [HardwareErrorCode.BridgeTimeoutError],
      })
    ) {
      return {
        content: (
          <CommonError
            icon="CrossedLargeOutline"
            title={intl.formatMessage({
              id: ETranslations.update_bridge_timeout_error,
            })}
            message={intl.formatMessage({
              id: ETranslations.update_connection_to_bridge_timed_out,
            })}
          />
        ),
        onRetryHandler: onRetry,
        retryText: defaultRetryText,
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
        content: (
          <FirmwareUpdateBaseMessageView
            icon="CrossedLargeOutline"
            tone="destructive"
            title={intl.formatMessage({
              id: ETranslations.update_bridge_not_installed,
            })}
            message={intl.formatMessage({
              id: ETranslations.update_hardware_update_requires_bridge,
            })}
            linkList={{ url: { url: FIRMWARE_UPDATE_BRIDGE_GUIDE } }}
          />
        ),
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
      let message = error?.message;

      // web3Errors.provider.requestTimeout();
      if (error.code === 4500) {
        message = intl.formatMessage({
          id: ETranslations.feedback_hw_polling_time_out,
        });
      }

      return {
        content: (
          <CommonError
            icon="CrossedLargeOutline"
            message={message}
            displayTroubleshooting
          />
        ),
        onRetryHandler: onRetry,
        retryText: defaultRetryText,
      };
    }

    return {
      content: null,
      retryText: defaultRetryText,
    };
  }, [intl, error, lastFirmwareTipMessage, defaultRetryText, onRetry, result]);
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
  const intl = useIntl();
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
        onConfirmText={
          retryText || intl.formatMessage({ id: ETranslations.global_retry })
        }
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
  const intl = useIntl();
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
        onConfirmText={
          retryText || intl.formatMessage({ id: ETranslations.global_retry })
        }
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
