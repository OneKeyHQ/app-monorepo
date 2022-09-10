import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, Empty, useIsVerticalLayout } from '@onekeyhq/components';
import IconAccount from '@onekeyhq/kit/assets/3d_account.png';
import IconWallet from '@onekeyhq/kit/assets/3d_wallet.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { RootRoutes } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../hooks';
import reducerAccountSelector from '../../store/reducers/reducerAccountSelector';
import { useCreateAccountInWallet } from '../Header/AccountSelectorChildren/RightAccountCreateButton';

const { updateDesktopSelectorVisible } = reducerAccountSelector.actions;

const IdentityAssertion: FC = ({ children }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { walletId, accountId, networkId, isCompatibleNetwork } =
    useActiveWalletAccount();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createAccount } = useCreateAccountInWallet({
    walletId,
    networkId,
  });
  const { openDrawer } = useNavigationActions();
  const isVertical = useIsVerticalLayout();
  const { dispatch } = backgroundApiProxy;

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
              // ** createAccount for current wallet directly
              // createAccount();
              //
              // ** show account selector
              if (isVertical) {
                openDrawer();
              } else {
                dispatch(updateDesktopSelectorVisible(true));
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
