import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type {
  IBorrowAsset,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

export function filterUnavailableSupplyAssets({
  assets,
  supplyAssets,
  networkId,
}: {
  assets: IBorrowAsset[];
  supplyAssets?: IBorrowReserveItem['supply']['assets'];
  networkId: string;
}): IBorrowAsset[] {
  if (!supplyAssets) {
    return [];
  }

  const availableReserveAddresses = new Set(
    supplyAssets
      .filter((asset) => asset.supplyButton?.disabled !== true)
      .map((asset) =>
        earnUtils.normalizeBorrowAddress({
          networkId,
          address: asset.reserveAddress,
        }),
      ),
  );

  return assets.filter((asset) =>
    availableReserveAddresses.has(
      earnUtils.normalizeBorrowAddress({
        networkId,
        address: asset.reserveAddress,
      }),
    ),
  );
}
