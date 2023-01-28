import { useMemo } from 'react';

import { useAccount } from '.';

import B from 'bignumber.js';

import { useAppSelector } from './useAppSelector';
import { useAccountTokenValues, useNFTPrice } from './useTokens';

export type OverviewAssetType = 'defis' | 'tokens' | 'nfts';

export const useAccountValues = (props: {
  networkId: string;
  accountId: string;
}) => {
  const { networkId, accountId } = props;
  const { includeNFTsInTotal } = useAppSelector((s) => s.settings);
  const { account } = useAccount({
    networkId,
    accountId,
  });
  const defiValues = useAppSelector(
    (s) =>
      s.overview.totalDefiValues?.[`${networkId}--${account?.address ?? ''}`],
  ) ?? {
    value: new B(0),
    value24h: new B('0'),
  };

  const tokenValues = useAccountTokenValues(networkId, accountId);

  const nftValue = useNFTPrice({
    accountId: account?.address,
    networkId,
  });

  const nftValues = useMemo(() => {
    if (includeNFTsInTotal) {
      return {
        value: nftValue,
        value24h: 0,
      };
    }
    return {
      value: 0,
      value24h: 0,
    };
  }, [nftValue, includeNFTsInTotal]);

  let value = new B(0);
  let value24h = new B(0);

  for (const next of [defiValues, tokenValues, nftValues]) {
    value = value.plus(next.value);
    value24h = value24h.plus(next.value24h);
  }

  return {
    value,
    value24h,
  };
};
