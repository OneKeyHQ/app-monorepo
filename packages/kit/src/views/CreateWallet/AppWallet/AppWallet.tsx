import React, { FC } from 'react';

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

type NavigationProps = ModalScreenProps<RootRoutesParams> &
  ModalScreenProps<CreateWalletRoutesParams>;

const AppWalletModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const content = (
    <Center>
      <VStack space={4} w="full">
        {/* Create new wallet */}
        <PressableItem
          p={4}
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.CreateWallet,
              params: {
                screen: CreateWalletModalRoutes.AppWalletDoneModal,
              },
            });
          }}
        >
          <HStack space={4} alignItems="center">
            <Icon name="PlusCircleOutline" />
            <Typography.Body1>
              {intl.formatMessage({
                id: 'action__create_new_wallet',
              })}
            </Typography.Body1>
          </HStack>
          <Icon name="ChevronRightOutline" />
        </PressableItem>
        {/* Restore wallet */}
        <PressableItem
          p={4}
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          onPress={() =>
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.CreateWallet,
              params: {
                screen: CreateWalletModalRoutes.RestoreWalletModal,
              },
            })
          }
        >
          <HStack space={4} alignItems="center">
            <Icon name="RestoreOutline" />
            <Typography.Body1>
              {intl.formatMessage({
                id: 'action__restore_wallet',
              })}
            </Typography.Body1>
          </HStack>
          <Icon name="ChevronRightOutline" />
        </PressableItem>
      </VStack>
    </Center>
  );

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'wallet__app_wallet' })}
      scrollViewProps={{
        pt: 4,
        children: content,
      }}
    />
  );
};

export default AppWalletModal;
