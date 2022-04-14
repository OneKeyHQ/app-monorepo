import React, { FC, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, Typography } from '@onekeyhq/components';
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

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../../hooks/redux';
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
  const { network } = useActiveWalletAccount();
  const { engine } = backgroundApiProxy;

  useEffect(() => {
    // Check device status

    // If device and account are ready, go to success page
    async function main() {
      const features = await onekeyBleConnect.getFeatures(device.device);

      if (!features) return; // error
      if (!network) return; // error

      await engine.upsertDevice(features, device.device.id);

      if (features.initialized) {
        let wallet = null;
        let account = null;
        try {
          wallet = await engine.createHWWallet();
          const accounts = await engine.addHDAccounts(
            'Undefined',
            wallet.id,
            network.id,
          );
          if (accounts.length > 0) {
            const $account = accounts[0];
            account = $account;
            console.log(account);
          }
        } catch (e) {
          console.log(e);
        }

        // serviceAccount.changeActiveAccount({
        //   account,
        //   wallet,
        // });

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
