import type { FC } from 'react';
import { useEffect } from 'react';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { getActiveWalletAccount } from '../../../hooks/redux';
import { appSelector } from '../../../store';
import { SwapObserver } from '../Main/Observers/swap';
import { SwapMain } from '../Main/Swap';
import { tokenEqual } from '../utils';

type SwapTokenPluginsProps = {
  tokenId: string;
  networkId: string;
};

export const SwapPlugins: FC<SwapTokenPluginsProps> = ({
  tokenId,
  networkId,
}) => {
  useEffect(() => {
    async function main() {
      const token = await backgroundApiProxy.engine.ensureTokenInDB(
        networkId,
        tokenId,
      );
      const inputToken = appSelector((s) => s.swap.inputToken);
      if (!token || (inputToken && tokenEqual(inputToken, token))) {
        return;
      }
      await backgroundApiProxy.serviceSwap.buyToken(token);
      const timer = setTimeout(() => {
        const sendingAccount = appSelector((s) => s.swap.sendingAccount);
        const currentToken = appSelector((s) => s.swap.inputToken);
        const { account, wallet } = getActiveWalletAccount();
        if (wallet?.type === 'watching') {
          backgroundApiProxy.serviceSwap.setSendingAccountSimple(null);
        } else if (
          account &&
          account.id !== sendingAccount?.id &&
          currentToken &&
          isAccountCompatibleWithNetwork(account.id, currentToken.networkId)
        ) {
          backgroundApiProxy.serviceSwap.setSendingAccountSimple(account);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
    main();
  }, [tokenId, networkId]);

  if (!tokenId) {
    return null;
  }
  return (
    <>
      <SwapMain />
      <SwapObserver />
    </>
  );
};
