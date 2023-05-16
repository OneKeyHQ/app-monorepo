import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useNavigation, useRoute } from '@react-navigation/core';
import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import { Modal, ToastManager } from '@onekeyhq/components';
import type { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import type { HardwareUpdateRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/HardwareUpdate';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import * as Errors from '@onekeyhq/kit/src/utils/hardware/errors';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import { HardwareUpdateModalRoutes } from '../../../../routes/routesEnum';
import {
  closeHardwarePopup,
  setHardwarePopup,
} from '../../../../store/reducers/hardware';
import { wait } from '../../../../utils/helper';
import { UI_REQUEST } from '../../PopupHandle/showHardwarePopup.consts';
import RunningView from '../Updating/RunningView';
import StateView from '../Updating/StateView';

import type { StateViewTypeInfo } from '../Updating/StateView';
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
export type FirmwareType = 'bootloader';

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;

type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdatingModal
>;

const UpdatingBootloader: FC = () => {
  const intl = useIntl();
  const { dispatch, serviceHardware, engine } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { device, onSuccess } = useRoute<RouteProps>().params;
  const updateEvent = useAppSelector((s) => s.hardware).updateFirmwareStep;

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

  const deviceUpdates = useAppSelector((s) => s.settings.deviceUpdates);
  const willUpdateVersion = deviceUpdates?.[connectId].firmware?.version;

  const firstUpdateRef = useRef(true);
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
          return intl.formatMessage(
            { id: 'content__downloading_str' },
            {
              0: intl.formatMessage({
                id: 'content__bootloader_lowercase',
              }),
            },
          );

        case 'installing':
          return intl.formatMessage(
            { id: 'content__installing_str' },
            {
              0: intl.formatMessage({
                id: 'content__bootloader_lowercase',
              }),
            },
          );

        default:
          return '';
      }
    },
    [intl],
  );

  const [stateViewInfo, setStateViewInfo] = useState<StateViewTypeInfo>();

  useEffect(() => {
    const interval = 50;
    const timer = setInterval(() => {
      if (progress < maxProgress) {
        setProgress(progress + 0.1);
      }
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [maxProgress, progress]);

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
        typeContent = 'bootloader';

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

  useEffect(
    () => () => {
      deviceUtils.stopScan();
    },
    [],
  );

  useEffect(() => {
    const handler = () => {
      handleErrors(new Errors.UserCancel());
    };
    appUIEventBus.on(AppUIEventBusNames.HardwareCancel, handler);
    return () => {
      appUIEventBus.off(AppUIEventBusNames.HardwareCancel, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeUpdate = async () => {
    setProgressState('running');
    setProgress(0);
    setMaxProgress(5);
    if (device?.deviceType === 'mini' && progressState === 'failure') {
      if (!firstUpdateRef.current) {
        // wait mini restart
        await wait(5000);
      }
      firstUpdateRef.current = false;
    }
    try {
      // Check if you need to upgrade the boot
      const bootloaderRelease = await serviceHardware.checkBootloaderRelease(
        connectId,
        willUpdateVersion?.join('.') ?? '',
      );
      if (!bootloaderRelease?.shouldUpdate) {
        navigation.replace(HardwareUpdateModalRoutes.HardwareUpdatingModal, {
          device,
          onSuccess,
        });
        return;
      }
    } catch (e) {
      handleErrors(e as OneKeyHardwareError);
      return;
    }
    serviceHardware
      .updateBootloaderForClassicAndMini(connectId)
      .then(async (res) => {
        if (res.success) {
          engine.getWalletByDeviceId(device?.id ?? '').then((wallet) => {
            wallet.forEach((w) => {
              serviceHardware.cleanFeaturesCache(w.id);
            });
          });
          await wait(15000);
          // polling found device
          const isFoundDevice = await serviceHardware.ensureDeviceExist(
            connectId,
            40,
            true,
          );
          if (!isFoundDevice) {
            handleErrors(new Errors.DeviceNotFind());
          } else {
            await serviceHardware.getFeatures(
              platformEnv.isNative ? connectId : undefined,
            );
            setProgressState('done');
            setProgressStep('done-step');
            setTimeout(() => {
              navigation.replace(
                HardwareUpdateModalRoutes.HardwareUpdatingModal,
                {
                  device,
                  onSuccess,
                },
              );
            }, 500);
          }
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
    executeUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      hidePrimaryAction={hasStepDone}
      hideSecondaryAction={hasStepDone}
      primaryActionTranslationId={primaryActionContent}
      headerShown={false}
      closeAction={() => {
        if (progressState === 'running') {
          serviceHardware.cancel(connectId);
        }
        if (hasStepDone) {
          navigation.replace(HardwareUpdateModalRoutes.HardwareUpdatingModal, {
            device,
            onSuccess,
          });
        }
        if (navigation?.canGoBack?.()) navigation.getParent()?.goBack();
      }}
      onSecondaryActionPress={() => {
        navigation.goBack();
      }}
      onPrimaryActionPress={() => {
        if (hasStepDone) {
          navigation.replace(HardwareUpdateModalRoutes.HardwareUpdatingModal, {
            device,
            onSuccess,
          });
        } else if (stateViewInfo?.content?.nextState) {
          setStateViewInfo(stateViewInfo.content.nextState);
        } else {
          executeUpdate();
        }
      }}
    >
      {hasFailure ? (
        <StateView stateInfo={stateViewInfo} />
      ) : (
        <RunningView
          progress={progress}
          hint={progressStepDesc}
          showBatteryAlert
        />
      )}
    </Modal>
  );
};

export default UpdatingBootloader;
