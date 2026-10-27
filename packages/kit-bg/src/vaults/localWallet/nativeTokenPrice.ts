import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type {
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../factory';
import { getVaultSettings } from '../settings';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

type ILocalWalletNativePriceQuery = {
  backgroundApi: IBackgroundApi;
  networkId: string;
  backendIndex?: boolean;
  // The token search prices in this currency; market detail in the settings one.
  requestCurrency?: string;
};

async function fetchNativeQuotePrice({
  backgroundApi,
  networkId,
  backendIndex,
  requestCurrency,
}: ILocalWalletNativePriceQuery): Promise<number | string | undefined> {
  if (backendIndex) {
    const chainVault = await vaultFactory.getChainOnlyVault({ networkId });
    const tokenAddress = await backgroundApi.serviceToken.getNativeTokenAddress(
      { networkId },
    );
    const quote = await chainVault.fetchTokenDetails({
      networkId,
      contractList: [tokenAddress],
      requestCurrency,
    });
    return quote.data.data.find((token) => token.info.address === tokenAddress)
      ?.price;
  }
  const { marketCoingeckoId } =
    (await getVaultSettings({ networkId })).localWallet ?? {};
  if (marketCoingeckoId) {
    const detail = await backgroundApi.serviceMarket.fetchMarketTokenDetail(
      marketCoingeckoId,
      false,
      requestCurrency,
    );
    return detail?.stats?.currentPrice;
  }
  const quote =
    await backgroundApi.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
      '',
      networkId,
      { autoHandleError: false },
    );
  return quote?.data?.token?.priceConverted ?? quote?.data?.token?.price;
}

// Local-wallet chains get no quote from an account-scoped request, so the
// native price is asked for by asset alone: the wallet token search on
// indexed chains, market detail by market id or by network otherwise. No
// request carries an address.
// A failed, missing or unusable quote is `undefined`, never 0.
export async function fetchLocalWalletNativeTokenPrice(
  query: ILocalWalletNativePriceQuery,
): Promise<number | undefined> {
  let quotePrice: number | string | undefined;
  try {
    quotePrice = await fetchNativeQuotePrice(query);
  } catch {
    return undefined;
  }
  const price = new BigNumber(quotePrice ?? '');
  return price.isFinite() && price.gt(0) ? price.toNumber() : undefined;
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
