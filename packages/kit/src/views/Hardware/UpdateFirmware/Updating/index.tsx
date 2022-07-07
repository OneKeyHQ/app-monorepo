import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';
import { useDeepCompareMemo } from 'use-deep-compare';

import { Modal, ToastManager } from '@onekeyhq/components';
import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  HardwareUpdateModalRoutes,
  HardwareUpdateRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { setDeviceDoneUpdate } from '@onekeyhq/kit/src/store/reducers/settings';
import {
  FirmwareDownloadFailed,
  NeedBluetoothTurnedOn,
  NotInBootLoaderMode,
} from '@onekeyhq/kit/src/utils/hardware/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import RunningView from './RunningView';
import StateView, { StateViewTypeInfo } from './StateView';

type ProgressStepType =
  | 'pre-check'
  | 'reboot-bootloader'
  | 'download-firmware'
  | 'installing'
  | 'wait-for-reboot'
  | 'done-step';

type ProgressStateType = 'ready' | 'running' | 'done' | 'failure';
export type FirmwareType = 'firmware' | 'ble';

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;

type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdatingModal
>;

const UpdatingModal: FC = () => {
  const intl = useIntl();
  const { dispatch, serviceHardware } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { device, onSuccess } = useRoute<RouteProps>().params;
  const { deviceUpdates } = useSettings() || {};
  const { ble: bleFirmware, firmware } = deviceUpdates[device?.mac ?? ''] || {};

  const [firmwareType, setFirmwareType] = useState<FirmwareType>('firmware');

  const [suspendStep, setSuspendStep] = useState<ProgressStepType>();
  const [progressStep, setProgressStep] = useState<ProgressStepType>();
  const [progressState, setProgressState] = useState<ProgressStateType>();
  const progressStateMemo = useDeepCompareMemo(
    () => progressState,
    [progressState],
  );

  // Prevents screen locking
  useKeepAwake();

  const connectId = useMemo(() => device?.mac ?? '', [device]);

  const hasFailure = useMemo(
    () => progressStateMemo === 'failure',
    [progressStateMemo],
  );
  const hasStepDone = useMemo(
    () => progressStep === 'done-step',
    [progressStep],
  );

  const [downloadedFirmware, setDownloadedFirmware] = useState<string>();

  const [progress, setProgress] = useState(0);
  const progressMemo = useDeepCompareMemo(() => progress, [progress]);
  const [maxProgress, setMaxProgress] = useState(0);
  const [progressStepDesc, setProgressStepDesc] = useState('Updating...');

  const generateProgressStepDesc = useCallback(
    (step: ProgressStepType | undefined) => {
      switch (step) {
        case 'pre-check':
          return intl.formatMessage({
            id: 'action__checking',
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

        case 'reboot-bootloader':
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

        case 'wait-for-reboot':
          return intl.formatMessage({
            id: 'content__wait_reboot_device_check_update_fireware',
          });

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

  const handleErrors = (currentStep: ProgressStepType, error: Error) => {
    console.log('handle error:', currentStep, error);

    if (error instanceof NotInBootLoaderMode) {
      setSuspendStep(progressStep);
      setProgressStep('reboot-bootloader');
      setProgressState('ready');
      return;
    }

    if (error instanceof FirmwareDownloadFailed) {
      // Download failed. Download again
      setProgressStep('download-firmware');

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
    } else if (error instanceof NeedBluetoothTurnedOn) {
      setStateViewInfo({ type: 'bluetooth-turned-off' });
    } else if (currentStep === 'installing') {
      setStateViewInfo({ type: 'install-failure' });
    } else if (currentStep === 'reboot-bootloader') {
      setStateViewInfo({ type: 'reboot-bootloader-failure' });
    } else if (currentStep === 'wait-for-reboot') {
      setStateViewInfo({ type: 'check-update-failure' });
    }

    if (error instanceof OneKeyHardwareError) {
      ToastManager.show(
        {
          title: intl.formatMessage({ id: error.key }),
        },
        { type: 'error' },
      );
    }

    setProgressState('failure');
  };

  const nextStep = (): boolean => {
    if (suspendStep) {
      setProgressStep(suspendStep);
      setSuspendStep(undefined);
      return true;
    }

    switch (progressStep) {
      case 'pre-check':
        setProgressStep('download-firmware');
        break;

      case 'download-firmware':
        setProgressStep('installing');
        break;

      case 'installing':
        setProgressStep('done-step');
        break;

      case 'done-step':
        // last step
        return false;

      default:
        setProgressStep('pre-check');
        return false;
    }
    return true;
  };

  const executeStep = () => {
    console.log('UpdatingModal executeStep', progressStep);

    switch (progressStep) {
      case 'pre-check':
        setMaxProgress(5);
        if (platformEnv.isNative) return setProgressState('done');
        serviceHardware
          .searchDevices()
          .then((response) => {
            if (response.success) {
              const devices = response.payload;
              if (devices.length === 0) {
                setStateViewInfo({ type: 'device-not-found' });
                setProgressState('failure');
              } else if (devices.length > 1) {
                setStateViewInfo({ type: 'device-not-only-ones' });
                setProgressState('failure');
              } else {
                setProgressState('done');
              }
              return;
            }
            setStateViewInfo({ type: 'pre-check-failure' });
            setProgressState('failure');
          })
          .catch(() => {
            setStateViewInfo({ type: 'pre-check-failure' });
            setProgressState('failure');
          });
        break;

      case 'download-firmware':
        setMaxProgress(15);
        setProgress(5);
        serviceHardware
          .downloadFirmware(
            firmwareType === 'ble' ? bleFirmware?.webUpdate : firmware?.url,
          )
          .then((response) => {
            setDownloadedFirmware(response);
            setProgressState('done');
          })
          .catch((e) => {
            setStateViewInfo({ type: 'download-failure' });
            setProgressState('failure');
          });
        break;

      case 'reboot-bootloader':
        setMaxProgress(20);
        setProgress(15);
        serviceHardware
          .rebootToBootloader(connectId)
          .then(() => {
            // Waiting for the device to restart
            setTimeout(() => {
              setProgressState('done');
            }, 1000);
          })
          .catch((e) => {
            handleErrors(progressStep, e);
          });
        break;

      case 'installing':
        setMaxProgress(95);
        setProgress(20);
        serviceHardware
          .installFirmware(connectId, firmwareType, downloadedFirmware)
          .then(() => {
            // clear the upgrade status
            dispatch(
              setDeviceDoneUpdate({
                connectId,
                type: firmwareType,
              }),
            );
            setProgressState('done');
          })
          .catch((e) => {
            console.log('===: installing error:', e);

            handleErrors(progressStep, e);
          });
        break;

      case 'done-step':
        setMaxProgress(100);
        setProgress(100);
        setProgressState('done');
        setStateViewInfo({ type: 'success' });
        break;

      default:
        break;
    }
  };

  const retryStep = () => {
    setProgressState('ready');
  };

  // Control the overall flow of the update process
  useEffect(() => {
    switch (progressStateMemo) {
      case 'ready':
        setProgressState('running');
        break;
      case 'running':
        executeStep();
        break;
      case 'done':
        if (nextStep()) {
          // auto next step
          setProgressState('ready');
        }
        break;
      case 'failure':
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressStateMemo]);

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

    nextStep();
    retryStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const hint = generateProgressStepDesc(progressStep);
    setProgressStepDesc(hint);
  }, [generateProgressStepDesc, progressStep]);

  return (
    <Modal
      closeOnOverlayClick={false}
      footer={hasFailure || hasStepDone ? undefined : null}
      maxHeight={560}
      hideSecondaryAction={hasStepDone}
      primaryActionTranslationId={
        hasStepDone ? 'action__done' : 'action__retry'
      }
      headerShown={false}
      closeAction={() => {
        if (progressState === 'running') {
          serviceHardware.cancel(connectId);
        }
        if (hasStepDone) {
          onSuccess?.();
        }
        if (navigation.canGoBack()) navigation.getParent()?.goBack();
      }}
      onSecondaryActionPress={() => {
        navigation.goBack();
      }}
      onPrimaryActionPress={() => {
        if (hasStepDone) {
          if (navigation.canGoBack()) navigation.getParent()?.goBack();
          onSuccess?.();
        } else {
          retryStep();
        }
      }}
    >
      {hasStepDone || hasFailure ? (
        <StateView stateInfo={stateViewInfo} />
      ) : (
        <RunningView progress={progressMemo} hint={progressStepDesc} />
      )}
    </Modal>
  );
};

export default UpdatingModal;
