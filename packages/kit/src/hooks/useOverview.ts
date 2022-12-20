import B from 'bignumber.js';

import { useAppSelector } from './useAppSelector';

export type OverviewAssetType = 'defis' | 'tokens' | 'nfts';

export const useAccountValues = (props: {
  networkId: string;
  accountAddress: string;
  assetTypes: OverviewAssetType[];
}) => {
  const { networkId, accountAddress, assetTypes } = props;
  return useAppSelector((s) =>
    Object.entries(
      s.overview.totalValues?.[`${networkId}--${accountAddress}`] ?? {},
    )
      .filter((n) => assetTypes.includes(n[0] as OverviewAssetType))
      .reduce(
        (sum, n) => ({
          value: sum.value.plus(n[1].value),
          value24h: sum.value.plus(n[1].value24h),
        }),
        {
          value: new B(0),
          value24h: new B(0),
        },
      ),
  );
};

export const useAccountAllValues = (networkId: string, address: string) =>
  useAccountValues({
    networkId,
    accountAddress: address,
    assetTypes: ['defis', 'tokens', 'nfts'],
  });
