import React, { FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Button, Center, Icon, Modal, Typography } from '@onekeyhq/components';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import {
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<RootRoutesParams>;
type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.SetupSuccessModal
>;

/* TODO: use i18n keys when available */
const SetupSuccessModal: FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();

  const { deviceName = 'Unknown Device' } = route?.params ?? {};

  const content = (
    <Center>
      <Center bg="surface-success-default" borderRadius="full" size="56px">
        <Icon name="CheckOutline" color="icon-success" />
      </Center>
      <Typography.DisplayMedium mt={6}>
        Setup Complete!
      </Typography.DisplayMedium>
      <Typography.Body1 color="text-subdued" textAlign="center" mt={2}>
        Your device is set up and ready to use in OneKey!
      </Typography.Body1>

      <Button type="plain" size="base" mt={8}>
        View Device Details
      </Button>
    </Center>
  );

  const handleCloseSetup = () => {
    // Create wallet and account from device
    navigation.navigate(RootRoutes.Root);
  };

  return (
    <Modal
      header={deviceName}
      headerDescription="Activated"
      secondaryActionTranslationId="action__close"
      onSecondaryActionPress={handleCloseSetup}
      staticChildrenProps={{
        justifyContent: 'center',
        flex: '1',
        p: 6,
        px: { base: 4, md: 6 },
      }}
      hidePrimaryAction
    >
      {content}
    </Modal>
  );
};

export default SetupSuccessModal;
