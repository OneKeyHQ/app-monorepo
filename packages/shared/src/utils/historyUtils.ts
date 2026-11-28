import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';

import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxStatus,
} from '../../types/history';
import { EDecodedTxStatus } from '../../types/tx';
import { SEARCH_KEY_MIN_LENGTH } from '../consts/walletConsts';
import { ETranslations } from '../locale';
import { TX_RISKY_LEVEL_SPAM } from '../walletConnect/constant';

import { formatDate } from './dateUtils';

import type { ICurrencyItem } from '../../types/currency';
import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
  IOnChainHistoryTx,
  IOnChainHistoryTxNFT,
  IOnChainHistoryTxToken,
  IOnChainHistoryTxTransfer,
} from '../../types/history';
import type { IDecodedTxTransferInfo } from '../../types/tx';

// usd
const LOW_VALUE_RECEIVE_TX_THRESHOLD = 0.01;

export function getOnChainHistoryTransferDisplayAddress({
  transfer,
  endpoint,
}: {
  transfer: IOnChainHistoryTxTransfer;
  endpoint: 'from' | 'to';
}): string {
  if (transfer.type === EOnChainHistoryTransferType.Shielded) {
    // Only a real address; the indexer may put the label there.
    return transfer.address && transfer.address !== transfer.label
      ? transfer.address
      : '';
  }
  return transfer[endpoint];
}

export function getOnChainHistoryTxStatus(
  onChainTxStatus: EOnChainHistoryTxStatus,
) {
  if (onChainTxStatus === EOnChainHistoryTxStatus.Failed)
    return EDecodedTxStatus.Failed;

  if (onChainTxStatus === EOnChainHistoryTxStatus.Success)
    return EDecodedTxStatus.Confirmed;

  return EDecodedTxStatus.Pending;
}

// Indexer-decoded transfers carry the multiplier used for their displayed amount.
export function hasIndexedTokenTransfers(
  tx?: IAccountHistoryTx,
  legacyOnly = false,
) {
  const transfer = tx?.decodedTx.actions?.[0]?.assetTransfer;
  return (
    tx?.isLocalCreated === false &&
    tx.decodedTx.isFinal &&
    !!transfer &&
    [...transfer.sends, ...transfer.receives].some(
      (asset) =>
        asset.tokenIdOnNetwork &&
        !asset.isNative &&
        !asset.isNFT &&
        (!legacyOnly || asset.balanceMultiplier === undefined),
    )
  );
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
  let balanceMultiplier: string | undefined;
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
    balanceMultiplier = info.balanceMultiplier;
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
    balanceMultiplier,
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
    txDetails?.gasFeeFiatValue ??
    scaleFeeFiatValueToNativeFee({
      feeFiatValue: decodedTx?.totalFeeFiatValue,
      feeInNative: decodedTx?.totalFeeInNative,
      nextFeeInNative: gasFee,
    });
  const confirmations = txDetails?.confirmations ?? decodedTx?.confirmations;
  const blockHeight = txDetails?.block ?? decodedTx?.block;
  const protocolFeeInNative =
    txDetails?.protocolFeeInNative ?? decodedTx?.protocolFeeInNative;
  const feeInNative =
    protocolFeeInNative !== undefined && gasFee !== undefined
      ? new BigNumber(gasFee).plus(protocolFeeInNative).toFixed()
      : gasFee;
  const feeFiatValue = scaleFeeFiatValueToNativeFee({
    feeFiatValue: gasFeeFiatValue,
    feeInNative: gasFee,
    nextFeeInNative: feeInNative,
  });

  return {
    date,
    nonce,
    data,
    confirmations,
    blockHeight,
    swapInfo,
    gasFee,
    gasFeeFiatValue,
    protocolFeeInNative,
    feeInNative,
    feeFiatValue,
  };
}

