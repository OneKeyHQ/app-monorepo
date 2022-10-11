import { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, Empty, useToast } from '@onekeyhq/components';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { RootRoutes } from '@onekeyhq/kit/src/routes/types';

import {
  NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
  useCreateAccountInWallet,
} from '../NetworkAccountSelector/hooks/useCreateAccountInWallet';

const IdentityAssertion: FC = ({ children }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { walletId, accountId, networkId, isCompatibleNetwork, network } =
    useActiveWalletAccount();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createAccount, isCreateAccountSupported } = useCreateAccountInWallet({
    walletId,
    networkId,
  });
  const toast = useToast();

  if (!walletId) {
    return (
      <Box
        testID="IdentityAssertion-noWallet"
        flex="1"
        justifyContent="center"
        bg="background-default"
      >
        <Empty
          emoji="🤑"
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
              navigation.navigate(RootRoutes.Onboarding);
            }}
            size="lg"
          >
            {intl.formatMessage({ id: 'action__create_wallet' })}
          </Button>
        </Box>
      </Box>
    );
  }
  if (!accountId || !isCompatibleNetwork) {
    return (
      <Box
        testID="IdentityAssertion-noAccount"
        flex="1"
        justifyContent="center"
        bg="background-default"
      >
        <Empty
          emoji="💳"
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
            leftIconName={
              isCreateAccountSupported ? 'PlusOutline' : 'BanOutline'
            }
            type="primary"
            onPress={() => {
              // ** createAccount for current wallet directly
              // createAccount();
              //

              if (isCreateAccountSupported) {
                // ** createAccount for current wallet directly
                createAccount();
                //
                // ** Open Account Selector
                // openAccountSelector();
                //
                // ** open WalletSelector
                // openDrawer();
                // dispatch(updateDesktopWalletSelectorVisible(true));
              } else {
                toast.show({
                  title: intl.formatMessage(
                    {
                      id: NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
                    },
                    { 0: network?.shortName },
                  ),
                });
              }
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
