import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useDeepCompareMemo } from 'use-deep-compare';

import { Modal } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  HardwareUpdateModalRoutes,
  HardwareUpdateRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { setDeviceDoneUpdate } from '@onekeyhq/kit/src/store/reducers/settings';
import { HardwareSDK } from '@onekeyhq/kit/src/utils/hardware';
import { NotInBootLoaderMode } from '@onekeyhq/kit/src/utils/hardware/errors';
import {
  BLEFirmwareInfo,
  SYSFirmwareInfo,
} from '@onekeyhq/kit/src/utils/updates/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { installFirmware, rebootToBootloader } from './handle';
import RunningView from './RunningView';
import StateView from './StateView';

import type { StateViewType } from './StateView';

type ProgressStepType =
  | 'pre-check'
  | 'installing-ble'
  | 'reboot-bootloader'
  | 'installing-firmware'
  | 'done-step';

type ProgressStateType = 'ready' | 'running' | 'done' | 'failure';

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;

type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdatingModal
>;

const InstalBaseProgress = 10;

const UpdatingModal: FC = () => {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { device } = useRoute<RouteProps>().params;
  const { deviceUpdates } = useSettings() || {};

  const [firmwareRelease, setFirmwareRelease] = useState<SYSFirmwareInfo>();
  const [bleFirmwareRelease, setBleFirmwareRelease] =
    useState<BLEFirmwareInfo>();

  const [suspendStep, setSuspendStep] = useState<ProgressStepType>();
  const [progressStep, setProgressStep] = useState<ProgressStepType>();
  const [progressState, setProgressState] = useState<ProgressStateType>();
  const progressStateMemo = useDeepCompareMemo(
    () => progressState,
    [progressState],
  );

  useEffect(() => {
    const uiEvent = (e: any) => {
      console.log('UpdatingModal HardwareSDK UI_EVENT', e);
    };

    HardwareSDK.on('UI_EVENT', uiEvent);
    return () => {
      HardwareSDK.off('UI_EVENT', uiEvent);
    };
  }, []);

  const connectId = useMemo(() => device?.mac ?? '', [device]);

  const hasFailure = useMemo(
    () => progressStateMemo === 'failure',
    [progressStateMemo],
  );
  const hasStepDone = useMemo(
    () => progressStep === 'done-step',
    [progressStep],
  );

  const [progress, setProgress] = useState(0);
  const [progressStepDesc, setProgressStepDesc] = useState('Updating...');
  const generateProgressStepDesc = useCallback(
    (step: ProgressStepType | undefined) => {
      switch (step) {
        case 'pre-check':
          return 'Checking...';
        // case 'downloading-ble':
        //   return intl.formatMessage(
        //     { id: 'content__downloading_str' },
        //     {
        //       0: intl.formatMessage({
        //         id: 'content__bluetooth_firmware_lowercase',
        //       }),
        //     },
        //   );
        case 'installing-ble':
          return intl.formatMessage(
            { id: 'content__installing_str' },
            {
              0: intl.formatMessage({
                id: 'content__bluetooth_firmware_lowercase',
              }),
            },
          );
        // case 'downloading-firmware':
        //   return intl.formatMessage(
        //     { id: 'content__downloading_str' },
        //     {
        //       0: intl.formatMessage({
        //         id: 'content__firmware_lowercase',
        //       }),
        //     },
        //   );
        case 'reboot-bootloader':
          return '进入Bootloader模式...';
        case 'installing-firmware':
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
    [intl],
  );

  const [stateViewType, setStateViewType] = useState<StateViewType>();

  const nextStep = (): boolean => {
    if (suspendStep) {
      setProgressStep(suspendStep);
      setSuspendStep(undefined);
      return true;
    }

    switch (progressStep) {
      case 'pre-check':
        if (bleFirmwareRelease) {
          setProgressStep('installing-ble');
        } else {
          setProgressStep('installing-firmware');
        }
        break;

      case 'installing-ble':
        if (firmwareRelease) {
          setProgressStep('installing-firmware');
        } else {
          setProgressStep('done-step');
        }
        break;

      case 'installing-firmware':
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
        setProgress(0);
        if (platformEnv.isNative) return setProgressState('done');
        HardwareSDK.searchDevices()
          .then((response) => {
            if (response.success) {
              const devices = response.payload;
              const [searchDevice] = devices;
              if (devices.length === 0) {
                setStateViewType('device-not-found');
                setProgressState('failure');
              } else if (devices.length > 1) {
                setStateViewType('device-not-only-ones');
                setProgressState('failure');
              } else if (searchDevice.connectId !== connectId) {
                setStateViewType('device-mismatch');
                setProgressState('failure');
              } else {
                setProgressState('done');
              }
              return;
            }

            setStateViewType('pre-check-failure');
            setProgressState('failure');
          })
          .catch(() => {
            setStateViewType('pre-check-failure');
            setProgressState('failure');
          });
        break;

      case 'reboot-bootloader':
        rebootToBootloader(connectId)
          .then(() => {
            setProgressState('done');
          })
          .catch(() => {
            setProgressState('failure');
          });
        break;

      case 'installing-ble':
        setProgress(InstalBaseProgress);
        installFirmware(connectId, 'ble', (_progress) => {
          setProgress(InstalBaseProgress + _progress * 0.8);
        })
          .then(() => {
            dispatch(
              setDeviceDoneUpdate({
                key: connectId,
                type: 'ble',
              }),
            );
            setProgressState('done');
          })
          .catch((e) => {
            console.log('installFirmware error:', e);

            if (e instanceof NotInBootLoaderMode) {
              setSuspendStep(progressStep);
              setProgressStep('reboot-bootloader');
              setProgressState('ready');
              return;
            }

            setProgressState('failure');
          });
        break;

      case 'installing-firmware':
        setProgress(InstalBaseProgress);
        installFirmware(connectId, 'firmware', (_progress) => {
          setProgress(InstalBaseProgress + _progress * 0.8);
        })
          .then(() => {
            dispatch(
              setDeviceDoneUpdate({
                key: connectId,
                type: 'firmware',
              }),
            );
            setProgressState('done');
          })
          .catch((e) => {
            console.log('installFirmware error:', e);

            if (e instanceof NotInBootLoaderMode) {
              setSuspendStep(progressStep);
              setProgressStep('reboot-bootloader');
              setProgressState('ready');
              return;
            }

            setProgressState('failure');
          });
        break;

      case 'done-step':
        setProgress(100);
        setProgressState('done');
        setStateViewType('success');
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
        if (progressStep === 'reboot-bootloader') {
          setStateViewType('reboot-bootloader-failure');
        }
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

    const { ble, firmware } = deviceUpdates[device.mac] || {};

    if (ble) {
      setBleFirmwareRelease(ble);
    } else if (firmware) {
      setFirmwareRelease(firmware);
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
      footer={hasFailure || hasStepDone ? undefined : null}
      maxHeight={560}
      hideSecondaryAction={hasStepDone}
      primaryActionTranslationId={
        hasStepDone ? 'action__done' : 'action__retry'
      }
      onSecondaryActionPress={() => {
        navigation.goBack();
      }}
      onPrimaryActionPress={() => {
        if (hasStepDone) {
          navigation.goBack();
        } else {
          retryStep();
        }
      }}
    >
      {hasStepDone || hasFailure ? (
        <StateView stateViewType={stateViewType} />
      ) : (
        <RunningView progress={progress} hint={progressStepDesc} />
      )}
    </Modal>
  );
};

export default UpdatingModal;
