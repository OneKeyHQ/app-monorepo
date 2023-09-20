import type { FC } from 'react';

import { useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Center,
  HStack,
  Icon,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/CreateWallet';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.SetupHardwareModal
>;

const SetupHardwareModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();

  const { device } = route?.params || {};

  const content = (
    <VStack space={4} w="full">
      {/* Setup new device option */}
      <PressableItem
        borderRadius="12px"
        px={4}
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.CreateWallet,
            params: {
              screen: CreateWalletModalRoutes.SetupNewDeviceModal,
              params: {
                device,
                type: 'SetupNew',
              },
            },
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
          <Typography.Body1Strong>
            {intl.formatMessage({ id: 'modal__setup_new_device' })}
          </Typography.Body1Strong>

          <Typography.Body2 color="text-subdued">
            {intl.formatMessage({ id: 'modal__setup_new_device_desc' })}
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
              params: { device },
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
          <Typography.Body1Strong>
            {intl.formatMessage({ id: 'modal__restore_wallet' })}
          </Typography.Body1Strong>

          <Typography.Body2 color="text-subdued">
            {intl.formatMessage({ id: 'modal__restore_wallet_desc' })}
          </Typography.Body2>
        </VStack>
      </PressableItem>
    </VStack>
  );

  // const footer = (
  //   <Center pt={4} pb={8}>
  //     <Button type="plain" size="lg" rightIconName="ChevronRightMini">
  //       {intl.formatMessage({ id: 'action__view_device_details' })}
  //     </Button>
  //   </Center>
  // );

  return (
    <Modal
      header={device.name ?? ''}
      headerDescription={intl.formatMessage({ id: 'content__not_actived' })}
      footer={null}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default SetupHardwareModal;
