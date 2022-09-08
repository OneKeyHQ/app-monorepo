import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { getDeviceType } from '@onekeyfe/hd-core';
import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';
import { useDeepCompareMemo } from 'use-deep-compare';

import { Modal, ToastManager } from '@onekeyhq/components';
import { OneKeyError } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  HardwareUpdateModalRoutes,
  HardwareUpdateRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { setDeviceDoneUpdate } from '@onekeyhq/kit/src/store/reducers/settings';
import { sleep } from '@onekeyhq/kit/src/utils/promiseUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import RunningView from './RunningView';
import StateView, { StateViewTypeInfo } from './StateView';

type ProgressStepType =
  | 'pre-check'
  | 'check-device-status'
  | 'reboot-bootloader'
  | 'download-firmware'
  | 'installing'
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
  const { dispatch, serviceHardware, engine } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { device, onSuccess } = useRoute<RouteProps>().params;
  const deviceUpdates = useSettings().deviceUpdates || {};
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
        case 'check-device-status':
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

  const handleErrors = (currentStep: ProgressStepType, error: OneKeyError) => {
    const { className, key, code } = error || {};

    if (code === HardwareErrorCode.DeviceUnexpectedBootloaderMode) {
      setSuspendStep(progressStep);
      setProgressStep('reboot-bootloader');
      setProgressState('ready');
      return;
    }

    if (code === HardwareErrorCode.FirmwareUpdateDownloadFailed) {
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
    } else if (code === HardwareErrorCode.BlePermissionError) {
      setStateViewInfo({ type: 'bluetooth-turned-off' });
    } else if (currentStep === 'installing') {
      setStateViewInfo({ type: 'install-failure' });
    } else if (currentStep === 'reboot-bootloader') {
      setStateViewInfo({ type: 'reboot-bootloader-failure' });
    } else if (className === 'OneKeyHardwareError') {
      setStateViewInfo({
        type: 'common_error',
        content: {
          title: intl.formatMessage({
            // @ts-expect-error
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
        title: intl.formatMessage({
          // @ts-expect-error
          id: key,
        }),
      },
      { type: 'error' },
    );

    setProgressState('failure');
  };

  const rebootBootSuccess = async () => {
    // Waiting for the device to restart
    if (device?.deviceType === 'touch') {
      await sleep(8000);
    } else {
      await sleep(2000);
    }
    setProgressState('done');
  };

  const nextStep = (): boolean => {
    if (suspendStep) {
      setProgressStep(suspendStep);
      setSuspendStep(undefined);
      return true;
    }

    switch (progressStep) {
      case 'pre-check':
        setProgressStep('check-device-status');
        break;

      case 'check-device-status':
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

      case 'check-device-status':
        setMaxProgress(5);
        serviceHardware
          .getFeatures(platformEnv.isNative ? connectId : '')
          .then((response) => {
            if (response) {
              const deviceType = getDeviceType(response);
              const isMini = deviceType === 'mini' && !response.bootloader_mode;
              const isBoot183ClassicUpBle =
                firmwareType === 'ble' &&
                deviceType === 'classic' &&
                !response.bootloader_mode &&
                response.bootloader_version === '1.8.3';

              if (isMini || isBoot183ClassicUpBle) {
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
                // TODO check OneKey mini bootloader_mode exceptional case
                setProgressState('failure');
                return;
              }

              if (deviceType !== device?.deviceType) {
                setStateViewInfo({
                  type: 'device-mismatch',
                });
                setProgressState('failure');
                return;
              }

              setTimeout(() => {
                setProgressState('done');
              });
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
          .catch(() => {
            setStateViewInfo({ type: 'download-failure' });
            setProgressState('failure');
          });
        break;

      case 'reboot-bootloader':
        setMaxProgress(20);
        setProgress(15);
        if (device?.deviceType === 'mini') {
          // abnormal state，check the device status again
          setSuspendStep('check-device-status');
          setProgressState('failure');
          return;
        }
        serviceHardware
          .rebootToBootloader(platformEnv.isNative ? connectId : '')
          .then(() => {
            rebootBootSuccess();
          })
          .catch((e) => {
            const { code } = e;
            if (code === HardwareErrorCode.DeviceUnexpectedBootloaderMode) {
              return rebootBootSuccess();
            }
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
            handleErrors(progressStep, e);
          });
        break;

      case 'done-step':
        setMaxProgress(100);
        setProgress(100);
        engine.getWalletByDeviceId(device?.id ?? '').then((wallet) => {
          wallet.forEach((w) => {
            serviceHardware.cleanFeaturesCache(w.id);
          });
        });
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
