import type { FC } from 'react';
import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Button, Empty, ToastManager } from '@onekeyhq/components';
import type { IWallet } from '@onekeyhq/engine/src/types';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import { RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { isHwClassic } from '../../utils/hardware';
import {
  NETWORK_NOT_SUPPORT_CREATE_ACCOUNT_I18N_KEY,
  useCreateAccountInWallet,
} from '../NetworkAccountSelector/hooks/useCreateAccountInWallet';

const { serviceAccount } = backgroundApiProxy;

function AutoAddFirstHdOrHwAccount({
  wallet,
  networkId,
}: {
  wallet: IWallet;
  networkId: string;
}) {
  const walletId = wallet?.id;
  useEffect(() => {
    if (wallet && walletId && networkId) {
      serviceAccount.autoAddFirstHdOrHwAccount({
        wallet,
        networkId,
      });
    }
  }, [networkId, wallet, walletId]);
  return null;
}

const IdentityAssertion: FC<{ checkCompatibleNetwork?: boolean }> = ({
  children,
  checkCompatibleNetwork = true,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const {
    walletId,
    accountId,
    networkId,
    isCompatibleNetwork,
    network,
    wallet,
  } = useActiveWalletAccount();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createAccount, isCreateAccountSupported } = useCreateAccountInWallet({
    walletId,
    networkId,
  });

  const hasNoWallet = !walletId;
  const isAccountCompatibleNetwork =
    !!accountId && (checkCompatibleNetwork ? isCompatibleNetwork : true);
  const enableOnClassicOnly = network?.settings.enableOnClassicOnly;

  if (enableOnClassicOnly && !isHwClassic(wallet?.deviceType)) {
    return (
      <Box
        testID="IdentityAssertion-enableOnClassicOnly"
        flex="1"
        justifyContent="center"
        bg="background-default"
      >
        <Empty
          emoji="🔗"
          title={intl.formatMessage(
            {
              id: 'empty__chain_support_wallettype_only',
            },
            { 'walletType': '「Classic」' },
          )}
        />
      </Box>
    );
  }

  if (hasNoWallet) {
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
  if (!isAccountCompatibleNetwork) {
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
          {isCreateAccountSupported && wallet ? (
            <AutoAddFirstHdOrHwAccount wallet={wallet} networkId={networkId} />
          ) : null}
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
                ToastManager.show({
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
