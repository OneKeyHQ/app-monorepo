import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Image,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import RestoreWalletPng from '@onekeyhq/kit/assets/wallet/restore-wallet.png';
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

/* TODO: use i18n keys when available */
const RestoreHardwareWalletDescriptionModal: FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const content = (
    <Center>
      <VStack space={4}>
        <Box bgColor="surface-neutral-subdued" borderRadius="12px">
          <Image source={RestoreWalletPng} w="358px" h="160px" />
        </Box>
        <VStack space={2} mt={4}>
          <Typography.DisplayMedium>Select "Restore"</Typography.DisplayMedium>
          <Typography.Body2 color="text-subdued">
            Follow the on-screen prompts to start restore your private keys on a
            new device.
          </Typography.Body2>
        </VStack>

        <HStack space={4}>
          <Center borderRadius="full" bg="decorative-surface-one" size="32px">
            <Typography.Body2Strong color="decorative-icon-one">
              1
            </Typography.Body2Strong>
          </Center>
          <VStack flex="1" pt="4px">
            <Typography.Body1Strong>
              Enter your recovery seed
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued" mt="6px">
              Follow the prompts enter the recovery seed that you wrote down
              before and complete the check.
            </Typography.Body2>
          </VStack>
        </HStack>

        <HStack space={4}>
          <Center borderRadius="full" bg="decorative-surface-one" size="32px">
            <Typography.Body2Strong color="decorative-icon-one">
              2
            </Typography.Body2Strong>
          </Center>
          <VStack flex="1" pt="4px">
            <Typography.Body1Strong>Set a PIN Code</Typography.Body1Strong>
            <Typography.Body2 color="text-subdued" mt="6px">
              Set a PIN code yourself, which is similar to the withdrawal code
              of a bank card.
            </Typography.Body2>
          </VStack>
        </HStack>

        <HStack space={4}>
          <Center borderRadius="full" bg="decorative-surface-one" size="32px">
            <Typography.Body2Strong color="decorative-icon-one">
              3
            </Typography.Body2Strong>
          </Center>
          <VStack flex="1" pt="4px">
            <Typography.Body1Strong>Follow instructions</Typography.Body1Strong>
            <Typography.Body2 color="text-subdued" mt="6px">
              Come back here to follow instructions after the wallet is restored
              successfully.
            </Typography.Body2>
          </VStack>
        </HStack>
      </VStack>
    </Center>
  );

  return (
    <Modal
      header="Restore Wallet"
      height="640px"
      // TODO: Replace i18n keys when available
      primaryActionProps={{ children: 'OK, I’m done!' }}
      secondaryActionProps={{ children: 'Learn more' }}
      onPrimaryActionPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: { screen: CreateWalletModalRoutes.DeviceStatusCheckModal },
        });
      }}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default RestoreHardwareWalletDescriptionModal;
