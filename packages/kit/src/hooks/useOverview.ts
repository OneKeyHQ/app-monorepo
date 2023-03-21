import { useMemo } from 'react';

import B from 'bignumber.js';

import { useAccount } from './useAccount';
import { useAppSelector } from './useAppSelector';
import { useNFTPrice } from './useManegeTokenPrice';
import { useAccountTokenValues, useCurrentFiatValue } from './useTokens';

export type OverviewAssetType = 'defis' | 'tokens' | 'nfts';

export const useAccountValues = (props: {
  networkId: string;
  accountId: string;
}) => {
  const { networkId, accountId } = props;
  const { includeNFTsInTotal } = useAppSelector((s) => s.settings);

  const fiat = useCurrentFiatValue();
  const { account } = useAccount({
    networkId,
    accountId,
  });
  const defiValues = useAppSelector((s) => {
    const v =
      s.overview.totalDefiValues?.[`${networkId}--${account?.address ?? ''}`];
    return {
      value: new B(v?.value ?? 0),
      value24h: new B(v?.value24h ?? 0),
    };
  });

  const tokenValues = useAccountTokenValues(networkId, accountId, true);

  const nftValue = useNFTPrice({
    accountId: account?.address,
    networkId,
  });

  const nftValues = useMemo(() => {
    if (includeNFTsInTotal) {
      return {
        value: new B(nftValue),
        value24h: new B(0),
      };
    }
    return {
      value: new B(0),
      value24h: new B(0),
    };
  }, [nftValue, includeNFTsInTotal]);

  return [defiValues, tokenValues, nftValues].reduce(
    (sum, next, i) => {
      const v = i === 1 ? next.value : next.value.multipliedBy(fiat);
      const v24h = i === 1 ? next.value24h : next.value24h.multipliedBy(fiat);
      return {
        ...sum,
        value: sum.value.plus(v),
        value24h: sum.value24h.plus(v24h),
      };
    },
    {
      value: new B(0),
      value24h: new B(0),
    },
  );
};
