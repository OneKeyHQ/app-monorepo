// cspell:ignore cbbtc Cbbtc CBBTC

import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EBorrowProviderEnum,
  type IBorrowBalance,
} from '@onekeyhq/shared/types/staking';

const CBBTC_SYMBOL = 'cbbtc';
const AAVE_CORE_MARKET_ADDRESS = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2';

type ICbbtcAssetLike = {
  token?: {
    symbol?: string;
  };
  walletBalance?: Partial<IBorrowBalance>;
};

export function isAaveCoreMarket({
  networkId,
  providerName,
  marketAddress,
}: {
  networkId?: string;
  providerName?: string;
  marketAddress?: string;
}) {
  return (
    networkId === getNetworkIdsMap().eth &&
    providerName?.toLowerCase() === EBorrowProviderEnum.Aave &&
    marketAddress?.toLowerCase() === AAVE_CORE_MARKET_ADDRESS
  );
}

export function isCbbtcAsset(asset: ICbbtcAssetLike) {
  return asset.token?.symbol?.toLowerCase() === CBBTC_SYMBOL;
}

export function splitCbbtcAssets<T extends ICbbtcAssetLike>({
  assets,
  networkId,
  providerName,
  marketAddress,
  getBalance = (asset) => asset.walletBalance,
}: {
  assets: T[];
  networkId?: string;
  providerName?: string;
  marketAddress?: string;
  getBalance?: (asset: T) => Partial<IBorrowBalance> | undefined;
}) {
  if (!isAaveCoreMarket({ networkId, providerName, marketAddress })) {
    return { visibleAssets: assets, foldedAssets: [] as T[] };
  }

  const visibleAssets: T[] = [];
  const foldedAssets: T[] = [];

  assets.forEach((asset) => {
    const balance = getBalance(asset);
    const rawAmount = balance?.number ?? balance?.amount;
    const balanceBN = new BigNumber(rawAmount ?? '');
    const hasConfirmedZeroBalance =
      rawAmount !== undefined && !balanceBN.isNaN() && balanceBN.isZero();

    if (isCbbtcAsset(asset) && hasConfirmedZeroBalance) {
      foldedAssets.push(asset);
    } else {
      visibleAssets.push(asset);
    }
  });

  return { visibleAssets, foldedAssets };
}
