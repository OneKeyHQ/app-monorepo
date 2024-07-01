import { isNil } from 'lodash';

import { EOnChainHistoryTxStatus } from '../../types/history';
import { EDecodedTxStatus } from '../../types/tx';
import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';
import { OneKeyInternalError } from '../errors';

import { formatDate } from './dateUtils';

import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
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
  let decimals = 0;
  nft = nfts[tokenAddress];
  if (tokenAddress === '') {
    token = tokens[tokenAddress] || tokens.native;
  } else {
    token = tokens[tokenAddress];
  }

  if (nft) {
    name = nft.metadata?.name ?? nft.collectionName ?? '';
    symbol = nft.metadata?.name ?? nft.collectionSymbol ?? '';
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
    decimals = info.decimals;
  }
  return {
    name,
    address,
    symbol,
    icon,
    isNFT,
    isNative,
    price,
    decimals,
  };
}

export function getFilteredHistoryBySearchKey({
  history,
  searchKey,
}: {
  history: IAccountHistoryTx[];
  searchKey: string;
}) {
  if (!searchKey || searchKey.length < SEARCH_KEY_MIN_LENGTH) {
    return history;
  }

  // eslint-disable-next-line no-param-reassign
  searchKey = searchKey.trim().toLowerCase();

  const filteredHistory = history.filter(
    (tx) =>
      tx.decodedTx.txid.toLowerCase() === searchKey ||
      tx.decodedTx.actions.some(
        (action) =>
          action.assetTransfer?.from?.toLowerCase().includes(searchKey) ||
          action.assetTransfer?.to?.toLowerCase().includes(searchKey) ||
          action.tokenApprove?.from?.toLowerCase().includes(searchKey) ||
          action.tokenApprove?.to?.toLowerCase().includes(searchKey) ||
          action.functionCall?.from?.toLowerCase().includes(searchKey) ||
          action.functionCall?.to?.toLowerCase().includes(searchKey) ||
          action.unknownAction?.from?.toLowerCase().includes(searchKey) ||
          action.unknownAction?.to?.toLowerCase().includes(searchKey) ||
          action.assetTransfer?.sends?.some(
            (send) =>
              send.symbol?.toLowerCase() === searchKey ||
              send.from?.toLowerCase().includes(searchKey) ||
              send.to?.toLowerCase().includes(searchKey),
          ) ||
          action.assetTransfer?.receives?.some(
            (receive) =>
              receive.symbol?.toLowerCase() === searchKey ||
              receive.from?.toLowerCase().includes(searchKey) ||
              receive.to?.toLowerCase().includes(searchKey),
          ) ||
          action.tokenApprove?.symbol?.toLowerCase() === searchKey,
      ),
  );

  return filteredHistory;
}

export function getHistoryTxDetailInfo({
  txDetails,
  historyTx,
}: {
  txDetails: IOnChainHistoryTx | undefined;
  historyTx: IAccountHistoryTx;
}) {
  const { decodedTx } = historyTx;
  let swapInfo;
  let nonce = txDetails?.nonce;

  if (isNil(nonce) || nonce === 0) {
    nonce = decodedTx.nonce;
  }

  let date = '-';

  if (!isNil(txDetails?.timestamp)) {
    date = formatDate(new Date(txDetails.timestamp * 1000));
  } else if (!isNil(decodedTx.updatedAt) || !isNil(decodedTx.createdAt)) {
    date = formatDate(
      new Date(decodedTx.updatedAt || decodedTx.createdAt || 0),
    );
  }

  const txid = decodedTx.txid;

  const gasFee = txDetails?.gasFee ?? decodedTx.totalFeeInNative ?? '0';
  const gasFeeFiatValue =
    txDetails?.gasFeeFiatValue ?? decodedTx.totalFeeFiatValue ?? '0';
  const confirmations = txDetails?.confirmations;
  const blockHeight = txDetails?.block;

  return {
    txid,
    date,
    nonce,
    confirmations,
    blockHeight,
    swapInfo,
    gasFee,
    gasFeeFiatValue,
  };
}

export function buildLocalHistoryKey({
  networkId,
  accountAddress,
  xpub,
}: {
  networkId: string;
  accountAddress?: string;
  xpub?: string;
}) {
  if (!accountAddress && !xpub) {
    throw new OneKeyInternalError('accountAddress or xpub is required');
  }

  return `${networkId}_${accountAddress ?? xpub ?? ''}`;
}
