import React, { FC, useCallback, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Center,
  Modal,
  Spinner,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
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
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

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

  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  useEffect(() => {
    const timeId = setTimeout(() => {
      safeGoBack();
      ToastManager.show({
        title: intl.formatMessage({ id: 'action__connection_timeout' }),
      });
    }, 60 * 1000);
    return () => {
      clearTimeout(timeId);
    };
  }, [safeGoBack, intl]);

  useEffect(() => {
    // If device and account are ready, go to success page
    async function main() {
      console.log('DeviceStatusCheckModal: ', device);
      let features: IOneKeyDeviceFeatures | null = null;
      try {
        // 10s timeout for device connection
        const result = await Promise.race([
          deviceUtils.getFeatures(device.connectId ?? ''),
          new Promise((_, reject) => setTimeout(reject, 30 * 1000)),
        ]);
        features = result as IOneKeyDeviceFeatures;
      } catch (e) {
        safeGoBack();
        ToastManager.show({
          title: intl.formatMessage({ id: 'action__connection_timeout' }),
        });
        return;
      }

      if (!features.initialized) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.SetupHardwareModal,
            params: {
              device,
            },
          },
        });
        return;
      }

      try {
        await serviceAccount.createHWWallet({
          features,
          connectId: device.connectId ?? '',
        });
      } catch (e: any) {
        safeGoBack();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ToastManager.show({ title: e?.message ?? '' });
        return;
      }

      safeGoBack();
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.SetupSuccessModal,
          params: { device },
        },
      });
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
