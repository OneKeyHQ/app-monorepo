import { useCallback } from 'react';

import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { IConnectToWalletResult } from '../../components/WalletConnect/useWalletConnectQrcodeModal';
import { useActiveWalletAccount } from '../../hooks';

export function useAddExternalAccount() {
  const { serviceAccount, serviceExternalAccount } = backgroundApiProxy;
  const { externalWallet } = useActiveWalletAccount();
  const nextAccountId = externalWallet?.nextAccountIds?.global;
  const addExternalAccount = useCallback(
    async (result: IConnectToWalletResult) => {
      const { status, session, client, walletService, injectedProviderState } =
        result;

      debugLogger.walletConnect.info('Connect NewSession', {
        status,
        peerMeta: session?.peerMeta,
        walletServiceUrl: client?.walletService?.homepage,
      });

      const chainId = injectedProviderState?.chainId ?? status?.chainId ?? 1;
      let address =
        injectedProviderState?.accounts?.[0] || status?.accounts?.[0] || '';
      // EVM address should be lowerCase
      address = address.toLowerCase();

      const accountName = nextAccountId ? `External #${nextAccountId}` : '';

      const addedResult = await serviceAccount.addExternalAccount({
        impl: IMPL_EVM,
        chainId,
        address,
        name: accountName,
      });

      const accountId = addedResult.account.id;

      // save walletconnect accountInfo
      if (client) {
        client.watchAccountSessionChanged({ accountId });
        if (session) {
          await client.saveAccountSession({
            accountId,
            session,
          });
        }
      }

      // save injectedProvider accountInfo
      if (injectedProviderState && walletService) {
        await serviceExternalAccount.saveExternalAccountInfo({
          externalAccountType: 'injectedProvider',
          accountId,
          walletService,
        });
      }

      // closeDrawer();
      // resetToRoot();
      // closeExtensionWindowIfOnboardingFinished();

      return addedResult;
    },
    [nextAccountId, serviceAccount, serviceExternalAccount],
  );

  return { addExternalAccount };
}
