// cspell:ignore cbbtc Cbbtc CBBTC

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EBorrowProviderEnum,
  type IBorrowBalance,
} from '@onekeyhq/shared/types/staking';

import { hasPositiveBorrowBalance } from './borrowRepayPosition.utils';

const CBBTC_SYMBOL = 'cbbtc';

type ICbbtcAssetLike = {
  token?: {
    symbol?: string;
  };
  walletBalance?: Partial<IBorrowBalance>;
};

export function isAaveCoreMarket({
  networkId,
  providerName,
}: {
  networkId?: string;
  providerName?: string;
}) {
  return (
    networkId === getNetworkIdsMap().eth &&
    providerName?.toLowerCase() === EBorrowProviderEnum.Aave
  );
}

export function isCbbtcAsset(asset: ICbbtcAssetLike) {
  return asset.token?.symbol?.toLowerCase() === CBBTC_SYMBOL;
}

export function splitCbbtcAssets<T extends ICbbtcAssetLike>({
  assets,
  networkId,
  providerName,
  getBalance = (asset) => asset.walletBalance,
}: {
  assets: T[];
  networkId?: string;
  providerName?: string;
  getBalance?: (asset: T) => Partial<IBorrowBalance> | undefined;
}) {
  if (!isAaveCoreMarket({ networkId, providerName })) {
    return { visibleAssets: assets, foldedAssets: [] as T[] };
  }

  const visibleAssets: T[] = [];
  const foldedAssets: T[] = [];

  assets.forEach((asset) => {
    if (isCbbtcAsset(asset) && !hasPositiveBorrowBalance(getBalance(asset))) {
      foldedAssets.push(asset);
    } else {
      visibleAssets.push(asset);
    }
  });

  return { visibleAssets, foldedAssets };
}
