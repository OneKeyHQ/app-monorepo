import { isProtocolAssetValueUnavailable } from '@onekeyhq/kit/src/components/DeFi/protocolValueUtils';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

export type IPositionUsdState = {
  value: number;
  hasAvailableValue: boolean;
  hasUnavailableValue: boolean;
};

// Position-level USD total = supplied assets + reward assets. Missing prices
// should not erase available value; partial totals are rendered with a tooltip.
export function getPositionUsdState(
  ...assetGroups: IDeFiAsset[][]
): IPositionUsdState {
  let total = 0;
  let hasAvailableValue = false;
  let hasUnavailableValue = false;
  for (const assets of assetGroups) {
    for (const asset of assets) {
      if (isProtocolAssetValueUnavailable(asset)) {
        hasUnavailableValue = true;
      } else {
        total += asset.value;
        hasAvailableValue = true;
      }
    }
  }
  return { value: total, hasAvailableValue, hasUnavailableValue };
}
