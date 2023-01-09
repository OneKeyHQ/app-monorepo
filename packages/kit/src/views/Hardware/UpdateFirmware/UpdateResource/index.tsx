/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  Modal,
  Spinner,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
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

const UpdateWarningModal: FC = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const intl = useIntl();
  const { device, onSuccess } = useRoute<RouteProps>().params;
  const { serviceHardware } = backgroundApiProxy;

  const [isInBoardloader, setIsInBoardloader] = useState(false);
  const [updateResult, setUpdateResult] = useState(false);
  const [resError, setResError] = useState('');

  const connectId = useMemo(() => device?.mac ?? '', [device]);
  const { deviceUpdates } = useSettings();
  const { firmware } = deviceUpdates?.[connectId] || {};

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

  const retryState = useMemo(
    () => !!(!updateResult && resError),
    [updateResult, resError],
  );

  const retry = useCallback(async () => {
    setResError('');
    const response = await serviceHardware.searchDevices();
    if (!response.success) {
      // Failed to search for device, retry copy resource
      window.desktopApi?.touchUpdateResource({
        resourceUrl: firmware?.fullResource ?? '',
      });
      return;
    }
    if ((response.payload ?? []).find((d) => d.connectId === connectId)) {
      setIsInBoardloader(false);
      rebootToBoardloader();
      return;
    }
    window.desktopApi?.touchUpdateResource({
      resourceUrl: firmware?.fullResource ?? '',
    });
  }, [connectId, firmware, rebootToBoardloader, serviceHardware]);

  useEffect(() => {
    if (isInBoardloader) {
      window.desktopApi?.touchUpdateResource({
        resourceUrl: firmware?.fullResource ?? '',
      });
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
                message = 'NOT FOUND DEVICE';
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
  }, [isInBoardloader, navigation, firmware]);

  const isDisabledAndLoading = useMemo(() => {
    if (retryState) {
      return false;
    }
    return !updateResult;
  }, [retryState, updateResult]);

  const renderTitle = useMemo(() => {
    if (!isInBoardloader) return 'Switch to Boardloader';
    if (!isInBoardloader && !updateResult) return 'Updating Resources...';
    if (updateResult) return '请重启设备后点击继续 👇 按钮';
    if (retryState) return '更新失败，请重试';
    return '';
  }, [isInBoardloader, retryState, updateResult]);

  const renderSubTitle = useMemo(() => {
    if (!isInBoardloader)
      return 'In order to install the latest firmware on your device, you will need to switch it to Boardloader mode.';
    if (!isInBoardloader && !updateResult)
      return 'This process may take a while, please wait...';
    return undefined;
  }, [isInBoardloader, updateResult]);

  const renderEmoji = useMemo(() => {
    if (!isInBoardloader) return '🔁';
    if (updateResult) return '🔘';
    if (retryState) return '😔';
    return undefined;
  }, [isInBoardloader, retryState, updateResult]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__firmware_update' })}
      hideSecondaryAction
      primaryActionTranslationId={
        retryState ? 'action__retry' : 'action__continue'
      }
      onPrimaryActionPress={() => {
        if (retryState) {
          retry();
        } else {
          navigation.replace(HardwareUpdateModalRoutes.HardwareUpdatingModal, {
            device,
            onSuccess,
          });
        }
      }}
      footer={isDisabledAndLoading && null}
    >
      <Center>
        <Empty
          emoji={renderEmoji}
          icon={
            !updateResult && !retryState && isInBoardloader ? (
              <Box mb="16px">
                <Spinner size="lg" />
              </Box>
            ) : undefined
          }
          title={renderTitle}
          subTitle={renderSubTitle}
        />
      </Center>
    </Modal>
  );
};

export default UpdateWarningModal;
