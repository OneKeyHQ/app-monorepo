import BigNumber from 'bignumber.js';

import type { IDBWalletType } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_QR,
} from '@onekeyhq/shared/src/consts/dbConsts';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const WALLET_ALL_NETWORK_LOW_BALANCE_THRESHOLD_USD = '1';
export const WALLET_ALL_NETWORK_LOW_BALANCE_BUCKET = 'lt_1_usd';
export const WALLET_ALL_NETWORK_LOW_BALANCE_SOURCE = 'home_all_network';
export const WALLET_ALL_NETWORK_LOW_BALANCE_REPORT_INTERVAL_MS =
  timerUtils.getTimeDurationMs({ day: 1 });
export const WALLET_ALL_NETWORK_LOW_BALANCE_THRESHOLD_CURRENCY =
  USD_CURRENCY_ID;

export type IWalletAllNetworkLowBalanceWalletType =
  | typeof WALLET_TYPE_HD
  | typeof WALLET_TYPE_HW
  | typeof WALLET_TYPE_QR;

type IWalletAllNetworkLowBalanceAccountRef = {
  accountId?: string;
  networkId?: string;
};

type IWalletAllNetworkLowBalanceCurrencyRef = {
  tokens: {
    currency?: string;
  };
  smallBalanceTokens: {
    currency?: string;
  };
};

function buildWalletAllNetworkLowBalanceResultKey({
  accountId,
  networkId,
}: IWalletAllNetworkLowBalanceAccountRef) {
  return `${accountId ?? ''}::${networkId ?? ''}`;
}

export function isWalletAllNetworkLowBalance(
  totalBalanceUsd: BigNumber.Value | null | undefined,
): boolean {
  if (totalBalanceUsd === null || totalBalanceUsd === undefined) {
    return false;
  }

  const totalBalance = new BigNumber(totalBalanceUsd);
  return (
    totalBalance.isFinite() &&
    totalBalance.gte(0) &&
    totalBalance.lt(WALLET_ALL_NETWORK_LOW_BALANCE_THRESHOLD_USD)
  );
}

export function shouldReportWalletAllNetworkLowBalance({
  totalBalanceUsd,
  currency,
  aggregationComplete,
  lastReportedAt,
  now = Date.now(),
}: {
  totalBalanceUsd: BigNumber.Value | null | undefined;
  currency: string | undefined;
  aggregationComplete: boolean;
  lastReportedAt: number | undefined;
  now?: number;
}): boolean {
  if (!aggregationComplete) {
    return false;
  }

  if (currency?.toLowerCase() !== USD_CURRENCY_ID) {
    return false;
  }

  if (!isWalletAllNetworkLowBalance(totalBalanceUsd)) {
    return false;
  }

  return (
    lastReportedAt === undefined ||
    now - lastReportedAt >= WALLET_ALL_NETWORK_LOW_BALANCE_REPORT_INTERVAL_MS
  );
}

export function getWalletAllNetworkLowBalanceWalletType(
  walletType: IDBWalletType | undefined,
): IWalletAllNetworkLowBalanceWalletType | undefined {
  if (
    walletType === WALLET_TYPE_HD ||
    walletType === WALLET_TYPE_HW ||
    walletType === WALLET_TYPE_QR
  ) {
    return walletType;
  }

  return undefined;
}

export function isWalletAllNetworkLowBalanceAggregationComplete({
  expectedAccounts,
  result,
}: {
  expectedAccounts: IWalletAllNetworkLowBalanceAccountRef[] | undefined;
  result: IWalletAllNetworkLowBalanceAccountRef[];
}) {
  if (!expectedAccounts?.length) {
    return false;
  }

  const resultKeys = new Set(
    result.map((item) => buildWalletAllNetworkLowBalanceResultKey(item)),
  );

  return expectedAccounts.every((item) =>
    resultKeys.has(buildWalletAllNetworkLowBalanceResultKey(item)),
  );
}

export function getWalletAllNetworkLowBalanceCurrency(
  result: IWalletAllNetworkLowBalanceCurrencyRef[],
) {
  const currencies = result.flatMap((item) => [
    item.tokens.currency,
    item.smallBalanceTokens.currency,
  ]);
  const firstCurrency = currencies[0];
  if (!firstCurrency) {
    return undefined;
  }

  return currencies.every((currency) => currency === firstCurrency)
    ? firstCurrency
    : undefined;
}
