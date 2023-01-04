import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Modal,
  Spinner,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
  DISK_ACCESS_ERROR: 'DISK_ACCESS_ERROR',
};

const UpdateWarningModal: FC = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const intl = useIntl();
  const { device, resourceUpdateInfo, onSuccess } =
    useRoute<RouteProps>().params;
  const { serviceHardware } = backgroundApiProxy;
  const [isInBoardloader, setIsInBoardloader] = useState(false);
  const [updateResult, setUpdateResult] = useState(false);

  const connectId = useMemo(() => device?.mac ?? '', [device]);

  const rebootToBoardloader = () => {
    serviceHardware.rebootToBoardloader(connectId).then((res) => {
      if (res.success) {
        setIsInBoardloader(true);
        return;
      }
      const error = deviceUtils.convertDeviceError(res.payload);
      deviceUtils.showErrorToast(error);
      navigation.goBack();
    });
  };

  useEffect(() => {
    if (!device) {
      return;
    }
    rebootToBoardloader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isInBoardloader) {
      window.desktopApi?.touchUpdateResource();
      window.desktopApi?.on?.(
        'touch/update-res-success',
        ({ error, result }: { error: Error; result: boolean }) => {
          console.log('update result =======> ', result);
          setUpdateResult(result);
          if (error) {
            // TODO: handle error
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
              default:
                break;
            }
            ToastManager.show(
              {
                title: message,
              },
              {
                type: 'error',
              },
            );
            navigation.goBack();
          }
        },
      );
    }
  }, [isInBoardloader, navigation]);

  return (
    <Modal
      maxHeight={560}
      hideSecondaryAction
      primaryActionTranslationId="action__continue"
      onPrimaryActionPress={() => {
        navigation.replace(HardwareUpdateModalRoutes.HardwareUpdatingModal, {
          device,
          onSuccess,
        });
      }}
      primaryActionProps={{
        isDisabled: !updateResult,
        isLoading: !updateResult,
      }}
    >
      <Center flex={1} paddingX={4}>
        <Box alignItems="center">
          <Box mt={6} alignItems="center">
            {!updateResult && <Spinner size="lg" />}
            {!isInBoardloader && (
              <Typography.DisplayMedium mt={6}>
                进入资源更新模式
              </Typography.DisplayMedium>
            )}
            {isInBoardloader && !updateResult && (
              <Typography.DisplayMedium mt={6}>
                正在更新资源
              </Typography.DisplayMedium>
            )}
            {updateResult && (
              <Typography.DisplayMedium mt={6}>
                请重启设备后点击继续 👇 按钮
              </Typography.DisplayMedium>
            )}
          </Box>
        </Box>
      </Center>
    </Modal>
  );
};

export default UpdateWarningModal;
