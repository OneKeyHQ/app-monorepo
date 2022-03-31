import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
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
      <Box
        display="flex"
        px={isSmallScreen ? '4' : '12'}
        height={isSmallScreen ? 'full' : 'auto'}
      >
        <Box
          flex={isSmallScreen ? '1' : 'auto'}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
        >
          <Image size={92} source={walletAsset} />
          <Text
            mt={{ sm: '8', md: '4' }}
            typography={{ sm: 'DisplayMedium', md: 'DisplayXLarge' }}
          >
            {intl.formatMessage({ id: 'modal__add_wallet' })}
          </Text>
          <Text mt={2} typography={{ sm: 'Body2', md: 'Body1' }}>
            {intl.formatMessage({ id: 'modal__add_wallet_desc' })}
          </Text>
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          mt={isSmallScreen ? '0' : '12'}
          mb={isSmallScreen ? '12' : '0'}
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
