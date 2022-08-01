import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, Empty } from '@onekeyhq/components';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import IconWallet from '@onekeyhq/kit/assets/3d_wallet.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateWalletModalRoutes,
} from '@onekeyhq/kit/src/routes';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

const IdentityAssertion: FC = ({ children }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { walletId, accountId, wallet } = useActiveWalletAccount();

  if (!walletId) {
    return (
      <Box flex="1" justifyContent="center" bg="background-default">
        <Empty
          imageUrl={IconWallet}
          title={intl.formatMessage({ id: 'empty__no_wallet_title' })}
          subTitle={intl.formatMessage({ id: 'empty__no_wallet_desc' })}
        />
        <Box
          position="relative"
          w={{ md: 'full' }}
          alignItems="center"
          h="56px"
          justifyContent="center"
        >
          <Button
            leftIconName="PlusOutline"
            type="primary"
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.CreateWallet,
                params: {
                  screen: CreateWalletModalRoutes.GuideModal,
                },
              });
            }}
            size="lg"
          >
            {intl.formatMessage({ id: 'action__create_wallet' })}
          </Button>
        </Box>
      </Box>
    );
  }
  if (!accountId) {
    return (
      <Box flex="1" justifyContent="center" bg="background-default">
        <Empty
          imageUrl={IconAccount}
          title={intl.formatMessage({ id: 'empty__no_account_title' })}
          subTitle={intl.formatMessage({ id: 'empty__no_account_desc' })}
        />
        <Box
          position="relative"
          w={{ md: 'full' }}
          alignItems="center"
          h="56px"
          justifyContent="center"
        >
          <Button
            leftIconName="PlusOutline"
            type="primary"
            onPress={() => {
              if (wallet?.type === 'imported') {
                return navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateWallet,
                  params: {
                    screen: CreateWalletModalRoutes.AddExistingWalletModal,
                    params: { mode: 'imported' },
                  },
                });
              }
              if (wallet?.type === 'watching') {
                return navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateWallet,
                  params: {
                    screen: CreateWalletModalRoutes.AddExistingWalletModal,
                    params: { mode: 'watching' },
                  },
                });
              }

              return navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.CreateAccount,
                params: {
                  screen: CreateAccountModalRoutes.CreateAccountForm,
                  params: {
                    walletId,
                  },
                },
              });
            }}
            size="lg"
          >
            {intl.formatMessage({ id: 'action__create_account' })}
          </Button>
        </Box>
      </Box>
    );
  }
  return <>{children}</>;
};

export default IdentityAssertion;
