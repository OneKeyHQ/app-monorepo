import React, { FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Center,
  HStack,
  Icon,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.SetupHardwareModal
>;

/* TODO: use i18n keys when available */
const SetupHardwareModal: FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();

  const { deviceName = 'Unknown Device' } = route?.params ?? {};

  const content = (
    <Center>
      <VStack space={4}>
        {/* Setup new device option */}
        <PressableItem
          borderRadius="12px"
          px={4}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.CreateWallet,
              params: { screen: CreateWalletModalRoutes.SetupNewDeviceModal },
            });
          }}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <Center size={12} borderRadius="12px" bg="surface-neutral-default">
              <Icon name="PlusCircleOutline" />
            </Center>
            <Icon name="ChevronRightOutline" size={24} />
          </HStack>
          <VStack space={1} mt={3}>
            <Typography.Body1Strong>Setup New Device</Typography.Body1Strong>

            <Typography.Body2 color="text-subdued">
              Let’s start and set up your device!
            </Typography.Body2>
          </VStack>
        </PressableItem>

        {/* Restore Hardware Wallet option */}
        <PressableItem
          borderRadius="12px"
          px={4}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.CreateWallet,
              params: {
                screen: CreateWalletModalRoutes.RestoreHardwareWalletModal,
              },
            });
          }}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <Center size={12} borderRadius="12px" bg="surface-neutral-default">
              <Icon name="RestoreOutline" />
            </Center>
            <Icon name="ChevronRightOutline" size={24} />
          </HStack>
          <VStack space={1} mt={3}>
            <Typography.Body1Strong>Restore Wallet</Typography.Body1Strong>

            <Typography.Body2 color="text-subdued">
              Using an existing recovery seed to restore your private keys on a
              new device!
            </Typography.Body2>
          </VStack>
        </PressableItem>
      </VStack>
    </Center>
  );

  const footer = (
    <Center pt={4} pb={8}>
      <Button type="plain" size="lg" rightIconName="ChevronRightSolid">
        Device Details
      </Button>
    </Center>
  );

  return (
    <Modal
      header={deviceName}
      headerDescription="Not actived"
      footer={footer}
      scrollViewProps={{
        pt: 4,
        children: content,
      }}
    />
  );
};

export default SetupHardwareModal;
