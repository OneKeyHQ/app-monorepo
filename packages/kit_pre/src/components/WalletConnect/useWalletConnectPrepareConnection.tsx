import { useEffect } from 'react';

import { isExternalAccount } from '@onekeyhq/shared/src/engine/engineUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { useWalletConnectQrcodeModal } from './useWalletConnectQrcodeModal';

export function useWalletConnectPrepareConnection({
  accountId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const { serviceWalletConnect } = backgroundApiProxy;
  const { connectToWallet } = useWalletConnectQrcodeModal();

  useEffect(() => {
    (async function () {
      if (isExternalAccount({ accountId })) {
        const { session, walletService } =
          await serviceWalletConnect.getWalletConnectSessionOfAccount({
            accountId,
          });
        if (session?.connected) {
          await connectToWallet({
            isNewSession: false,
            session,
            walletService,
            accountId,
          });
        }
      }
    })();
  }, [accountId, connectToWallet, serviceWalletConnect]);
}
