import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type {
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../factory';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

type ILocalWalletNativePriceQuery = {
  backgroundApi: IBackgroundApi;
  networkId: string;
  requestCurrency?: string;
};

export type ILocalWalletNativeQuote = {
  price?: number;
  price24h?: number;
};

async function fetchNativeQuote({
  backgroundApi,
  networkId,
  requestCurrency,
}: ILocalWalletNativePriceQuery) {
  const chainVault = await vaultFactory.getChainOnlyVault({ networkId });
  const tokenAddress = await backgroundApi.serviceToken.getNativeTokenAddress({
    networkId,
  });
  // Straight to the wallet API: these vaults answer token details from their own scan.
  const quote = await chainVault.fetchTokenDetailsByApi({
    networkId,
    contractList: [tokenAddress],
    requestCurrency,
  });
  return quote.data.data.find((token) => token.info.address === tokenAddress);
}

// The API may send numbers as numeric strings, or null.
function toFiniteNumber(value: number | string | null | undefined) {
  const number = new BigNumber(value ?? '');
  return number.isFinite() ? number.toNumber() : undefined;
}

// Local-wallet chains get no quote from an account-scoped request, so the
// native quote is asked for by network alone; no request carries an address.
// A failed, missing or unusable value is `undefined`, never 0.
export async function fetchLocalWalletNativeTokenQuote(
  query: ILocalWalletNativePriceQuery,
): Promise<ILocalWalletNativeQuote> {
  let token: Awaited<ReturnType<typeof fetchNativeQuote>>;
  try {
    token = await fetchNativeQuote(query);
  } catch {
    return {};
  }
  const price = toFiniteNumber(token?.price);
  if (price === undefined || price <= 0) return {};
  return { price, price24h: toFiniteNumber(token?.price24h) };
}

export async function fetchLocalWalletNativeTokenPrice(
  query: ILocalWalletNativePriceQuery,
): Promise<number | undefined> {
  return (await fetchLocalWalletNativeTokenQuote(query)).price;
}

function isUnpricedNativeTransfer(transfer: IDecodedTxTransferInfo): boolean {
  return transfer.isNative === true && isNil(transfer.price);
}

function getUnpricedFee(tx: IAccountHistoryTx): BigNumber | undefined {
  if (tx.decodedTx.totalFeeFiatValue) return undefined;
  const fee = new BigNumber(tx.decodedTx.totalFeeInNative ?? '');
  return fee.isFinite() && fee.gt(0) ? fee : undefined;
}

function priceActions(
  actions: IDecodedTxAction[] | undefined,
  price: string,
): { actions: IDecodedTxAction[] | undefined; changed: boolean } {
  let changed = false;
  const priceTransfer = (transfer: IDecodedTxTransferInfo) => {
    if (!isUnpricedNativeTransfer(transfer)) return transfer;
    changed = true;
    return { ...transfer, price };
  };
  const priced = actions?.map((action) =>
    action.assetTransfer
      ? {
          ...action,
          assetTransfer: {
            ...action.assetTransfer,
            sends: action.assetTransfer.sends.map(priceTransfer),
            receives: action.assetTransfer.receives.map(priceTransfer),
          },
        }
      : action,
  );
  return { actions: changed ? priced : actions, changed };
}

// Rows a local wallet builds carry no quote. Fills only the native amounts and
// fee the source left unpriced; `price` is in the history's display currency.
export function applyLocalWalletNativePriceToHistoryTx({
  tx,
  price,
}: {
  tx: IAccountHistoryTx;
  price: number;
}): IAccountHistoryTx {
  const priceText = new BigNumber(price).toFixed();
  const actions = priceActions(tx.decodedTx.actions, priceText);
  const outputActions = priceActions(tx.decodedTx.outputActions, priceText);
  const unpricedFee = getUnpricedFee(tx);
  if (!actions.changed && !outputActions.changed && !unpricedFee) {
    return tx;
  }
  return {
    ...tx,
    decodedTx: {
      ...tx.decodedTx,
      actions: actions.actions ?? tx.decodedTx.actions,
      outputActions: outputActions.actions,
      totalFeeFiatValue: unpricedFee
        ? unpricedFee.times(price).toFixed()
        : tx.decodedTx.totalFeeFiatValue,
    },
  };
}

export function isLocalWalletHistoryTxUnpriced(tx: IAccountHistoryTx): boolean {
  const hasUnpricedTransfer = [
    ...(tx.decodedTx.actions ?? []),
    ...(tx.decodedTx.outputActions ?? []),
  ].some((action) =>
    [
      ...(action.assetTransfer?.sends ?? []),
      ...(action.assetTransfer?.receives ?? []),
    ].some(isUnpricedNativeTransfer),
  );
  return hasUnpricedTransfer || getUnpricedFee(tx) !== undefined;
}
