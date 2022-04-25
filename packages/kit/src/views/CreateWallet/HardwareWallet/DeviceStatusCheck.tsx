import React, { FC, useEffect } from 'react';

import OneKeyConnect from '@onekeyfe/js-sdk';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, Typography } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
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
import getDeviceConnectionInstance from '@onekeyhq/kit/src/utils/device/deviceConnection';
import deviceUtilInstance from '@onekeyhq/kit/src/utils/device/deviceUtils';

import type { Features } from '@onekeyfe/js-sdk';

type NavigationProps = ModalScreenProps<RootRoutesParams>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.DeviceStatusCheckModal
>;

const DeviceStatusCheckModal: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { device } = useRoute<RouteProps>().params;
  const { serviceAccount } = backgroundApiProxy;
  useEffect(() => {
    async function main() {
      await deviceUtilInstance?.connect(device.device.id);
      console.log('------start method');
      const response = await OneKeyConnect.getFeatures();
      const features = response?.payload as Features;
      console.log('------features', features);
      try {
        await serviceAccount.createHWWallet(features);
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        toast.show({
          title: intl.formatMessage({ id: errorKey }),
        });
        const inst = navigation.getParent() || navigation;
        inst.goBack();
        return;
      }

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
