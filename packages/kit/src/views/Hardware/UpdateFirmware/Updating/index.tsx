import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useDeepCompareMemo } from 'use-deep-compare';

import {
  Box,
  Center,
  Image,
  Modal,
  Progress,
  Text,
  Typography,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  HardwareUpdateModalRoutes,
  HardwareUpdateRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { setDeviceDoneUpdate } from '../../../../store/reducers/settings';
import { NotInBootLoaderMode } from '../../../../utils/hardware/errors';
import {
  BLEFirmwareInfo,
  SYSFirmwareInfo,
} from '../../../../utils/updates/type';

import {
  downloadBleFirmware,
  downloadSysFirmware,
  installFirmware,
  rebootToBootloader,
} from './handle';

import type { ImageSourcePropType } from 'react-native';

type ProgressStepType =
  | 'downloading-ble'
  | 'installing-ble'
  | 'downloading-firmware'
  | 'reboot-bootloader'
  | 'installing-firmware'
  | 'done-step';

type StateViewType =
  | 'download-failure'
  | 'device-not-found'
  | 'device-connection-failure'
  | 'device-not-response'
  | 'reboot-bootloader-failure'
  | 'success';

type ProgressStateType = 'ready' | 'running' | 'done' | 'failure';

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;

type RunningViewProps = {
  progress: number;
  hint: string;
};

const RunningView: FC<RunningViewProps> = ({ progress, hint }) => {
  const intl = useIntl();
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      h="100%"
      justifyContent="space-between"
    >
      <Center flex={1} alignItems="center" w="100%" minHeight={260}>
        <Typography.DisplayMedium>
          {intl.formatMessage({ id: 'modal__updating' })}
        </Typography.DisplayMedium>

        <Box px={2} width="full" mt={8}>
          <Progress value={progress} />
        </Box>

        <Typography.Body2 mt={3} textAlign="center">
          {hint}
        </Typography.Body2>
      </Center>

      <Typography.Body2 mb={3} px={8} textAlign="center" color="text-subdued">
        {intl.formatMessage({
          id: 'modal__updating_attention',
        })}
      </Typography.Body2>
    </Box>
  );
};

type StateViewProps = {
  emoji?: string;
  sourceSrc?: ImageSourcePropType;
  title: string;
  description?: string;
  help?: string;
};

const StateView: FC<StateViewProps> = ({
  emoji,
  sourceSrc,
  title,
  description,
  help,
}) => (
  <Box
    flexDirection="column"
    alignItems="center"
    h="100%"
    justifyContent="space-between"
  >
    <Center flex={1} paddingX={4} minHeight={240}>
      <Box alignItems="center">
        {!!sourceSrc && <Image size={56} source={sourceSrc} />}
        {!!emoji && <Text fontSize={56}>{emoji}</Text>}

        <Typography.DisplayMedium mt={4}>{title}</Typography.DisplayMedium>
        {!!description && (
          <Typography.Body1 color="text-subdued" mt={2}>
            {description}
          </Typography.Body1>
        )}
      </Box>
    </Center>

    {!!help && (
      <Typography.Body2Underline px={8} textAlign="center" color="text-subdued">
        {help}
      </Typography.Body2Underline>
    )}
  </Box>
);

type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdatingModal
>;

