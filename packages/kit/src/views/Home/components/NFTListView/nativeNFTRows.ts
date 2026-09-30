import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

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