// sort history
export function sortHistoryTxsByTime({ txs }: { txs: IAccountHistoryTx[] }) {
  return txs.toSorted(
    (b, a) =>
      (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
      (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
  );
}

export function getHistoryTxDisplayStatus(item?: IAccountHistoryTx) {
  return item?.displayStatus ?? item?.decodedTx.status;
}

// Pagination cursor advancement check shared by the load-more hook and the
// merge-derive aggregator. Without this guard a misbehaving backend that
// returns the same (or non-decreasing) cursor can wedge the client into an
// infinite onEndReached → loadMore loop.
//
// Indexer chains feed `next` back as the next request's `maxTimestampMs`, so
// the cursor is a millisecond timestamp and "forward" means strictly
// decreasing. Non-indexer chains treat `next` as an opaque token (some
// backends emit monotonically increasing offsets), so for them any non-empty
// cursor that differs from the previous one counts as progress.
export function isHistoryCursorAdvanced(
  previousCursor: string | undefined,
  nextCursor: string | undefined,
  options?: { indexerTimestampCursor?: boolean },
): boolean {
  if (!nextCursor) return false;
  if (!previousCursor) return true;
  if (nextCursor === previousCursor) return false;
  if (!options?.indexerTimestampCursor) return true;
  const a = Number(previousCursor);
  const b = Number(nextCursor);
  if (Number.isFinite(a) && Number.isFinite(b)) return b < a;
  return true;
}

export function convertToSectionGroups(params: {
  formatDate: (date: number) => string;
  hideUndatedHeaders?: boolean;
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
    if (getHistoryTxDisplayStatus(item) === EDecodedTxStatus.Pending) {
      pendingGroup?.data.push(item);
    } else {
      const timestamp =
        item.decodedTx.updatedAt || item.decodedTx.createdAt || 0;
      const dateKey =
        !timestamp && params.hideUndatedHeaders
          ? undefined
          : formatDateFn(timestamp);
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

  for (const receive of filteredReceives) {
    const price = new BigNumber(receive.price ?? NaN);
    if (price.isFinite() && price.gt(0)) {
      hasNonZeroPrice = true;
      totalFiatValue = totalFiatValue.plus(price.times(receive.amount));
    } else if (!receive.isNFT) {
      return false;
    }
  }

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

// Apply a display transform without mutating the cached history row.
export function mapHistoryTransfers(
  tx: IAccountHistoryTx,
  update: (
    asset: IDecodedTxTransferInfo,
    side: 'sends' | 'receives',
    index: number,
  ) => IDecodedTxTransferInfo,
) {
  const mapActions = (actions: IAccountHistoryTx['decodedTx']['actions']) =>
    actions.map((action) => {
      const group = action.assetTransfer;
      if (!group) return action;
      const sends = group.sends.map((asset, i) => update(asset, 'sends', i));
      const receives = group.receives.map((asset, i) =>
        update(asset, 'receives', i),
      );
      if (
        sends.every((a, i) => a === group.sends[i]) &&
        receives.every((a, i) => a === group.receives[i])
      )
        return action;
      return { ...action, assetTransfer: { ...group, sends, receives } };
    });
  const { decodedTx } = tx;
  const actions = mapActions(decodedTx.actions);
  const outputActions =
    decodedTx.outputActions && mapActions(decodedTx.outputActions);
  if (
    actions.every((a, i) => a === decodedTx.actions[i]) &&
    !outputActions?.some((a, i) => a !== decodedTx.outputActions?.[i])
  )
    return tx;
  return {
    ...tx,
    decodedTx: {
      ...decodedTx,
      actions,
      ...(outputActions && { outputActions }),
    },
  };
}

export function convertHistoryTxFiatCurrency({
  tx,
  targetCurrency,
  currencyMap,
  hideUnconvertible,
}: {
  tx: IAccountHistoryTx;
  targetCurrency: string;
  currencyMap?: Record<string, ICurrencyItem>;
  hideUnconvertible?: boolean;
}): IAccountHistoryTx {
  const sourceCurrency = tx.fiatCurrency;
  if (sourceCurrency === targetCurrency) {
    return tx;
  }
  const sourceRate = new BigNumber(
    (sourceCurrency && currencyMap?.[sourceCurrency]?.value) || NaN,
  );
  const targetRate = new BigNumber(currencyMap?.[targetCurrency]?.value ?? NaN);
  const rate =
    sourceRate.gt(0) && targetRate.gt(0)
      ? targetRate.div(sourceRate)
      : undefined;
  // Without both rates the snapshot cannot be converted. The row is returned
  // as stored, so its values and currency are still there to convert once the
  // rates are back. Only a copy made for display drops them, because showing
  // no fiat value is better than showing one in the wrong currency.
  if (!rate && !hideUnconvertible) {
    return tx;
  }
  const convert = (value: string | undefined) => {
    if (isNil(value) || !rate) {
      return undefined;
    }
    const converted = new BigNumber(value).times(rate);
    return converted.isNaN() ? undefined : converted.toFixed();
  };
  const converted = mapHistoryTransfers(tx, (asset) => ({
    ...asset,
    price: convert(asset.price),
  }));
  return {
    ...converted,
    fiatCurrency: rate ? targetCurrency : undefined,
    decodedTx: {
      ...converted.decodedTx,
      totalFeeFiatValue: convert(tx.decodedTx.totalFeeFiatValue),
    },
  };
}

// The server prices history rows in the currency of the request, and rows are
// cached with that snapshot. Rows fetched under another display currency are
// converted here, so they are never shown with the new currency's symbol on
// the old currency's numbers (OK-67171).
// `hideUnconvertible` is for copies that are only displayed: a row whose rate
// is missing loses its fiat values there. Never set it for rows that are saved.
export function convertHistoryTxsFiatCurrency({
  txs,
  targetCurrency,
  currencyMap,
  hideUnconvertible,
}: {
  txs: IAccountHistoryTx[];
  targetCurrency?: string;
  currencyMap?: Record<string, ICurrencyItem>;
  hideUnconvertible?: boolean;
}): IAccountHistoryTx[] {
  if (
    !targetCurrency ||
    txs.every((tx) => !tx.fiatCurrency || tx.fiatCurrency === targetCurrency)
  ) {
    return txs;
  }
  return txs.map((tx) =>
    tx.fiatCurrency
      ? convertHistoryTxFiatCurrency({
          tx,
          targetCurrency,
          currencyMap,
          hideUnconvertible,
        })
      : tx,
  );
}

// A fee's fiat value belongs to the native fee it was priced with. When that
// native fee is replaced (a pending row's estimate by the fee actually paid),
// the fiat value is scaled by the same ratio and stays in its currency.
// Without a usable ratio it is dropped: showing no fiat fee is better than
// showing the fiat value of another fee.
export function scaleFeeFiatValueToNativeFee({
  feeFiatValue,
  feeInNative,
  nextFeeInNative,
}: {
  feeFiatValue: string | undefined;
  feeInNative: string | undefined;
  nextFeeInNative: string | undefined;
}): string | undefined {
  if (isNil(feeFiatValue) || feeInNative === nextFeeInNative) {
    return feeFiatValue;
  }
  const fee = new BigNumber(feeInNative ?? NaN);
  const nextFee = new BigNumber(nextFeeInNative ?? NaN);
  if (fee.eq(nextFee)) {
    return feeFiatValue;
  }
  const scaled = new BigNumber(feeFiatValue).times(nextFee).div(fee);
  return fee.gt(0) && scaled.isFinite() ? scaled.toFixed() : undefined;
}

export function checkIsScamTx({ tx }: { tx: IAccountHistoryTx }) {
  return (
    tx.decodedTx.riskyLevel && tx.decodedTx.riskyLevel >= TX_RISKY_LEVEL_SPAM
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

/**
 * The amount a UTXO history row should display. The server's `value` is the
 * account's net change, so it is `0` when every input and output belongs to
 * the account — a transfer between two of its own addresses (fresh receive
 * address to fresh receive address). Show what actually moved instead: the
 * owned outputs the server does not explicitly mark as change. A transaction
 * whose owned outputs are all change has no recipient, so it keeps the net
 * value rather than presenting the change as a payment.
 */
export function getUtxoHistoryDisplayValue({
  value,
  sends,
  receives,
}: Pick<IOnChainHistoryTx, 'value' | 'sends' | 'receives'>): string {
  const valueBN = new BigNumber(value ?? '');
  if (!valueBN.isNaN() && !valueBN.isZero()) {
    return value;
  }
  if (!sends?.length || !receives?.length) {
    return value;
  }
  const isSelfTransfer =
    sends.every((send) => send.isOwn === true) &&
    receives.every((receive) => receive.isOwn === true);
  if (!isSelfTransfer) {
    return value;
  }
  const moved = receives
    .filter((receive) => receive.isChange !== true)
    .reduce(
      (sum, receive) => sum.plus(new BigNumber(receive.amount ?? 0)),
      new BigNumber(0),
    );
  if (moved.isNaN() || moved.isZero()) {
    return value;
  }
  return moved.toFixed();
}
