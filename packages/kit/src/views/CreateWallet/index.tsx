import React, { FC, useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Button,
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

import { ModalScreenProps, RootRoutesParams } from '../../routes/types';

type NavigationProps = ModalScreenProps<RootRoutesParams> &
  ModalScreenProps<CreateWalletRoutesParams>;

const CreateWalletModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const onRestore = useCallback(() => {
    navigation.navigate(CreateWalletModalRoutes.ImportWalletModal);
  }, [navigation]);

  const content = (
    <VStack space={8} w="full">
      <Box>
        <Typography.DisplayLarge textAlign="center">
          {intl.formatMessage({ id: 'action__create_wallet' })}
        </Typography.DisplayLarge>
        <Typography.Body1 mt={2} textAlign="center" color="text-subdued">
          {intl.formatMessage({ id: 'content__select_wallet_type' })}
        </Typography.Body1>
      </Box>
      <VStack space={4}>
        {/* APP Wallet option */}
        <PressableItem
          borderRadius="12px"
          px={4}
          onPress={() => {
            navigation.navigate(CreateWalletModalRoutes.AppWalletModal);
          }}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <Center size={12} borderRadius="12px" bg="surface-neutral-default">
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
            navigation.navigate(CreateWalletModalRoutes.ConnectHardwareModal);
          }}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <Center size={12} borderRadius="12px" bg="surface-neutral-default">
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
  );

  const footer = (
    <Center pt={2} pb={6}>
      <Button type="plain" size="xl" onPress={onRestore}>
        {intl.formatMessage({ id: 'action__i_already_have_a_wallet' })}
      </Button>
    </Center>
  );

  return (
    <Modal
      footer={footer}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default CreateWalletModal;
