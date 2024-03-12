import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';

import type { IAccountNFT } from '../../types/nft';

export function getFilteredNftsBySearchKey({
  nfts,
  searchKey,
}: {
  nfts: IAccountNFT[];
  searchKey: string;
}) {
  if (!searchKey || searchKey.length < SEARCH_KEY_MIN_LENGTH) {
    return nfts;
  }

  // eslint-disable-next-line no-param-reassign
  searchKey = searchKey.trim().toLowerCase();

  const filteredNfts = nfts.filter(
    (nft) =>
      nft.collectionAddress.toLowerCase() === searchKey ||
      nft.collectionName.toLowerCase().includes(searchKey) ||
      nft.metadata?.name.toLowerCase().includes(searchKey),
  );

  return filteredNfts;
}
