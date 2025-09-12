import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { ICurrencyItem } from '@onekeyhq/kit/src/views/Setting/pages/Currency';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';

import { EOnChainHistoryTxStatus } from '../../types/history';
import { EDecodedTxStatus } from '../../types/tx';
import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';
import { ETranslations } from '../locale';
import { TX_RISKY_LEVEL_SPAM } from '../walletConnect/constant';

import { formatDate } from './dateUtils';

import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
  IOnChainHistoryTx,
  IOnChainHistoryTxNFT,
  IOnChainHistoryTxToken,
} from '../../types/history';

// usd
const LOW_VALUE_RECEIVE_TX_THRESHOLD = 0.01;

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
  key,
  tokenAddress,
  tokens = {},
  nfts = {},
}: {
  key: string;
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
  nft = nfts[key] ?? nfts[tokenAddress];
  if (tokenAddress === '') {
    token = tokens[key] ?? tokens[tokenAddress] ?? tokens.native;
  } else {
    token = tokens[key] ?? tokens[tokenAddress];
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
  historyTx: IAccountHistoryTx | undefined;
}) {
  const decodedTx = historyTx?.decodedTx;
  let swapInfo;
  let nonce = txDetails?.nonce;
  let data = txDetails?.slicedData;

  if (isNil(nonce) && !isNil(decodedTx?.nonce)) {
    nonce = decodedTx.nonce;
  }

  if (isNil(data) && !isNil((decodedTx?.encodedTx as IEncodedTxEvm)?.data)) {
    const dataStr = (decodedTx?.encodedTx as IEncodedTxEvm)?.data ?? '';
    if (dataStr.length > 500) {
      data = `${dataStr.slice(0, 500)}...`;
    } else {
      data = dataStr;
    }
  }

  let date = '-';

  if (txDetails?.timestamp) {
    date = formatDate(new Date(txDetails.timestamp * 1000));
  } else if (decodedTx?.updatedAt || decodedTx?.createdAt) {
    date = formatDate(
      new Date(decodedTx?.updatedAt || decodedTx?.createdAt || 0),
    );
  }

  const gasFee = txDetails?.gasFee ?? decodedTx?.totalFeeInNative;
  const gasFeeFiatValue =
    txDetails?.gasFeeFiatValue ?? decodedTx?.totalFeeFiatValue;
  const confirmations = txDetails?.confirmations;
  const blockHeight = txDetails?.block;

  return {
    date,
    nonce,
    data,
    confirmations,
    blockHeight,
    swapInfo,
    gasFee,
    gasFeeFiatValue,
  };
}

