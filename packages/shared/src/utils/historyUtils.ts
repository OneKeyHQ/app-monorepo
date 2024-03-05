import { EOnChainHistoryTxStatus } from '../../types/history';
import { EDecodedTxStatus } from '../../types/tx';

import type {
  IAccountHistoryTx,
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

export function getFilteredHistoryBySearchKey({
  history,
  searchKey,
}: {
  history: IAccountHistoryTx[];
  searchKey: string;
}) {
  if (!searchKey || searchKey.length < 2) {
    return history;
  }

  // eslint-disable-next-line no-param-reassign
  searchKey = searchKey.trim().toLowerCase();

  const filteredHistory = history.filter(
    (tx) =>
      tx.decodedTx.txid.toLowerCase() === searchKey ||
      tx.decodedTx.actions.some(
        (action) =>
          action.assetTransfer?.from.toLowerCase().includes(searchKey) ||
          action.assetTransfer?.to.toLowerCase().includes(searchKey) ||
          action.tokenApprove?.from.toLowerCase().includes(searchKey) ||
          action.tokenApprove?.to.toLowerCase().includes(searchKey) ||
          action.functionCall?.from.toLowerCase().includes(searchKey) ||
          action.functionCall?.to.toLowerCase().includes(searchKey) ||
          action.unknownAction?.from.toLowerCase().includes(searchKey) ||
          action.unknownAction?.to.toLowerCase().includes(searchKey) ||
          action.assetTransfer?.sends.some(
            (send) =>
              send.symbol.toLowerCase() === searchKey ||
              send.from.toLowerCase().includes(searchKey) ||
              send.to.toLowerCase().includes(searchKey),
          ) ||
          action.assetTransfer?.receives.some(
            (receive) =>
              receive.symbol.toLowerCase() === searchKey ||
              receive.from.toLowerCase().includes(searchKey) ||
              receive.to.toLowerCase().includes(searchKey),
          ) ||
          action.tokenApprove?.symbol.toLowerCase() === searchKey,
      ),
  );

  return filteredHistory;
}
