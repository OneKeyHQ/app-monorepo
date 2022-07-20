import React, { FC, useCallback, useEffect, useRef } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Center,
  DialogManager,
  Modal,
  Spinner,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NeedBridgeDialog from '@onekeyhq/kit/src/components/NeedBridgeDialog';
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
import { CustomOneKeyHardwareError } from '@onekeyhq/kit/src/utils/hardware/errors';
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
  const { serviceAccount, serviceHardware } = backgroundApiProxy;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  useEffect(() => {
    const id = setTimeout(() => {
      safeGoBack();
      ToastManager.show({
        title: intl.formatMessage({ id: 'action__connection_timeout' }),
      });
    }, 60 * 1000);
    timeoutRef.current = id;
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [safeGoBack, intl]);

  useEffect(() => {
    // If device and account are ready, go to success page
    async function main() {
      let features: IOneKeyDeviceFeatures | null = null;
      try {
        // 30s timeout for device connection
        const result = await Promise.race([
          serviceHardware.getFeatures(device.connectId ?? ''),
          new Promise((_, reject) => setTimeout(reject, 30 * 1000)),
        ]);
        features = result as IOneKeyDeviceFeatures;
      } catch (e: any) {
        safeGoBack();
        const { className, key, code } = e || {};
        if (code === CustomOneKeyHardwareError.NeedOneKeyBridge) {
          DialogManager.show({ render: <NeedBridgeDialog /> });
          return;
        }

        if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
          ToastManager.show(
            {
              title: intl.formatMessage({ id: key }),
            },
            {
              type: 'error',
            },
          );
        } else {
          ToastManager.show(
            {
              title: intl.formatMessage({ id: 'action__connection_timeout' }),
            },
            {
              type: 'error',
            },
          );
        }
        return;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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
        const { className, key, message } = e || {};

        if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
          ToastManager.show(
            {
              title: intl.formatMessage({ id: key }),
            },
            {
              type: 'error',
            },
          );
        } else {
          ToastManager.show(
            {
              title: message,
            },
            {
              type: 'default',
            },
          );
        }
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
