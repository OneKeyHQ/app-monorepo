import type { FC } from 'react';
import { useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Center, Image, Modal, Typography } from '@onekeyhq/components';
import RecoveryPhrase from '@onekeyhq/kit/assets/3d_recovery_phrase.png';
import type { HardwareUpdateRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/HardwareUpdate';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<HardwareUpdateRoutesParams>;
type RouteProps = RouteProp<
  HardwareUpdateRoutesParams,
  HardwareUpdateModalRoutes.HardwareUpdateWarningModal
>;

const UpdateWarningModal: FC = () => {
  const navigation = useNavigation<NavigationProps['navigation']>();
  const intl = useIntl();
  const { device, resourceUpdateInfo, onSuccess, shouldUpdateBootlader } =
    useRoute<RouteProps>().params;

  useEffect(() => {
    debugLogger.hardwareSDK.info(
      'UpdateWarningModal, resourceUpdateInfo: ',
      resourceUpdateInfo,
    );
    debugLogger.hardwareSDK.info(
      'UpdateWarningModal, shouldUpdateBootloader: ',
      shouldUpdateBootlader,
    );
  }, [resourceUpdateInfo, shouldUpdateBootlader]);

  return (
    <Modal
      maxHeight={560}
      hideSecondaryAction
      primaryActionTranslationId="action__yes_i_have"
      onPrimaryActionPress={() => {
        navigation.popToTop();
        if (resourceUpdateInfo?.needUpdate) {
          navigation.replace(
            HardwareUpdateModalRoutes.HardwareUpdateResourceModal,
            {
              device,
              resourceUpdateInfo,
              onSuccess,
            },
          );
        } else if (shouldUpdateBootlader) {
          navigation.replace(
            HardwareUpdateModalRoutes.HardwareUpdatingBootloaderModal,
            {
              device,
              onSuccess,
            },
          );
        } else {
          navigation.replace(HardwareUpdateModalRoutes.HardwareUpdatingModal, {
            device,
            onSuccess,
          });
        }
      }}
    >
      <Center flex={1} paddingX={4}>
        <Box alignItems="center">
          <Image size={112} source={RecoveryPhrase} />

          <Typography.DisplayMedium mt={8}>
            {intl.formatMessage({ id: 'modal__do_you_have_your_phrase' })}
          </Typography.DisplayMedium>
          <Typography.Body1 color="text-subdued" mt={3} textAlign="center">
            {intl.formatMessage({
              id: 'modal__do_you_have_your_phrase_desc',
            })}
          </Typography.Body1>
        </Box>
      </Center>
    </Modal>
  );
};

export default UpdateWarningModal;
