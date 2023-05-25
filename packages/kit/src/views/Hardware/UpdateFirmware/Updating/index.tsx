import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useNavigation, useRoute } from '@react-navigation/core';
import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import { Modal, ToastManager } from '@onekeyhq/components';
import type { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppSelector, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import type { HardwareUpdateRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/HardwareUpdate';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { setDeviceDoneUpdate } from '@onekeyhq/kit/src/store/reducers/settings';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import {
  closeHardwarePopup,
  setHardwarePopup,
} from '../../../../store/reducers/hardware';
import { UI_REQUEST } from '../../PopupHandle/showHardwarePopup.consts';

import RunningView from './RunningView';
import StateView from './StateView';

import type { HardwareUpdateModalRoutes } from '../../../../routes/routesEnum';
import type { StateViewTypeInfo } from './StateView';
import type { RouteProp } from '@react-navigation/core';

type ProgressStepType =
  | 'pre-check'
  | 'check-latest-resource'
  | 'download-latest-resource'
  | 'upload-latest-resource'
  | 'check-device-status'
  | 'reboot-bootloader'
  | 'download-firmware'
  | 'installing'
  | 'done-step';

type ProgressStateType = 'running' | 'done' | 'failure';
export type FirmwareType = 'firmware' | 'ble';

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;

type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdatingModal
>;

const UpdatingModal: FC = () => {
  const intl = useIntl();
  const { dispatch, serviceHardware, engine } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { device, onSuccess } = useRoute<RouteProps>().params;
  const deviceUpdates = useSettings().deviceUpdates || {};
  const { ble: bleFirmware, firmware } = deviceUpdates[device?.mac ?? ''] || {};
  const updateEvent = useAppSelector((s) => s.hardware).updateFirmwareStep;

  const [firmwareType, setFirmwareType] = useState<FirmwareType>();

  const [progressStep, setProgressStep] = useState<ProgressStepType>();
  const progressStepRef = useRef<ProgressStepType>();
  const [progressState, setProgressState] = useState<ProgressStateType>();

  const autoEnterBootFailureCountRef = useRef(0);

  useEffect(() => {
    progressStepRef.current = progressStep;
  }, [progressStep]);

  // Prevents screen locking
  useKeepAwake();

  const connectId = useMemo(() => device?.mac ?? '', [device]);

  const deviceType = useMemo(
    () => device?.deviceType as IOneKeyDeviceType | undefined,
    [device],
  );

  const hasFailure = progressState === 'failure';
  const hasStepDone = useMemo(
    () => progressStep === 'done-step',
    [progressStep],
  );

  const [progress, setProgress] = useState(0);
  const [maxProgress, setMaxProgress] = useState(0);
  const [progressStepDesc, setProgressStepDesc] = useState('Updating...');

  const generateProgressStepDesc = useCallback(
    (step: ProgressStepType | undefined) => {
      switch (step) {
        case 'pre-check':
        case 'check-device-status':
          return intl.formatMessage({
            id: 'action__checking',
          });
        case 'check-latest-resource':
          return intl.formatMessage({
            id: 'content__firmware_check_latest_resource',
          });
        case 'download-latest-resource':
          return intl.formatMessage({
            id: 'content__firmware_download_resource',
          });
        case 'upload-latest-resource':
          return intl.formatMessage({
            id: 'content__firmware_upload_resource',
          });
        case 'reboot-bootloader':
          return intl.formatMessage({
            id: 'content__firmware_starting_upgrade_mode',
          });
        case 'download-firmware':
          if (firmwareType === 'ble') {
            return intl.formatMessage(
              { id: 'content__downloading_str' },
              {
                0: intl.formatMessage({
                  id: 'content__bluetooth_firmware_lowercase',
                }),
              },
            );
          }
          return intl.formatMessage(
            { id: 'content__downloading_str' },
            {
              0: intl.formatMessage({
                id: 'content__firmware_lowercase',
              }),
            },
          );

        case 'installing':
          if (firmwareType === 'ble') {
            return intl.formatMessage(
              { id: 'content__installing_str' },
              {
                0: intl.formatMessage({
                  id: 'content__bluetooth_firmware_lowercase',
                }),
              },
            );
          }
          return intl.formatMessage(
            { id: 'content__installing_str' },
            {
              0: intl.formatMessage({
                id: 'content__firmware_lowercase',
              }),
            },
          );

        default:
          return '';
      }
    },
    [firmwareType, intl],
  );

  const [stateViewInfo, setStateViewInfo] = useState<StateViewTypeInfo>();

  useEffect(() => {
    let interval = 10;
    if (firmwareType === 'firmware') {
      interval = 50;
    } else {
      interval = 10;
    }

    const timer = setInterval(() => {
      if (progress < maxProgress) {
        setProgress(progress + 0.1);
      }
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [firmwareType, maxProgress, progress]);

  useEffect(() => {
    switch (updateEvent) {
      case 'CheckLatestUiResource':
        setMaxProgress(5);
        setProgressStep('check-latest-resource');
        break;
      case 'DownloadLatestUiResource':
        setMaxProgress(5);
        setProgressStep('download-latest-resource');
        break;
      case 'DownloadLatestUiResourceSuccess':
        setMaxProgress(10);
        break;
      case 'UpdateSysResource':
        setProgressStep('upload-latest-resource');
        break;
      case 'UpdateSysResourceSuccess':
        setMaxProgress(20);
        setProgressStep('check-device-status');
        break;
      case 'AutoRebootToBootloader':
        setMaxProgress(25);
        setProgressStep('reboot-bootloader');
        break;
      case 'GoToBootloaderSuccess':
        setMaxProgress(30);
        break;
      case 'DownloadFirmware':
        setProgressStep('download-firmware');
        break;
      case 'DownloadFirmwareSuccess':
        setProgressStep('installing');
        break;
      case 'ConfirmOnDevice':
        setMaxProgress(35);
        setTimeout(() => {
          dispatch(
            setHardwarePopup({
              uiRequest: UI_REQUEST.REQUEST_BUTTON,
              payload: {
                deviceType,
                deviceId: '',
                deviceConnectId: connectId,
              },
            }),
          );
        }, 300);
        break;
      case 'FirmwareEraseSuccess':
        setMaxProgress(90);
        dispatch(closeHardwarePopup());
        break;
      case 'StartTransferData':
        setMaxProgress(80);
        break;
      case 'InstallingFirmware':
        setMaxProgress(99);
        break;
      default:
        setProgressStep('pre-check');
        break;
    }
  }, [deviceType, connectId, dispatch, updateEvent]);

  const handleErrors = (error: OneKeyHardwareError) => {
    const { className, key, code } = error || {};

    switch (code) {
      case HardwareErrorCode.FirmwareUpdateLimitOneDevice:
        setStateViewInfo({ type: 'device-not-only-ones' });
        break;
      case HardwareErrorCode.DeviceNotFound:
        setStateViewInfo({ type: 'device-not-found' });
        break;

      case HardwareErrorCode.DeviceUnexpectedBootloaderMode:
        setStateViewInfo({ type: 'reboot-bootloader-failure' });
        break;

      case HardwareErrorCode.FirmwareUpdateDownloadFailed:
        // eslint-disable-next-line no-case-declarations
        let typeContent = '';
        if (firmwareType === 'ble') {
          typeContent = intl.formatMessage({
            id: 'content__bluetooth_firmware_lowercase',
          });
        } else if (firmwareType === 'firmware') {
          typeContent = intl.formatMessage({
            id: 'content__firmware_lowercase',
          });
        }

        setStateViewInfo({
          type: 'download-failure',
          content: {
            title: intl.formatMessage(
              { id: 'content__downloading_str' },
              {
                0: typeContent,
              },
            ),
          },
        });
        break;
      case HardwareErrorCode.BlePermissionError:
        setStateViewInfo({ type: 'bluetooth-turned-off' });
        break;
      case HardwareErrorCode.FirmwareUpdateManuallyEnterBoot:
        setStateViewInfo({
          type: 'manually-enter-bootloader-one',
          content: {
            deviceType,
            nextState:
              deviceType === 'mini'
                ? {
                    type: 'manually-enter-bootloader-two',
                    content: {
                      deviceType,
                      primaryActionTranslationId: 'action__continue',
                    },
                  }
                : undefined,
          },
        });
        break;
      case HardwareErrorCode.ActionCancelled:
      case HardwareErrorCode.PinCancelled:
      case HardwareErrorCode.FirmwareUpdateAutoEnterBootFailure:
        autoEnterBootFailureCountRef.current += 1;
        if (progressStepRef.current === 'reboot-bootloader') {
          if (deviceType === 'mini') {
            setStateViewInfo({
              type: 'manually-enter-bootloader-one',
              content: {
                deviceType,
                nextState: {
                  type: 'manually-enter-bootloader-two',
                  content: {
                    deviceType,
                    primaryActionTranslationId: 'action__continue',
                  },
                },
              },
            });
          } else if (autoEnterBootFailureCountRef.current >= 2) {
            setStateViewInfo({
              type: 'manually-enter-bootloader-one',
              content: {
                deviceType,
              },
            });
          } else {
            setStateViewInfo({ type: 'reboot-bootloader-failure' });
          }
        } else {
          setStateViewInfo({
            type: 'common_error',
            content: {
              title: intl.formatMessage({
                id: key,
                defaultMessage: error.message,
              }),
            },
          });
        }
        break;
      default:
        if (className === 'OneKeyHardwareError') {
          setStateViewInfo({
            type: 'common_error',
            content: {
              title: intl.formatMessage({
                id: key,
                defaultMessage: error.message,
              }),
            },
          });
        } else {
          // other error
          setStateViewInfo({
            type: 'common_error',
            content: {
              title: `「${code}」${error.message}`,
            },
          });
        }

        ToastManager.show(
          {
            title: intl.formatMessage({ id: key }),
          },
          { type: 'error' },
        );
        break;
    }

    setProgressState('failure');
  };

  const executeUpdate = () => {
    if (!firmwareType) return;

    setProgressState('running');
    setProgress(0);
    serviceHardware
      .autoUpdateFirmware(connectId, firmwareType, deviceType)
      .then((res) => {
        if (res.success) {
          // clear the upgrade status
          dispatch(
            setDeviceDoneUpdate({
              connectId,
              type: firmwareType,
            }),
          );

          engine.getWalletByDeviceId(device?.id ?? '').then((wallet) => {
            wallet.forEach((w) => {
              serviceHardware.cleanFeaturesCache(w.id);
            });
          });
          setProgressState('done');
          setProgressStep('done-step');
          setStateViewInfo({ type: 'success' });
          return;
        }
        const error = deviceUtils.convertDeviceError(res.payload);
        handleErrors(error);
      })
      .catch((e) => {
        setStateViewInfo({ type: 'download-failure' });
        setProgressState('failure');
        handleErrors(e);
      });
  };

  useEffect(() => {
    if (!device) {
      // device not found
      return;
    }

    if (bleFirmware) {
      setFirmwareType('ble');
    } else if (firmware) {
      setFirmwareType('firmware');
    }

    executeUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmwareType]);

  useEffect(() => {
    const hint = generateProgressStepDesc(progressStep);
    setProgressStepDesc(hint);
  }, [generateProgressStepDesc, progressStep]);

  const primaryActionContent = useMemo(() => {
    if (hasStepDone) return 'action__done';
    if (stateViewInfo?.content?.primaryActionTranslationId)
      return stateViewInfo.content.primaryActionTranslationId;
    if (stateViewInfo?.content?.nextState) return 'action__next';
    return 'action__retry';
  }, [
    hasStepDone,
    stateViewInfo?.content?.nextState,
    stateViewInfo?.content?.primaryActionTranslationId,
  ]);

  return (
    <Modal
      closeOnOverlayClick={false}
      footer={hasFailure || hasStepDone ? undefined : null}
      maxHeight={560}
      hideSecondaryAction={hasStepDone}
      primaryActionTranslationId={primaryActionContent}
      headerShown={false}
      closeAction={() => {
        if (progressState === 'running') {
          serviceHardware.cancel(connectId);
        }
        if (hasStepDone) {
          onSuccess?.();
        }
        if (navigation?.canGoBack?.()) navigation.getParent()?.goBack();
      }}
      onSecondaryActionPress={() => {
        navigation.goBack();
      }}
      onPrimaryActionPress={() => {
        if (hasStepDone) {
          if (navigation?.canGoBack?.()) navigation.getParent()?.goBack();
          onSuccess?.();
        } else if (stateViewInfo?.content?.nextState) {
          setStateViewInfo(stateViewInfo.content.nextState);
        } else {
          executeUpdate();
        }
      }}
    >
      {hasStepDone || hasFailure ? (
        <StateView stateInfo={stateViewInfo} />
      ) : (
        <RunningView progress={progress} hint={progressStepDesc} />
      )}
    </Modal>
  );
};

export default UpdatingModal;
