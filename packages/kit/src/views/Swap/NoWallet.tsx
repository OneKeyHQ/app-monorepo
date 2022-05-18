import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Center } from '@onekeyhq/components';

import { useNavigation } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
} from '../../routes';
import { ModalRoutes, RootRoutes } from '../../routes/types';

const NoWallet = () => {
  const navigation = useNavigation();
  const { wallet, account } = useActiveWalletAccount();
  const intl = useIntl();
  const onNoWallet = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateWallet,
      params: {
        screen: CreateWalletModalRoutes.GuideModal,
      },
    });
  }, [navigation]);
  const onNoAccount = useCallback(() => {
    if (!wallet) {
      return;
    }
    if (wallet.type === 'imported') {
      return navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.AddExistingWalletModal,
          params: { mode: 'privatekey' },
        },
      });
    }
    if (wallet.type === 'watching') {
      return navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.AddExistingWalletModal,
          params: { mode: 'address' },
        },
      });
    }

    return navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateAccount,
      params: {
        screen: CreateAccountModalRoutes.CreateAccountForm,
        params: {
          walletId: wallet.id,
        },
      },
    });
  }, [navigation, wallet]);
  if (!wallet) {
    return (
      <Center px="4">
        <Box mb="3" maxW="420" w="full">
          <Alert
            alertType="warn"
            actionType="bottom"
            title={intl.formatMessage({ id: 'empty__no_wallet_desc' })}
            action={intl.formatMessage({ id: 'action__add_wallet' })}
            dismiss={false}
            onAction={onNoWallet}
          />
        </Box>
      </Center>
    );
  }
  if (!account) {
    return (
      <Center px="4">
        <Box mb="3" maxW="420" w="full">
          <Alert
            alertType="warn"
            actionType="bottom"
            title={intl.formatMessage({ id: 'empty__no_account_desc' })}
            action={intl.formatMessage({ id: 'action__create_account' })}
            dismiss={false}
            onAction={onNoAccount}
          />
        </Box>
      </Center>
    );
  }
  return <></>;
};

export default NoWallet;
