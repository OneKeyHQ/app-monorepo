import { useEffect, useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './redux';

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
    if (!networkId) return undefined;
    if (priceInfo) {
      return priceInfo[vsCurrency];
    }
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
        vsCurrency,
      });
      timer = setInterval(() => {
        backgroundApiProxy.servicePrice.fetchSimpleTokenPriceDebounced({
          networkId,
          accountId,
          vsCurrency,
        });
      }, pollingInterval);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [networkId, accountId, isFocused, pollingInterval, vsCurrency]);
  return { prices };
};
