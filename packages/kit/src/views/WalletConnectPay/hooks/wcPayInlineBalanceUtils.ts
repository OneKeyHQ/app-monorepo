import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

// Balances the inline send needs, always in raw smallest units. `token` is
// absent for a native transfer, which is also what tells the shortfall check
// whether the order amount is owed in native or in the token.
export type IWcPayInlineBalances = {
  nativeBalance: BigNumber;
  token?: { balance: BigNumber; symbol: string; decimals: number };
};

/**
 * Raw (smallest-unit) balance of one token detail. `balance` is the raw field
 * and `balanceParsed` may be nil on some responses, so the parsed value is
 * only a back-fill. Returns undefined when neither field yields a usable
 * number — the caller must treat that as "cannot determine", never as zero.
 */
export function readWcPayInlineRawBalance(
  detail: IFetchTokenDetailItem | undefined,
): BigNumber | undefined {
  if (!detail) {
    return undefined;
  }
  const raw = new BigNumber(detail.balance ?? NaN);
  if (raw.isFinite() && !raw.isNegative()) {
    return raw;
  }
  const parsed = new BigNumber(detail.balanceParsed ?? NaN).shiftedBy(
    detail.info.decimals,
  );
  return parsed.isFinite() && !parsed.isNegative() ? parsed : undefined;
}

/**
 * Fetches the balances the send needs, straight from the server rather than
 * from any cached list — the option was chosen against a snapshot that may be
 * minutes old. Throws when a balance cannot be determined; the caller maps
 * that to a fallback, never to an "insufficient funds" verdict.
 */
export async function fetchWcPayInlineBalances({
  accountId,
  networkId,
  tokenAddress,
}: {
  accountId: string;
  networkId: string;
  // undefined for a native transfer
  tokenAddress: string | undefined;
}): Promise<IWcPayInlineBalances> {
  const nativeTokenAddress =
    await backgroundApiProxy.serviceToken.getNativeTokenAddress({ networkId });
  const [nativeDetails, tokenDetails] = await Promise.all([
    backgroundApiProxy.serviceToken.fetchTokensDetails({
      networkId,
      accountId,
      contractList: [nativeTokenAddress],
    }),
    tokenAddress
      ? backgroundApiProxy.serviceToken.fetchTokensDetails({
          networkId,
          accountId,
          contractList: [tokenAddress],
        })
      : Promise.resolve(undefined),
  ]);

  const nativeBalance = readWcPayInlineRawBalance(nativeDetails?.[0]);
  if (!nativeBalance) {
    throw new OneKeyLocalError('Native token balance unavailable');
  }
  if (!tokenAddress) {
    return { nativeBalance };
  }

  const tokenDetail = tokenDetails?.[0];
  const tokenBalance = readWcPayInlineRawBalance(tokenDetail);
  if (!tokenBalance || !tokenDetail) {
    throw new OneKeyLocalError('Token balance unavailable');
  }
  return {
    nativeBalance,
    token: {
      balance: tokenBalance,
      symbol: tokenDetail.info.symbol,
      decimals: tokenDetail.info.decimals,
    },
  };
}

export function formatWcPayInlineAmount(
  raw: BigNumber,
  decimals: number,
): string {
  return raw.shiftedBy(-decimals).toFixed();
}

/**
 * EVM's vault precheck is a base-class no-op and the headless path has no
 * TxFeeInfo to derive a shortfall from, so the comparison lives here. All
 * arithmetic stays in raw smallest units: `orderAmount` is already raw (see
 * IWcPayAmount) and the fee is shifted back up from native units.
 *
 * A native transfer owes fee + amount out of the native balance; a token
 * transfer owes the fee in native and the amount in the token.
 *
 * Returns a diagnostic message when funds are short, undefined otherwise.
 * Throws when an input is unusable — that is a broken estimate, not a verdict
 * about the user's funds.
 */
export function findWcPayInlineBalanceShortfall({
  balances,
  feeInfo,
  totalNative,
  orderAmount,
}: {
  balances: IWcPayInlineBalances;
  feeInfo: IFeeInfoUnit;
  totalNative: string;
  orderAmount: string;
}): string | undefined {
  const { nativeDecimals, nativeSymbol } = feeInfo.common;
  const feeRaw = new BigNumber(totalNative).shiftedBy(nativeDecimals);
  if (!feeRaw.isFinite()) {
    throw new OneKeyLocalError('Network fee could not be computed');
  }
  const amountRaw = new BigNumber(orderAmount);
  if (!amountRaw.isFinite() || amountRaw.isLessThanOrEqualTo(0)) {
    throw new OneKeyLocalError('Invalid payment amount');
  }

  const requiredNative = balances.token ? feeRaw : feeRaw.plus(amountRaw);
  if (balances.nativeBalance.isLessThan(requiredNative)) {
    // diagnostic only: failure.message is logged, never rendered
    return `Insufficient ${nativeSymbol}: need ${formatWcPayInlineAmount(
      requiredNative,
      nativeDecimals,
    )}, available ${formatWcPayInlineAmount(
      balances.nativeBalance,
      nativeDecimals,
    )}`;
  }

  if (balances.token && balances.token.balance.isLessThan(amountRaw)) {
    // diagnostic only: failure.message is logged, never rendered
    return `Insufficient ${balances.token.symbol}: need ${formatWcPayInlineAmount(
      amountRaw,
      balances.token.decimals,
    )}, available ${formatWcPayInlineAmount(
      balances.token.balance,
      balances.token.decimals,
    )}`;
  }

  return undefined;
}
