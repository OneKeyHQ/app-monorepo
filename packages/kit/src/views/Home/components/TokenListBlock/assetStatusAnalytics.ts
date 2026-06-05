import BigNumber from 'bignumber.js';

import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export const WALLET_ASSET_STATUS_THRESHOLD_USD = '1';
export const WALLET_ASSET_STATUS_LOW_BALANCE_BUCKET = 'lt_1_usd';
export const WALLET_ASSET_STATUS_FUNDED_BALANCE_BUCKET = 'gte_1_usd';
export const WALLET_ASSET_STATUS_SOURCE = 'home_all_network';
export const WALLET_ASSET_STATUS_REPORT_INTERVAL_MS =
  timerUtils.getTimeDurationMs({ day: 1 });
export const WALLET_ASSET_STATUS_THRESHOLD_CURRENCY = USD_CURRENCY_ID;
export const WALLET_ASSET_STATUS_SCOPE = 'instance';
export const WALLET_ASSET_STATUS_BASIS = 'all_eligible_wallets_token_usd';
export const WALLET_ASSET_STATUS_ELIGIBLE_WALLET_TYPES = 'hd_hw_qr';

export type IWalletAssetStatus = 'low' | 'funded';
export type IWalletAssetStatusPreviousStatus = IWalletAssetStatus | 'unknown';
export type IWalletAssetStatusBalanceBucket =
  | typeof WALLET_ASSET_STATUS_LOW_BALANCE_BUCKET
  | typeof WALLET_ASSET_STATUS_FUNDED_BALANCE_BUCKET;
export type IWalletAssetStatusChangeReason =
  | 'below_threshold'
  | 'above_threshold';

type IWalletAssetStatusAccountRef = {
  accountId?: string;
  networkId?: string;
};

type IWalletAssetStatusCurrencyRef = {
  tokens: {
    currency?: string;
  };
  smallBalanceTokens: {
    currency?: string;
  };
};

export type IWalletAssetStatusAccountValue = {
  accountId: string;
  value?: Record<string, string>;
  currency?: string;
};

export type IWalletAssetStatusEvaluation = {
  assetStatus?: IWalletAssetStatus;
  balanceBucket?: IWalletAssetStatusBalanceBucket;
  changeReason?: IWalletAssetStatusChangeReason;
  totalBalanceUsd?: string;
  eligibleWalletCount: number;
  eligibleAccountCount: number;
  knownAccountCount: number;
  unknownAccountCount: number;
};

function buildWalletAssetStatusResultKey({
  accountId,
  networkId,
}: IWalletAssetStatusAccountRef) {
  return `${accountId ?? ''}::${networkId ?? ''}`;
}

function getValidUsdValue(value: BigNumber.Value | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const balance = new BigNumber(value);
  if (!balance.isFinite() || balance.lt(0)) {
    return undefined;
  }

  return balance;
}

export function getWalletAssetStatusFromTotalBalanceUsd(
  totalBalanceUsd: BigNumber.Value | null | undefined,
): IWalletAssetStatus | undefined {
  const totalBalance = getValidUsdValue(totalBalanceUsd);
  if (!totalBalance) {
    return undefined;
  }

  return totalBalance.lt(WALLET_ASSET_STATUS_THRESHOLD_USD) ? 'low' : 'funded';
}

export function getWalletAssetStatusBalanceBucket(
  assetStatus: IWalletAssetStatus | undefined,
): IWalletAssetStatusBalanceBucket | undefined {
  if (assetStatus === 'low') {
    return WALLET_ASSET_STATUS_LOW_BALANCE_BUCKET;
  }
  if (assetStatus === 'funded') {
    return WALLET_ASSET_STATUS_FUNDED_BALANCE_BUCKET;
  }
  return undefined;
}

export function getWalletAssetStatusChangeReason(
  assetStatus: IWalletAssetStatus | undefined,
): IWalletAssetStatusChangeReason | undefined {
  if (assetStatus === 'low') {
    return 'below_threshold';
  }
  if (assetStatus === 'funded') {
    return 'above_threshold';
  }
  return undefined;
}

