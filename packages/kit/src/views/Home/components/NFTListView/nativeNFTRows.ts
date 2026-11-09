import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

// NativeList theme colors must be hex. Hover only dims the image (see
// index.css), so the tile itself stays clear.
export const NFT_WEB_ROW_FILL_THEME = {
  rowHoverBackground: '#00000000',
  rowPressedBackground: '#00000000',
};

export function buildNativeNFTRowsByKey(
  nfts: IAccountNFT[],
  fallbackAccountId?: string,
  fallbackNetworkId?: string,
) {
  return new Map(
    nfts.map((nft) => [
      `${nft.accountId ?? fallbackAccountId ?? ''}:${nft.networkId ?? fallbackNetworkId ?? ''}:${nft.collectionAddress}:${nft.itemId}`,
      nft,
    ]),
  );
}
