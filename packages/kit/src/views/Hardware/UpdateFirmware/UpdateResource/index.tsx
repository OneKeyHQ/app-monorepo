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
  Spinner,
  Text,
  ToastManager,
  useTheme,
} from '@onekeyhq/components';
import RestartTouch from '@onekeyhq/kit/assets/animations/restart-touch.json';
import SelectFirmwareResources from '@onekeyhq/kit/assets/select_firmware_resources.png';
import SelectFirmwareResourcesDark from '@onekeyhq/kit/assets/select_firmware_resources_dark.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import type { HardwareUpdateRoutesParams } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';

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
};

const MOCK_MAS = true;

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
  const [resError, setResError] = useState('');
  // confirm choose disk path for Mac app store version
  const [confirmChooseDisk, setConfirmChooseDisk] = useState(false);

  const connectId = useMemo(() => device?.mac ?? '', [device]);
  const { deviceUpdates } = useSettings();
  const { firmware } = deviceUpdates?.[connectId] || {};

  const masDialogTitle = intl.formatMessage({
    id: 'title__select_disk_and_continue',
  });
  const masDialogButtonLabel = intl.formatMessage({ id: 'action__continue' });

  const rebootToBoardloader = useCallback(() => {
    serviceHardware.rebootToBoardloader(connectId).then((res) => {
      if (res.success) {
        setIsInBoardloader(true);
        return;
      }
      const error = deviceUtils.convertDeviceError(res.payload);
      deviceUtils.showErrorToast(error);
      navigation.goBack();
    });
  }, [connectId, navigation, serviceHardware]);

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

  const retryState = useMemo(
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
    if ((response.payload ?? []).find((d) => d.connectId === connectId)) {
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
        if ((response.payload ?? []).find((d) => d.connectId === connectId)) {
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
    );

    return () => {
      deviceUtils.stopScan();
    };
  }, [updateResult, connectId, device, navigation, onSuccess]);

  useEffect(() => {
    if (isInBoardloader) {
      if (!MOCK_MAS) {
        updateTouchResource();
      }
      window.desktopApi?.on?.(
        'touch/update-res-success',
        ({ error, result }: { error: Error; result: boolean }) => {
          console.log('update result =======> ', result);
          setUpdateResult(result);
          if (error) {
            console.log('update error =======> ', error);
            let message = '';
            switch (error.message) {
              // 没有搜索到 Mass Storage 模式的设备，可能用户操作了设备，导致设备状态不对，比如断开连接、重启等
              case ERRORS.NOT_FOUND_DEVICE:
                message = 'Device not found';
                break;
              // 无法访问磁盘 - 此时可能用户电脑有磁盘权限问题
              case ERRORS.DISK_ACCESS_ERROR:
                message = 'DISK ACCESS ERROR';
                break;
              // 没有找到 OneKey Touch 磁盘的对应路径，可能是用户自行更改了磁盘名称，导致匹配失败
              case ERRORS.NOT_FOUND_DISK_PATH:
                message = 'NOT FOUND DISK PATH';
                break;
              // Mas 版本在选文件弹窗时没有给予正确的路径权限，导致无法访问磁盘
              case ERRORS.MAS_DISK_PATH_PERMISSION_DENIED:
                message = 'MAS DISK PATH PERMISSION DENIED';
                break;
              default:
                message = error.message;
                break;
            }
            setResError(message);
            ToastManager.show(
              {
                title: message,
              },
              {
                type: 'error',
              },
            );
            // navigation.goBack();
          }
        },
      );
    }
  }, [isInBoardloader, updateTouchResource, navigation, firmware]);

  const showFooter = useMemo(() => retryState, [retryState]);
  const showMasTip = useMemo(
    // TODO: platformEnv.isMas replace
    () => isInBoardloader && MOCK_MAS && !confirmChooseDisk,
    [isInBoardloader, confirmChooseDisk],
  );

  const renderTitle = useMemo(() => {
    if (!isInBoardloader) return 'Switch to Boardloader';
    if (showMasTip) return 'Select Resources';
    if (isInBoardloader && !updateResult && !retryState)
      return 'Updating Resources...';
    if (updateResult) return 'Restart Device to Install Firmware';
    if (retryState) return 'Update failed, please retry...';
    return '';
  }, [isInBoardloader, retryState, updateResult, showMasTip]);

  const renderSubTitle = useMemo(() => {
    if (!isInBoardloader)
      return 'In order to update firmware resources on your device, you will need to switch it to Boardloader mode';
    if (showMasTip)
      return 'Click "Open Finder," then select the disk "ONEKEY DATA" and continue';
    if (isInBoardloader && !updateResult && !retryState)
      return 'This process may take a while, please wait...';
    if (updateResult)
      return 'Resources have been updated. Please restart your device to install the firmware';
    return undefined;
  }, [isInBoardloader, retryState, showMasTip, updateResult]);

  const renderEmoji = useMemo(() => {
    if (!isInBoardloader) return '🧩';
    if (retryState) return '😔';
    return undefined;
  }, [isInBoardloader, retryState]);

  const currentStep = useMemo(() => {
    if (!isInBoardloader) return '1';
    if (showMasTip) return '2';
    if (isInBoardloader && !updateResult && !retryState) return '3';
    if (updateResult) return '4';
  }, [isInBoardloader, retryState, showMasTip, updateResult]);

  return (
    <Modal
      closeOnOverlayClick={false}
      header="Update Resource"
      hideSecondaryAction
      primaryActionTranslationId={
        retryState ? 'action__retry' : 'action__open_finder'
      }
      onPrimaryActionPress={() => {
        if (retryState) {
          retry();
        } else if (showMasTip) {
          setConfirmChooseDisk(true);
          updateTouchResource();
        }
      }}
      footer={showFooter || showMasTip ? undefined : null}
      closeable={false}
    >
      <Center>
        <Box flexDirection="row" mb="24px" alignItems="center">
          <Text typography="Body2Strong">{currentStep} of 4</Text>
          <Box flexDirection="row" ml="8px">
            <StepsItem
              inProgress={!isInBoardloader}
              finished={isInBoardloader}
            />
            <StepsItem
              inProgress={showMasTip}
              finished={isInBoardloader && !updateResult}
            />
            <StepsItem
              inProgress={isInBoardloader && !updateResult && !showMasTip}
              finished={updateResult}
            />
            <StepsItem inProgress={updateResult} />
          </Box>
        </Box>
        <Empty
          emoji={renderEmoji}
          icon={
            isInBoardloader && !updateResult && !showMasTip && !retryState ? (
              <Box mb="16px">
                <Spinner size="lg" />
              </Box>
            ) : showMasTip ? (
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
            ) : updateResult ? (
              <LottieView
                source={RestartTouch}
                autoPlay
                loop
                style={{ width: '276px', marginBottom: 24 }}
              />
            ) : undefined
          }
          title={renderTitle}
          subTitle={renderSubTitle}
          {...(showMasTip && { my: '-16px' })}
        />
      </Center>
    </Modal>
  );
};

export default UpdateWarningModal;
