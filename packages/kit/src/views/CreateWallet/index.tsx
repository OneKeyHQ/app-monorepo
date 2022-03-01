import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Center,
  HStack,
  Icon,
  Image,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import MiniDeviceIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
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
} from '../../routes/types';

type NavigationProps = ModalScreenProps<RootRoutesParams> &
  ModalScreenProps<CreateWalletRoutesParams>;

const CreateWalletModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const content = (
    <Center>
      <VStack space={8} w="full">
        <VStack space={2} alignItems="center">
          <Typography.DisplayLarge>
            {intl.formatMessage({ id: 'action__create_wallet' })}
          </Typography.DisplayLarge>
          <Typography.Body1 color="text-subdued">
            {intl.formatMessage({ id: 'content__select_wallet_type' })}
          </Typography.Body1>
        </VStack>
        <VStack space={4}>
          {/* APP Wallet option */}
          <PressableItem
            borderRadius="12px"
            px={4}
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.CreateWallet,
                params: { screen: CreateWalletModalRoutes.AppWalletModal },
              });
            }}
          >
            <HStack justifyContent="space-between" alignItems="center">
              <Center
                size={12}
                borderRadius="12px"
                bg="surface-neutral-default"
              >
                <Typography.DisplayLarge>🤑</Typography.DisplayLarge>
              </Center>
              <Icon name="ChevronRightOutline" size={24} />
            </HStack>
            <VStack space={1} mt={3}>
              <Typography.Body1Strong>
                {intl.formatMessage({
                  id: 'wallet__app_wallet',
                })}
              </Typography.Body1Strong>

              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({
                  id: 'content__app_wallet_desc',
                })}
              </Typography.Body2>
            </VStack>

            <Typography.Caption mt={4} color="text-disabled">
              {intl.formatMessage({
                id: 'content__for_people_who_dont_have_hardware_wallet',
              })}
            </Typography.Caption>
          </PressableItem>

          {/* Hardware Wallet option */}
          <PressableItem
            borderRadius="12px"
            px={4}
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.CreateWallet,
                params: {
                  screen: CreateWalletModalRoutes.ConnectHardwareModal,
                },
              });
            }}
          >
            <HStack justifyContent="space-between" alignItems="center">
              <Center
                size={12}
                borderRadius="12px"
                bg="surface-neutral-default"
              >
                <Image source={MiniDeviceIcon} width={5} height={30} />
              </Center>
              <Badge
                title={intl.formatMessage({ id: 'badge__coming_soon' })}
                size="sm"
                type="default"
              />
            </HStack>
            <VStack space={1} mt={3}>
              <Typography.Body1Strong>
                {intl.formatMessage({
                  id: 'wallet__hardware_wallet',
                })}
              </Typography.Body1Strong>

              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({
                  id: 'content__hardware_wallet_desc',
                })}
              </Typography.Body2>
            </VStack>

            <Typography.Caption mt={4} color="text-disabled">
              {intl.formatMessage({
                id: 'content__for_people_who_have_hardware_wallet',
              })}
            </Typography.Caption>
          </PressableItem>
        </VStack>
      </VStack>
    </Center>
  );

  const footer = (
    <Center pt={4} pb={8}>
      <Typography.Body1 color="text-subdued">
        {intl.formatMessage(
          { id: 'content__import_or_watch_an_account' },
          {
            import: (
              <Typography.Body1Strong
                onPress={() => {
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.CreateWallet,
                    params: {
                      screen: CreateWalletModalRoutes.CreateImportedAccount,
                    },
                  });
                }}
              >
                {intl.formatMessage({ id: 'action__import' })}
              </Typography.Body1Strong>
            ),
            watch: (
              <Typography.Body1Strong
                onPress={() =>
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.CreateWallet,
                    params: {
                      screen: CreateWalletModalRoutes.CreateWatchedAccount,
                    },
                  })
                }
              >
                {intl.formatMessage({ id: 'action__watch_lowercase' })}
              </Typography.Body1Strong>
            ),
          },
        )}
      </Typography.Body1>
    </Center>
  );

  return (
    <Modal
      footer={footer}
      scrollViewProps={{
        pt: 4,
        children: content,
      }}
    />
  );
};

export default CreateWalletModal;
