import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useActiveWalletAccount, useAppSelector } from './redux';

export const useSimpleTokenPriceInfo = ({
  networkId,
  contractAdress,
}: {
  networkId?: string;
  contractAdress?: string;
}) => {
  const priceMap = useAppSelector((s) => s.tokens.tokenPriceMap);
  return useMemo(() => {
    if (!networkId || !priceMap) return undefined;
    const priceInfo =
      priceMap[`${networkId}${contractAdress ? `-${contractAdress}` : ''}`];
    return priceInfo;
  }, [contractAdress, networkId, priceMap]);
};

export const useSimpleTokenPriceValue = ({
  networkId,
  contractAdress,
}: {
  networkId?: string;
  contractAdress?: string;
}) => {
  const priceInfo = useSimpleTokenPriceInfo({ networkId, contractAdress });
  const vsCurrency = useAppSelector((s) => s.settings.selectedFiatMoneySymbol);
  return useMemo(() => {
    if (!networkId) return 0;
    if (priceInfo && priceInfo[vsCurrency]) {
      return priceInfo[vsCurrency];
    }
    // backgroundApiProxy.servicePrice.fetchSimpleTokenPriceDebounced({
    //   networkId,
    //   tokenIds: contractAdress ? [contractAdress] : undefined,
    //   fetchMain: false,
    //   vsCurrency,
    // });
  }, [networkId, priceInfo, vsCurrency]);
};

export const useManageTokenprices = ({
  pollingInterval = 0,
  accountId,
  networkId,
}: {
  pollingInterval?: number;
  accountId: string;
  networkId: string;
}) => {
  const isFocused = useIsFocused();
  const vsCurrency = useAppSelector((s) => s.settings.selectedFiatMoneySymbol);
  const prices = useAppSelector((s) => s.tokens.tokenPriceMap);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollingInterval && isFocused) {
      backgroundApiProxy.servicePrice.fetchSimpleTokenPriceDebounced({
        networkId,
        accountId,
        fetchMain: true,
        vsCurrency,
      });
      timer = setInterval(() => {
        backgroundApiProxy.servicePrice.fetchSimpleTokenPriceDebounced({
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