// sort history
export function sortHistoryTxsByTime({ txs }: { txs: IAccountHistoryTx[] }) {
  return txs.sort(
    (b, a) =>
      (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
      (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
  );
}

export function convertToSectionGroups(params: {
  formatDate: (date: number) => string;
  items: IAccountHistoryTx[];
}): IHistoryListSectionGroup[] {
  const { items, formatDate: formatDateFn } = params;
  let pendingGroup: IHistoryListSectionGroup | undefined = {
    titleKey: ETranslations.global_pending,
    data: [],
  };
  const dateGroups: IHistoryListSectionGroup[] = [];
  let currentDateGroup: IHistoryListSectionGroup | undefined;
  items.forEach((item) => {
    if (item.decodedTx.status === EDecodedTxStatus.Pending) {
      pendingGroup?.data.push(item);
    } else {
      const dateKey = formatDateFn(
        item.decodedTx.updatedAt || item.decodedTx.createdAt || 0,
      );
      if (!currentDateGroup || currentDateGroup.title !== dateKey) {
        if (currentDateGroup) {
          dateGroups.push(currentDateGroup);
        }
        currentDateGroup = {
          title: dateKey,
          data: [],
        };
      }
      currentDateGroup.data.push(item);
    }
  });
  if (currentDateGroup) {
    dateGroups.push(currentDateGroup);
  }
  if (!pendingGroup.data.length) {
    pendingGroup = undefined;
  }
  if (pendingGroup) {
    return [pendingGroup, ...dateGroups].filter(Boolean);
  }
  return [...dateGroups].filter(Boolean);
}

export function isAccountCompatibleWithTx({
  account,
  tx,
}: {
  account: IAllNetworkAccountInfo;
  tx: IAccountHistoryTx;
}) {
  if (
    account.networkId === tx.decodedTx.networkId &&
    ((!isNil(account.accountXpub) &&
      !isNil(tx.decodedTx.xpub) &&
      account.accountXpub === tx.decodedTx.xpub) ||
      (isNil(tx.decodedTx.xpub) && isNil(account.accountXpub)))
  ) {
    return true;
  }
  return false;
}

export function buildAddressMapInfoKey({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}) {
  return `${networkId}_${address}`;
}

export function checkIsLowValueReceiveTx({
  tx,
  sourceCurrency,
  targetCurrency,
  currencyMap,
}: {
  tx: IAccountHistoryTx;
  sourceCurrency?: string;
  targetCurrency?: string;
  currencyMap?: Record<string, ICurrencyItem>;
}) {
  const actions = tx.decodedTx.actions;

  if (actions.length !== 1) {
    return false;
  }

  const action = actions[0];
  if (!action.assetTransfer) {
    return false;
  }

  const { sends, receives } = action.assetTransfer;

  const filteredSends = sends.filter((send) =>
    isNil(send.isOwn) ? true : send.isOwn,
  );

  const filteredReceives = receives.filter((receive) =>
    isNil(receive.isOwn) ? true : receive.isOwn,
  );

  if (filteredSends && filteredSends.length > 0) {
    return false;
  }

  if (!filteredReceives || filteredReceives.length === 0) {
    return false;
  }

  let totalFiatValue = new BigNumber(0);
  let hasNonZeroPrice = false;

  filteredReceives.forEach((receive) => {
    const { amount, price } = receive;

    if (new BigNumber(price ?? 0).gt(0)) {
      hasNonZeroPrice = true;
      totalFiatValue = totalFiatValue.plus(
        new BigNumber(amount ?? 0).multipliedBy(price ?? 0),
      );
    }
  });

  if (!hasNonZeroPrice) {
    return false;
  }

  if (currencyMap && sourceCurrency && targetCurrency) {
    const sourceCurrencyInfo = currencyMap[sourceCurrency];
    const targetCurrencyInfo = currencyMap[targetCurrency];

    if (
      sourceCurrencyInfo &&
      targetCurrencyInfo &&
      sourceCurrencyInfo.id !== targetCurrencyInfo.id
    ) {
      const targetTotalFiatValue = totalFiatValue
        .div(new BigNumber(sourceCurrencyInfo.value))
        .times(new BigNumber(targetCurrencyInfo.value));

      return targetTotalFiatValue.lt(LOW_VALUE_RECEIVE_TX_THRESHOLD);
    }
  }

  return totalFiatValue.lt(LOW_VALUE_RECEIVE_TX_THRESHOLD);
}

export function checkIsScamTx({ tx }: { tx: IAccountHistoryTx }) {
  return (
    tx.decodedTx.riskyLevel && tx.decodedTx.riskyLevel > TX_RISKY_LEVEL_SPAM
  );
}

export function filterHistoryTxs({
  txs,
  sourceCurrency = 'usd',
  targetCurrency = 'usd',
  filterScam,
  filterLowValue,
  currencyMap,
}: {
  txs: IAccountHistoryTx[];
  sourceCurrency?: string;
  targetCurrency?: string;
  filterScam?: boolean;
  filterLowValue?: boolean;
  currencyMap?: Record<string, ICurrencyItem>;
}) {
  if (!filterScam && !filterLowValue) {
    return txs;
  }

  return txs.filter((tx) => {
    if (filterScam && checkIsScamTx({ tx })) {
      return false;
    }
    if (
      filterLowValue &&
      checkIsLowValueReceiveTx({
        tx,
        sourceCurrency,
        targetCurrency,
        currencyMap,
      })
    ) {
      return false;
    }
    return true;
  });
}