const UpdatingModal: FC = () => {
  const intl = useIntl();
  const { dispatch } = backgroundApiProxy;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { device } = useRoute<RouteProps>().params;
  const { deviceUpdates } = useSettings();

  const [firmwareRelease, setFirmwareRelease] = useState<SYSFirmwareInfo>();
  const [bleFirmwareRelease, setBleFirmwareRelease] =
    useState<BLEFirmwareInfo>();

  const [sysFirmwarePath, setSysFirmwarePath] = useState<any>();
  const [bleFirmwarePath, setBleFirmwarePath] = useState<any>();

  const [suspendStep, setSuspendStep] = useState<ProgressStepType>();
  const [progressStep, setProgressStep] = useState<ProgressStepType>();
  const [progressState, setProgressState] = useState<ProgressStateType>();
  const progressStateMemo = useDeepCompareMemo(
    () => progressState,
    [progressState],
  );

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
        case 'downloading-ble':
          return intl.formatMessage(
            { id: 'content__downloading_str' },
            {
              0: intl.formatMessage({
                id: 'content__bluetooth_firmware_lowercase',
              }),
            },
          );
        case 'installing-ble':
          return intl.formatMessage(
            { id: 'content__installing_str' },
            {
              0: intl.formatMessage({
                id: 'content__bluetooth_firmware_lowercase',
              }),
            },
          );
        case 'downloading-firmware':
          return intl.formatMessage(
            { id: 'content__downloading_str' },
            {
              0: intl.formatMessage({
                id: 'content__firmware_lowercase',
              }),
            },
          );
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
  const stateViewContent: StateViewProps = useMemo(() => {
    switch (stateViewType) {
      case 'download-failure':
        return {
          emoji: '😞',
          title: intl.formatMessage({ id: 'modal__download_failed' }),
          description: intl.formatMessage({
            id: 'modal__download_failed_desc',
          }),
        };
      case 'device-not-found':
        return {
          emoji: '😞',
          title: intl.formatMessage({ id: 'modal__download_failed' }),
          description: intl.formatMessage({
            id: 'modal__download_failed_desc',
          }),
        };
      case 'device-connection-failure':
        return {
          emoji: '🔗',
          title: intl.formatMessage({
            id: 'modal__disconnected_during_installation',
          }),
          description: intl.formatMessage({
            id: 'modal__disconnected_during_installation_desc',
          }),
        };
      case 'reboot-bootloader-failure':
        return {
          emoji: '🔗',
          title: 'Reboot bootloader failed',
          description: 'Please check the device and try again.',
        };
      case 'device-not-response':
        return {
          emoji: '⌛',
          title: intl.formatMessage({
            id: 'modal__no_response',
          }),
          description: intl.formatMessage({
            id: 'modal__no_response_desc',
          }),
        };
      case 'success':
        return {
          emoji: '🚀',
          title: intl.formatMessage({
            id: 'modal__firmware_updated',
          }),
        };
      default:
        return {
          emoji: '💀',
          title: intl.formatMessage({
            id: 'msg__unknown_error',
          }),
        };
    }
  }, [intl, stateViewType]);

  const nextStep = (): boolean => {
    if (suspendStep) {
      setProgressStep(suspendStep);
      setSuspendStep(undefined);
      return true;
    }

    switch (progressStep) {
      case 'downloading-ble':
        setProgressStep('installing-ble');
        break;

      case 'installing-ble':
        if (firmwareRelease) {
          setProgressStep('downloading-firmware');
        } else {
          setProgressStep('done-step');
        }
        break;

      case 'downloading-firmware':
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
        if (bleFirmwareRelease) {
          setProgressStep('downloading-ble');
        } else {
          setProgressStep('downloading-firmware');
        }
        return false;
    }
    return true;
  };

  const executeStep = () => {
    switch (progressStep) {
      case 'downloading-ble':
        if (!bleFirmwareRelease) {
          setProgressState('done');
          return;
        }
        downloadBleFirmware({
          url: bleFirmwareRelease?.url ?? '',
          onProgress: (_progress) => {
            setProgress(_progress);
          },
        })
          .then((file) => {
            console.log(
              'downloadBleFirmware success: step:',
              progressStep,
              ' result:',
              file,
            );
            setBleFirmwarePath(file);
            setProgressState('done');
          })
          .catch(() => {
            setProgressState('failure');
          });
        break;

      case 'installing-ble':
        installFirmware(connectId, bleFirmwarePath, 'ble', (_progress) => {
          setProgress(_progress);
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

      case 'downloading-firmware':
        if (!firmwareRelease) {
          setProgressState('done');
          return;
        }
        downloadSysFirmware({
          url: firmwareRelease?.url ?? '',
          onProgress: (_progress) => {
            setProgress(_progress);
          },
        })
          .then((file) => {
            console.log(
              'downloadSysFirmware success: step:',
              progressStep,
              ' result:',
              file,
            );
            setSysFirmwarePath(file);
            setProgressState('done');
          })
          .catch(() => {
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

      case 'installing-firmware':
        installFirmware(connectId, sysFirmwarePath, 'firmware', (_progress) => {
          setProgress(_progress);
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
        setProgress(0);
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
        // download failed
        if (
          progressStep === 'downloading-ble' ||
          progressStep === 'downloading-firmware'
        ) {
          setStateViewType('download-failure');
        }
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

    setFirmwareRelease(firmware);
    setBleFirmwareRelease(ble);

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
        <StateView {...stateViewContent} />
      ) : (
        <RunningView progress={progress} hint={progressStepDesc} />
      )}
    </Modal>
  );
};

export default UpdatingModal;
