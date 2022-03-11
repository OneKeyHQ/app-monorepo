import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  // Badge,
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
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

const ImportWalletModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const content = (
    <Center>
      <VStack space={4} w="full">
        {/* Import a Single-Chain Wallet */}
        {/* <PressableItem
          borderRadius="12px"
          px={4}
          onPress={() => {
            navigation.navigate(CreateWalletModalRoutes.CreateImportedAccount);
          }}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <Center size={12} borderRadius="12px" bg="surface-neutral-default">
              <Icon name="SaveOutline" />
            </Center>
            <Icon name="ChevronRightOutline" size={24} />
          </HStack>
          <VStack space={1} mt={3}>
            <Typography.Body1Strong>
              {intl.formatMessage({
                id: 'content__import_a_single_chain_wallet',
              })}
            </Typography.Body1Strong>

            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({
                id: 'content__import_a_single_chain_wallet_desc',
              })}
            </Typography.Body2>
          </VStack>
        </PressableItem> */}

        {/* Watch a Public Address */}
        <PressableItem
          borderRadius="12px"
          px={4}
          onPress={() => {
            navigation.navigate(CreateWalletModalRoutes.CreateWatchedAccount);
          }}
        >
          <HStack justifyContent="space-between" alignItems="center">
            <Center size={12} borderRadius="12px" bg="surface-neutral-default">
              <Icon name="EyeOutline" />
            </Center>
            <Icon name="ChevronRightOutline" size={24} />
          </HStack>
          <VStack space={1} mt={3}>
            <Typography.Body1Strong>
              {intl.formatMessage({
                id: 'content__watch_a_public_address',
              })}
            </Typography.Body1Strong>

            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({
                id: 'form__address_helperText',
              })}
            </Typography.Body2>
          </VStack>
        </PressableItem>
      </VStack>
    </Center>
  );

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'action__import' })}
      scrollViewProps={{
        pt: 4,
        children: content,
      }}
    />
  );
};

export default ImportWalletModal;