export function shouldReportWalletAssetStatusSnapshot({
  lastReportedAt,
  now = Date.now(),
}: {
  lastReportedAt: number | undefined;
  now?: number;
}) {
  return (
    lastReportedAt === undefined ||
    now - lastReportedAt >= WALLET_ASSET_STATUS_REPORT_INTERVAL_MS
  );
}

export function shouldReportWalletAssetStatusChange({
  previousStatus,
  currentStatus,
}: {
  previousStatus: IWalletAssetStatus | undefined;
  currentStatus: IWalletAssetStatus | undefined;
}) {
  if (!currentStatus) {
    return false;
  }

  if (!previousStatus) {
    return currentStatus === 'low';
  }

  return previousStatus !== currentStatus;
}

export function isWalletAssetStatusAggregationComplete({
  expectedAccounts,
  result,
}: {
  expectedAccounts: IWalletAssetStatusAccountRef[] | undefined;
  result: IWalletAssetStatusAccountRef[];
}) {
  if (!expectedAccounts?.length) {
    return false;
  }

  const resultKeys = new Set(
    result.map((item) => buildWalletAssetStatusResultKey(item)),
  );

  return expectedAccounts.every((item) =>
    resultKeys.has(buildWalletAssetStatusResultKey(item)),
  );
}

export function getWalletAssetStatusCurrency(
  result: IWalletAssetStatusCurrencyRef[],
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

function sumUsdValueMap(value: Record<string, string>) {
  return Object.values(value).reduce<BigNumber | undefined>((sum, item) => {
    if (!sum) {
      return undefined;
    }

    const validValue = getValidUsdValue(item);
    if (!validValue) {
      return undefined;
    }

    return sum.plus(validValue);
  }, new BigNumber(0));
}

export function evaluateWalletAssetStatus({
  accountValues,
  currentAccountValue,
  eligibleWalletCount,
}: {
  accountValues: IWalletAssetStatusAccountValue[];
  currentAccountValue?: IWalletAssetStatusAccountValue;
  eligibleWalletCount: number;
}): IWalletAssetStatusEvaluation {
  const accountValueMap = new Map<string, IWalletAssetStatusAccountValue>();
  accountValues.forEach((item) => {
    accountValueMap.set(item.accountId, item);
  });

  if (
    currentAccountValue &&
    accountValueMap.has(currentAccountValue.accountId)
  ) {
    accountValueMap.set(currentAccountValue.accountId, currentAccountValue);
  }

  const uniqueAccountValues = Array.from(accountValueMap.values());
  let totalBalanceUsd = new BigNumber(0);
  let knownAccountCount = 0;
  let unknownAccountCount = 0;

  for (const accountValue of uniqueAccountValues) {
    if (
      accountValue.currency?.toLowerCase() !== USD_CURRENCY_ID ||
      !accountValue.value
    ) {
      unknownAccountCount += 1;
      // eslint-disable-next-line no-continue
      continue;
    }

    const accountTotal = sumUsdValueMap(accountValue.value);
    if (!accountTotal) {
      unknownAccountCount += 1;
      // eslint-disable-next-line no-continue
      continue;
    }

    knownAccountCount += 1;
    totalBalanceUsd = totalBalanceUsd.plus(accountTotal);
  }

  const baseEvaluation = {
    eligibleWalletCount,
    eligibleAccountCount: uniqueAccountValues.length,
    knownAccountCount,
    unknownAccountCount,
  };

  if (!uniqueAccountValues.length || unknownAccountCount > 0) {
    return baseEvaluation;
  }

  const assetStatus = getWalletAssetStatusFromTotalBalanceUsd(totalBalanceUsd);
  const balanceBucket = getWalletAssetStatusBalanceBucket(assetStatus);
  const changeReason = getWalletAssetStatusChangeReason(assetStatus);

  return {
    ...baseEvaluation,
    assetStatus,
    balanceBucket,
    changeReason,
    totalBalanceUsd: totalBalanceUsd.toFixed(),
  };
}
