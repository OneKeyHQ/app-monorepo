import { useCallback } from 'react';

import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { IConnectToWalletResult } from '../../components/WalletConnect/useWalletConnectQrcodeModal';

export function useAddExternalAccount() {
  const { serviceAccount, serviceExternalAccount } = backgroundApiProxy;
  const addExternalAccount = useCallback(
    async (result: IConnectToWalletResult) => {
      const {
        status,
        session,
        client,
        walletService,
        injectedProviderState,
        externalAccountInfo,
      } = result;

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

      const addedResult = await serviceAccount.addExternalAccount({
        impl: IMPL_EVM,
        chainId,
        address,
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

      let accountInfo = externalAccountInfo;
      if (!accountInfo && walletService) {
        accountInfo =
          await serviceExternalAccount.generateExternalAccountInfoFromWalletService(
            {
              externalAccountType: 'injectedProvider',
              walletService,
            },
          );
      }
      // save injectedProvider accountInfo
      if (injectedProviderState && accountInfo) {
        await serviceExternalAccount.saveExternalAccountInfo({
          accountId,
          accountInfo,
        });
      }

      await serviceAccount.changeActiveExternalWalletName(accountId);

      // closeDrawer();
      // resetToRoot();
      // closeExtensionWindowIfOnboardingFinished();

      return addedResult;
    },
    [serviceAccount, serviceExternalAccount],
  );

  return { addExternalAccount };
}
