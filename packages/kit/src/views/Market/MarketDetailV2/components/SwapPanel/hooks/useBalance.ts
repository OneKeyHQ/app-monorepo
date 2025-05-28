import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import type { IToken } from '../types';

interface IUseBalanceProps {
  token?: IToken;
}

export function useBalance({ token }: IUseBalanceProps) {
  const [balance, setBalance] = useState<BigNumber | undefined>(
    new BigNumber(0),
  );
  const { activeAccount } = useActiveAccount({ num: 0 });

  useEffect(() => {
    const fetchBalance = async () => {
      if (!token || !activeAccount.account?.id) {
        setBalance(new BigNumber(0));
        return;
      }

      try {
        const tokenDetails =
          await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
            networkId: token.networkId,
            contractAddress: token.contractAddress,
            accountId: activeAccount.account.id,
            accountAddress: activeAccount.account.address,
          });

        if (tokenDetails && tokenDetails.length > 0) {
          setBalance(new BigNumber(tokenDetails[0].balanceParsed ?? 0));
        } else {
          setBalance(new BigNumber(0));
        }
      } catch (error) {
        console.error('Failed to fetch token balance:', error);
        setBalance(new BigNumber(0));
      }
    };

    void fetchBalance();
  }, [token, activeAccount.account?.id, activeAccount.account?.address]);

  return { balance, setBalance, balanceToken: token };
}
