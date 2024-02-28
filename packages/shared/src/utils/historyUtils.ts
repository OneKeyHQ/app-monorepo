import { isNil } from 'lodash';

import { EOnChainHistoryTxStatus } from '../../types/history';
import { EDecodedTxStatus } from '../../types/tx';

import type {
  IOnChainHistoryTxAsset,
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
  tokens,
}: {
  tokenAddress: string;
  tokens: Record<string, IOnChainHistoryTxAsset>;
}) {
  let asset = null;
  let icon = '';
  let name = '';
  let symbol = '';
  let address = '';
  let isNFT = false;
  let isNative = false;
  let price = '0';
  if (!tokenAddress) {
    asset = tokens.native;
  } else {
    asset = tokens[tokenAddress];
  }

  if (asset && !isNil((asset as IOnChainHistoryTxNFT).itemId)) {
    const nft = asset as IOnChainHistoryTxNFT;
    name = nft.metadata?.name ?? '';
    symbol = nft.metadata?.name ?? '';
    icon = nft.metadata?.image ?? '';
    address = nft.collectionAddress;
    isNFT = true;
    isNative = false;
  } else if (asset && !isNil((asset as IOnChainHistoryTxToken).info?.address)) {
    const token = (asset as IOnChainHistoryTxToken).info;
    name = token.name;
    symbol = token.symbol;
    icon = token.logoURI ?? '';
    address = token.address;
    isNFT = false;
    isNative = !!token.isNative;
    price = (asset as IOnChainHistoryTxToken).price ?? '0';
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
