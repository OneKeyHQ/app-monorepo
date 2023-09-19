import { useCallback } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useWalletConnectQrcodeModal } from '../../components/WalletConnect/useWalletConnectQrcodeModal';
import { WALLET_CONNECT_WALLET_NAMES } from '../../components/WalletConnect/walletConnectConsts';

import { getInjectedConnector } from './injectedConnectors';

import type { WalletService } from '../../components/WalletConnect/types';
import type { IConnectWalletListViewProps } from '../../components/WalletConnect/WalletConnectQrcodeModal';

export function useConnectExternalWallet(options: IConnectWalletListViewProps) {
  const { onConnectResult, uri, connectToWalletService } = options;
  const { connectToWallet } = useWalletConnectQrcodeModal();

  const connectExternalWallet = useCallback(
    async ({ walletService }: { walletService?: WalletService }) => {
      // connect web injected provider
      if (platformEnv.isWeb) {
        const walletName = walletService?.name;
        if (walletName && walletName === WALLET_CONNECT_WALLET_NAMES.MetaMask) {
          const { connector, store } = getInjectedConnector({
            name: walletName,
          });
          console.log('connect to metamask by react-web3');
          await connector.activate();
          const injectedProviderState = store.getState();
          const isActivateDone = !injectedProviderState.activating;
          if (injectedProviderState && isActivateDone) {
            onConnectResult?.({
              injectedProviderState,
              walletService,
            });
          }
          return;
        }
      }

      if (connectToWalletService && uri && walletService) {
        // open specified wallet app directly (native)
        await connectToWalletService(walletService, uri);
      } else {
        // show QrcodeModal (web) or WalletListModal (native)
        const result = await connectToWallet({
          isNewSession: true,
          walletService,
        });
        onConnectResult?.(result);
      }
    },
    [connectToWallet, connectToWalletService, onConnectResult, uri],
  );
  return {
    connectExternalWallet,
  };
}
