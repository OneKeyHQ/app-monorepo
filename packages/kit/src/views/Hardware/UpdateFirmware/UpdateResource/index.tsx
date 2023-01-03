import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { consoleErrorInDev } from '@onekeyfe/cross-inpage-provider-core';
import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Center, Modal, Spinner, Typography } from '@onekeyhq/components';
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
      // TODO: use desktop api to copy res
      window.desktopApi?.touchUpdateResource();
      window.desktopApi?.on?.(
        'touch/update-res-success',
        ({ error, result }: { error: Error; result: boolean }) => {
          console.log('update result =======> ', result);
          setUpdateResult(result);
          if (error) {
            // TODO: handle error
            console.log('update error =======> ', error);
          }
        },
      );
    }
  }, [isInBoardloader]);

  return (
    <Modal
      maxHeight={560}
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      onPrimaryActionPress={() => {
        navigation.popToTop();
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
            <Spinner size="lg" />
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
                请重启设备
              </Typography.DisplayMedium>
            )}
          </Box>
        </Box>
      </Center>
    </Modal>
  );
};

export default UpdateWarningModal;
