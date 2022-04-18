import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Image,
  Modal,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import walletAsset from '../../../assets/3d_wallet.png';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

const Guide = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isSmallScreen = useIsVerticalLayout();
  return (
    <Modal footer={null}>
      <Box px={isSmallScreen ? 6 : 4} height={isSmallScreen ? 'full' : 'auto'}>
        <Center flex={isSmallScreen ? '1' : 'auto'}>
          <Image size={92} source={walletAsset} />
          <Text
            mt={{ base: 8, md: 4 }}
            typography={{
              sm: 'DisplayXLarge',
              md: 'DisplayMedium',
            }}
          >
            {intl.formatMessage({ id: 'modal__add_wallet' })}
          </Text>
          <Text
            mt={2}
            textAlign="center"
            color="text-subdued"
            typography={{ sm: 'Body1', md: 'Body2' }}
          >
            {intl.formatMessage({ id: 'modal__add_wallet_desc' })}
          </Text>
        </Center>
        <Box
          pt={8}
          pb={{ base: 8, md: 4 }}
          w={{ base: 'full', md: '240px' }}
          mx="auto"
        >
          <Button
            size={isSmallScreen ? 'xl' : 'base'}
            type="primary"
            onPress={() => {
              navigation.navigate(CreateWalletModalRoutes.CreateWalletModal);
            }}
          >
            {intl.formatMessage({ id: 'action__create_wallet' })}
          </Button>
          <Button
            size={isSmallScreen ? 'xl' : 'base'}
            mt={isSmallScreen ? '4' : '3'}
            onPress={() => {
              navigation.navigate(
                CreateWalletModalRoutes.AddExistingWalletModal,
                { mode: 'all' },
              );
            }}
          >
            {intl.formatMessage({ id: 'action__i_already_have_a_wallet' })}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default Guide;
