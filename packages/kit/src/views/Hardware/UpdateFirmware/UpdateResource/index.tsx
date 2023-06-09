/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  Image,
  LottieView,
  Modal,
  Progress,
  Text,
  useTheme,
} from '@onekeyhq/components';
import RestartTouch from '@onekeyhq/kit/assets/animations/restart-touch.json';
import SelectFirmwareResources from '@onekeyhq/kit/assets/select_firmware_resources.png';
import SelectFirmwareResourcesDark from '@onekeyhq/kit/assets/select_firmware_resources_dark.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import type { HardwareUpdateRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/HardwareUpdate';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';

import MacPermission from './MacPermission';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;
type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdateWarningModal
>;

const ERRORS = {
  NOT_FOUND_DEVICE: 'NOT_FOUND_DEVICE',
  NOT_FOUND_DISK_PATH: 'NOT_FOUND_DISK_PATH',
  MAS_DISK_PATH_PERMISSION_DENIED: 'MAS_DISK_PATH_PERMISSION_DENIED',
  DISK_ACCESS_ERROR: 'DISK_ACCESS_ERROR',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
};

const { isMas } = platformEnv;

const StepsItem: FC<{ finished?: boolean; inProgress?: boolean }> = ({
  finished,
  inProgress,
}) => (
  <Center size="18px" ml="8px">
    <Box
      size="8px"
      borderRadius="full"
      bgColor={finished || inProgress ? 'interactive-default' : 'icon-disabled'}
    />
    {inProgress && (
      <Box
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        zIndex={-1}
        bgColor="interactive-default"
        opacity={0.3}
        borderRadius="full"
      />
    )}
  </Center>
);

