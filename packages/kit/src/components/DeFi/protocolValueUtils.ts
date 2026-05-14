import BigNumber from 'bignumber.js';

import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

export function isProtocolValueUnavailable(
  value: IDeFiAsset['value'],
): boolean {
  const valueBN = new BigNumber(value);
  return !valueBN.isFinite();
}

export function isProtocolAssetValueUnavailable(
  asset: Pick<IDeFiAsset, 'amount' | 'price' | 'value'>,
): boolean {
  const valueBN = new BigNumber(asset.value);
  if (!valueBN.isFinite()) {
    return true;
  }

  const amountBN = new BigNumber(asset.amount);
  if (amountBN.isFinite() && amountBN.isZero()) {
    return false;
  }

  const priceBN = new BigNumber(asset.price);
  return !priceBN.isFinite() || priceBN.lte(0);
}
