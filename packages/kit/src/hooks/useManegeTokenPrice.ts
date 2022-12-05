import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useActiveWalletAccount, useAppSelector } from './redux';

export const useSimpleTokenPrice = ({
  networkId,
  contractAdress,
}: {
  networkId?: string;
  contractAdress?: string;
}) => {
  const priceMap = useAppSelector((s) => s.tokens.tokenPriceMap);
  const vsCurrency = useAppSelector((s) => s.settings.selectedFiatMoneySymbol);
  return useMemo(() => {
    if (!networkId) return 0;
    const price =
      priceMap[`${networkId}${contractAdress ? `-${contractAdress}` : ''}`];
    if (price && price[vsCurrency]) {
      return price[vsCurrency];
    }
    // backgroundApiProxy.ServicePrice.fetchSimpleTokenPrice({
    //   networkId,
    //   tokenIds: contractAdress ? [contractAdress] : undefined,
    //   fetchMain: false,
    //   vsCurrency,
    // });
  }, [contractAdress, networkId, priceMap, vsCurrency]);
};

export const useManageTokenprices = ({
  pollingInterval = 300,
}: {
  pollingInterval?: number;
} = {}) => {
  const isFocused = useIsFocused();
  const { accountId, networkId } = useActiveWalletAccount();
  const vsCurrency = useAppSelector((s) => s.settings.selectedFiatMoneySymbol);
  const prices = useAppSelector((s) => s.tokens.tokenPriceMap);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isFocused) {
      backgroundApiProxy.ServicePrice.fetchSimpleTokenPrice({
        networkId,
        accountId,
        fetchMain: true,
        vsCurrency,
      });
      timer = setInterval(() => {
        backgroundApiProxy.ServicePrice.fetchSimpleTokenPrice({
          networkId,
          accountId,
          fetchMain: true,
          vsCurrency,
        });
      }, pollingInterval * 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [networkId, accountId, isFocused, pollingInterval, vsCurrency]);
  return { prices };
};