const UpdateWarningModal: FC = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const intl = useIntl();
  const { themeVariant } = useTheme();
  const { device, onSuccess } = useRoute<RouteProps>().params;
  const { serviceHardware } = backgroundApiProxy;

  const [isInBoardloader, setIsInBoardloader] = useState(false);
  const [updateResult, setUpdateResult] = useState(false);
  const [copyFileProgress, setCopyFileProgress] = useState(0);
  const [resError, setResError] = useState('');
  // confirm choose disk path for Mac app store version
  const [confirmChooseDisk, setConfirmChooseDisk] = useState(false);
  const [isDiskPermissionDenied, setIsDiskPermissionDenied] = useState(false);

  const connectId = useMemo(() => device?.mac ?? '', [device]);
  const { deviceUpdates } = useSettings();
  const { firmware } = deviceUpdates?.[connectId] || {};

  const masDialogTitle = intl.formatMessage({
    id: 'title__select_disk_and_continue',
  });
  const masDialogButtonLabel = intl.formatMessage({ id: 'action__continue' });

  const rebootToBoardloader = useCallback(() => {
    serviceHardware
      .rebootToBoardloader(connectId)
      .then(() => setIsInBoardloader(true))
      .catch((e) => {
        const error = deviceUtils.convertDeviceError(e);
        deviceUtils.showErrorToast(error);
        setResError(error.message);
      });
  }, [connectId, serviceHardware]);

  useEffect(() => {
    if (!device) {
      return;
    }
    rebootToBoardloader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateTouchResource = useCallback(() => {
    window.desktopApi?.touchUpdateResource({
      resourceUrl: firmware?.fullResource ?? '',
      dialogTitle: masDialogTitle,
      buttonLabel: masDialogButtonLabel,
    });
  }, [firmware?.fullResource, masDialogButtonLabel, masDialogTitle]);

  const shouldRetry = useMemo(
    () => !!(!updateResult && resError),
    [updateResult, resError],
  );

  const retry = useCallback(async () => {
    setConfirmChooseDisk(false);
    setResError('');
    const response = await serviceHardware.searchDevices();
    if (!response.success) {
      // Failed to search for device, retry copy resource
      updateTouchResource();
      return;
    }
    if (
      (response.payload ?? []).find((d) =>
        equalsIgnoreCase(d.connectId, connectId),
      )
    ) {
      setIsInBoardloader(false);
      rebootToBoardloader();
      return;
    }
    updateTouchResource();
  }, [connectId, rebootToBoardloader, updateTouchResource, serviceHardware]);

  //  polling device when update success
  useEffect(() => {
    if (!updateResult) return;

    deviceUtils.startDeviceScan(
      (response) => {
        if (!response.success) {
          return;
        }
        if (
          (response.payload ?? []).find((d) =>
            equalsIgnoreCase(d.connectId, connectId),
          )
        ) {
          deviceUtils.stopScan();
          navigation.replace(HardwareUpdateModalRoutes.HardwareUpdatingModal, {
            device,
            onSuccess,
          });
        }
      },
      () => {},
      1,
      3000,
      Number.MAX_VALUE,
    );

    return () => {
      deviceUtils.stopScan();
    };
  }, [updateResult, connectId, device, navigation, onSuccess]);

  useEffect(() => {
    if (isInBoardloader) {
      if (!isMas) {
        updateTouchResource();
      }
      window.desktopApi?.on?.(
        'touch/update-res-success',
        ({ error, result }: { error: Error; result: boolean }) => {
          debugLogger.hardwareSDK.info('update result =======> ', result);
          setUpdateResult(result);
          if (error) {
            debugLogger.hardwareSDK.info('update error =======> ', error);
            let message = '';
            switch (error.message) {
              case ERRORS.DISK_ACCESS_ERROR:
                message = intl.formatMessage({
                  id: 'msg__disk_access_is_denied',
                });
                setIsDiskPermissionDenied(true);
                break;
              case ERRORS.NOT_FOUND_DISK_PATH:
                message = intl.formatMessage({
                  id: 'msg__the_disk_path_was_not_found',
                });
                break;
              case ERRORS.MAS_DISK_PATH_PERMISSION_DENIED:
                // return to step2 to choose disk path
                setResError('');
                setConfirmChooseDisk(false);
                message = intl.formatMessage({
                  id: 'msg__unable_to_access_disk_onekey_data',
                });
                return;
              case ERRORS.DOWNLOAD_FAILED:
                message = intl.formatMessage({
                  id: 'modal__download_failed_desc',
                });
                break;
              default:
                message = error.message;
                break;
            }
            setResError(message);
          }
        },
      );

      window.desktopApi?.on?.('touch/update-progress', (progress: number) => {
        setCopyFileProgress(progress);
      });
    }
  }, [intl, isInBoardloader, updateTouchResource, navigation, firmware]);

  const showMasTip = useMemo(
    () => isInBoardloader && isMas && !confirmChooseDisk,
    [isInBoardloader, confirmChooseDisk],
  );

  const step1 = useMemo(() => !isInBoardloader, [isInBoardloader]);
  // Step 2 Select the disk to be displayed only on the Mac App Store platform and not on other platforms
  const step2 = useMemo(() => showMasTip, [showMasTip]);
  const step3 = useMemo(
    () => isInBoardloader && !updateResult && !shouldRetry,
    [isInBoardloader, updateResult, shouldRetry],
  );
  const step4 = useMemo(() => updateResult, [updateResult]);

  const renderTitle = useMemo(() => {
    if (shouldRetry)
      return `${intl.formatMessage({
        id: 'modal__update_resources_failed',
      })}...`;
    if (step1)
      return intl.formatMessage({
        id: 'modal__update_resources_switch_to_boardloader',
      });
    if (step2)
      return intl.formatMessage({
        id: 'modal__update_resources_select_resources',
      });
    if (step3)
      return `${intl.formatMessage({
        id: 'modal__update_resources_updating_resources',
      })}...`;
    if (step4)
      return intl.formatMessage({
        id: 'modal__update_resources_restart_device',
      });
    return '';
  }, [intl, shouldRetry, step1, step2, step3, step4]);

  const renderSubTitle = useMemo(() => {
    if (shouldRetry) {
      if (platformEnv.isDesktopWin && isDiskPermissionDenied) {
        return intl.formatMessage({
          id: 'modal__update_resource_launch_app_as_administrator',
        });
      }
      return undefined;
    }
    if (step1)
      return intl.formatMessage({
        id: 'modal__update_resources_switch_to_boardloader_desc',
      });
    if (step2)
      return intl.formatMessage({
        id: 'modal__update_resources_select_resources_desc',
      });
    if (step3)
      return intl.formatMessage(
        {
          id: 'modal__update_resources_updating_resources_desc',
        },
        {
          pct: `${copyFileProgress}%`,
        },
      );
    if (step4)
      return intl.formatMessage({
        id: 'modal__update_resources_restart_device_desc',
      });
    return undefined;
  }, [
    intl,
    shouldRetry,
    step1,
    step2,
    step3,
    step4,
    isDiskPermissionDenied,
    copyFileProgress,
  ]);

  const renderEmoji = useMemo(() => {
    if (shouldRetry) return '😔';
    if (step1) return '🧩';
    return undefined;
  }, [step1, shouldRetry]);

  const currentStep = useMemo(() => {
    if (step1) return '1';
    if (step2) return '2';
    if (step3) return isMas ? '3' : '2';
    if (step4) return isMas ? '4' : '3';
  }, [step1, step2, step3, step4]);

  const showMacPermissionPanel = useMemo(
    () => isDiskPermissionDenied && platformEnv.isDesktopMac,
    [isDiskPermissionDenied],
  );

  return (
    <Modal
      size={showMacPermissionPanel ? '2xl' : undefined}
      closeOnOverlayClick={false}
      header={
        showMacPermissionPanel
          ? `☕️ ${intl.formatMessage({
              id: 'modal__enable_mac_permission_title',
            })}`
          : intl.formatMessage({ id: 'modal__update_resources' })
      }
      hideSecondaryAction
      primaryActionTranslationId={
        shouldRetry ? 'action__retry' : 'action__open_finder'
      }
      onPrimaryActionPress={() => {
        if (shouldRetry) {
          retry();
        } else if (showMasTip) {
          setConfirmChooseDisk(true);
          updateTouchResource();
        }
      }}
      footer={
        showMacPermissionPanel
          ? null
          : shouldRetry || showMasTip
          ? undefined
          : null
      }
      closeable={showMacPermissionPanel}
    >
      <Center>
        {/* Hide step component on failed state */}
        {shouldRetry ? null : (
          <Box flexDirection="row" mb="24px" alignItems="center">
            <Text typography="Body2Strong">
              {currentStep} of {isMas ? '4' : '3'}
            </Text>
            <Box flexDirection="row" ml="8px">
              <StepsItem inProgress={step1} finished={!step1} />
              {isMas && (
                <StepsItem inProgress={step2} finished={!step1 && !step2} />
              )}
              <StepsItem inProgress={!step2 && step3} finished={step4} />
              <StepsItem inProgress={step4} />
            </Box>
          </Box>
        )}
        {showMacPermissionPanel ? (
          <MacPermission />
        ) : (
          <Empty
            emoji={renderEmoji}
            icon={
              step2 ? (
                <Image
                  source={
                    themeVariant === 'light'
                      ? SelectFirmwareResources
                      : SelectFirmwareResourcesDark
                  }
                  w="352px"
                  h="191px"
                  mb="16px"
                />
              ) : step3 ? (
                <Box mb="16px" width="full" px={12}>
                  <Progress.Bar value={copyFileProgress} />
                </Box>
              ) : step4 ? (
                <Center
                  bgColor="surface-subdued"
                  borderRadius="12px"
                  mt="-16px"
                  mb="16px"
                >
                  <LottieView
                    source={RestartTouch}
                    autoPlay
                    loop
                    style={{ width: '276px' }}
                  />
                </Center>
              ) : undefined
            }
            title={renderTitle}
            subTitle={renderSubTitle}
            {...(showMasTip && { my: '-16px' })}
          />
        )}
      </Center>
    </Modal>
  );
};

export default UpdateWarningModal;
