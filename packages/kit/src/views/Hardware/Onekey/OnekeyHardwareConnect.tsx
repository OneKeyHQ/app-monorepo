import type { FC } from 'react';
import { useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Modal, Spinner, Typography } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { OnekeyHardwareRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/HardwareOnekey';

import type { OnekeyHardwareModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareConnectModal
>;

/**
 * 硬件详情
 */
const OnekeyHardwareConnect: FC = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useRoute<RouteProps>();
  const { serviceHardware } = backgroundApiProxy;

  const { deviceId, connectId, onHandler } = route?.params || {};

  useEffect(() => {
    if (deviceId && connectId) {
      serviceHardware.getFeatures(connectId).finally(() => navigation.goBack());
    } else if (onHandler) {
      onHandler().finally(() => navigation.goBack());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal footer={null} modalHeight="426px">
      <Box
        flexDirection="column"
        alignItems="center"
        px={{ base: 4, md: 6 }}
        my={{ base: 12, md: 6 }}
      >
        <Spinner size="lg" />
        <Typography.DisplayMedium mt={6}>
          {intl.formatMessage({ id: 'modal__device_status_check' })}
        </Typography.DisplayMedium>
      </Box>
    </Modal>
  );
};

export default OnekeyHardwareConnect;
