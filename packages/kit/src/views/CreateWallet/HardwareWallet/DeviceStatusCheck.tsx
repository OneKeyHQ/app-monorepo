import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Center, Modal, Spinner, Typography } from '@onekeyhq/components';
import { CreateWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<RootRoutesParams>;

const DeviceStatusCheckModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  useEffect(() => {
    // Check device status

    // If device and account are ready, go to success page
    setTimeout(() => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.SetupSuccessModal,
        },
      });
    }, 2000);
  }, [navigation]);

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
