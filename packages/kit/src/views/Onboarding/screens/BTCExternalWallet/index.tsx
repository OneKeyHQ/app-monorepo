/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, ToastManager } from '@onekeyhq/components';
import LogoOneKey from '@onekeyhq/kit/assets/logo_black.png';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { ConnectWalletListItem } from '../../../../components/WalletConnect/WalletConnectQrcodeModal';
import { useOnboardingDone } from '../../../../hooks/useOnboardingRequired';
import { wait } from '../../../../utils/helper';
import Layout from '../../Layout';

const BTCExternalWallet = () => {
  const intl = useIntl();
  const onboardingDone = useOnboardingDone();

  const addBtcExternalAccount = useCallback(
    async (network: 'mainnet' | 'testnet') => {
      if (!window.$onekey?.$privateExternalAccount) {
        console.log('OneKey Provider Not Found.: ', window);
        ToastManager.show(
          {
            title: 'OneKey Provider Not Found.',
          },
          {
            type: 'error',
          },
        );
        return;
      }
      const result =
        await window.$onekey.$privateExternalAccount?.btc_requestAccount(
          network,
        );

      debugLogger.walletConnect.info(
        'OneKey injected account will create: ',
        result,
      );
      const addedResult =
        await backgroundApiProxy.serviceAccount.addBtcExternalAccount({
          externalAccount: result,
        });
      const accountId = addedResult.account.id;
      await backgroundApiProxy.serviceAccount.changeActiveExternalWalletName(
        accountId,
      );
      await onboardingDone();
      await wait(600);
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__account_imported' }),
      });
    },
    [intl, onboardingDone],
  );

  return (
    <Layout title={intl.formatMessage({ id: 'title__connect_with' })}>
      <Box flexDir="row" flexWrap="wrap" m="-4px" minH="10px">
        {/* BTC External Account */}
        <ConnectWalletListItem
          available
          label="OneKey Injected"
          logoSource={LogoOneKey}
          isLoading={false}
          onPress={() => addBtcExternalAccount('mainnet')}
        />
        <ConnectWalletListItem
          available
          label="OneKey Injected Testnet"
          logoSource={LogoOneKey}
          isLoading={false}
          onPress={() => addBtcExternalAccount('testnet')}
        />
      </Box>
    </Layout>
  );
};

BTCExternalWallet.displayName = 'BTCExternalWallet';

export default BTCExternalWallet;
