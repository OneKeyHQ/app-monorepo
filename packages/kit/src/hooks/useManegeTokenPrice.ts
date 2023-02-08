import { useMemo } from 'react';

import { useAppSelector } from './redux';
import { useTokenPrice } from './useTokens';

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
  const vsCurrency = useAppSelector((s) => s.settings.selectedFiatMoneySymbol);
  const price = useTokenPrice({
    networkId: networkId ?? '',
    tokenIdOnNetwork: contractAdress ?? '',
    vsCurrency,
  });

  return price;
};
