import React, { FC, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, Typography } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import { onekeyBleConnect } from '../../../utils/ble/BleOnekeyConnect';

type NavigationProps = ModalScreenProps<RootRoutesParams>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.DeviceStatusCheckModal
>;

const DeviceStatusCheckModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { device } = useRoute<RouteProps>().params;
  const { serviceAccount } = backgroundApiProxy;

  useEffect(() => {
    // If device and account are ready, go to success page
    async function main() {
      const features = await onekeyBleConnect.getFeatures(device.device as any);
      if (!features) return;
      await serviceAccount.createHWWallet({ features });

      if (features.initialized) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.SetupSuccessModal,
            params: { device },
          },
        });
      } else {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }

        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.SetupHardwareModal,
            params: {
              device,
            },
          },
        });
      }
    }

    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = (
    <Center h="152px">
      <Spinner size="lg" />
      <Typography.DisplayMedium mt={6}>
        {intl.formatMessage({ id: 'modal__device_status_check' })}
      </Typography.DisplayMedium>
    </Center>
  );

  return (
    <Modal
      footer={null}
      staticChildrenProps={{
        justifyContent: 'center',
        flex: '1',
        p: 6,
        px: { base: 4, md: 6 },
      }}
    >
      {content}
    </Modal>
  );
};

export default DeviceStatusCheckModal;
