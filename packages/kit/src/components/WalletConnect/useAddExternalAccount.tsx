import { useCallback } from 'react';

import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks';

import { IConnectToWalletResult } from './useWalletConnectQrcodeModal';

export function useAddExternalAccount() {
  const { serviceAccount } = backgroundApiProxy;
  const { externalWallet } = useActiveWalletAccount();
  const add = useCallback(
    async (result: IConnectToWalletResult) => {
      const { status, session, client } = result;

      debugLogger.walletConnect.info('Connect NewSession', {
        status,
        peerMeta: session?.peerMeta,
        walletServiceUrl: client.walletService?.homepage,
      });

      const { chainId } = status;
      let address = status.accounts?.[0] || '';
      // EVM address should be lowerCase
      address = address.toLowerCase();

      const id = externalWallet?.nextAccountIds?.global;
      const accountName = id ? `External #${id}` : '';

      const addedAccount = await serviceAccount.addExternalAccount({
        impl: IMPL_EVM,
        chainId,
        address,
        name: accountName,
      });

      const accountId = addedAccount.id;
      client.watchAccountSessionChanged({ accountId });
      if (session) {
        await client.saveAccountSession({
          accountId,
          session,
        });
      }

      // closeDrawer();
      // resetToRoot();
      // closeExtensionWindowIfOnboardingFinished();

      return addedAccount;
    },
    [externalWallet?.nextAccountIds?.global, serviceAccount],
  );

  return add;
}
