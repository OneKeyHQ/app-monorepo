import { EOnChainHistoryTxStatus } from '../../types/history';
import { EDecodedTxStatus } from '../../types/tx';

import type {
  IOnChainHistoryTxNFT,
  IOnChainHistoryTxToken,
} from '../../types/history';

export function getOnChainHistoryTxStatus(
  onChainTxStatus: EOnChainHistoryTxStatus,
) {
  if (onChainTxStatus === EOnChainHistoryTxStatus.Failed)
    return EDecodedTxStatus.Failed;

  if (onChainTxStatus === EOnChainHistoryTxStatus.Success)
    return EDecodedTxStatus.Confirmed;

  return EDecodedTxStatus.Pending;
}

export function getOnChainHistoryTxAssetInfo({
  tokenAddress,
  tokens = {},
  nfts = {},
}: {
  tokenAddress: string;
  tokens: Record<string, IOnChainHistoryTxToken>;
  nfts: Record<string, IOnChainHistoryTxNFT>;
}) {
  let token = null;
  let nft = null;
  let icon = '';
  let name = '';
  let symbol = '';
  let address = '';
  let isNFT = false;
  let isNative = false;
  let price = '0';
  nft = nfts[tokenAddress];
  token = tokens[tokenAddress || 'native'];

  console.log('nfts', nfts);

  if (nft) {
    name = nft.metadata?.name ?? '';
    symbol = nft.metadata?.name ?? '';
    icon = nft.metadata?.image ?? '';
    address = nft.collectionAddress;
    isNFT = true;
    isNative = false;
  } else if (token) {
    const { info } = token;
    name = info.name;
    symbol = info.symbol;
    icon = info.logoURI ?? '';
    address = info.address;
    isNFT = false;
    isNative = !!info.isNative;
    price = token.price ?? '0';
  }
  return {
    name,
    address,
    symbol,
    icon,
    isNFT,
    isNative,
    price,
  };
}
