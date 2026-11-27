import BigNumber from 'bignumber.js';

import type { IPrivacyChainComposedBalance } from '@onekeyhq/shared/src/utils/privacyChainBalanceUtils';
import type {
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';

import { applyComposedBalancesToBackendTokenList } from '../../localWallet/tokenList';

function parsed(value: string, decimals: number): string {
  const amount = new BigNumber(value);
  return amount.isFinite() ? amount.shiftedBy(-decimals).toFixed() : '';
}

function fiatValueOf(value: string, price: number): string {
  const amount = new BigNumber(value);
  return amount.isFinite() ? amount.multipliedBy(price).toFixed() : '';
}

export function applyZcashBalanceToBackendTokenList({
  response,
  balance,
  decimals,
}: {
  response: IFetchServerTokenListResponse;
  balance: IPrivacyChainComposedBalance;
  decimals: number;
}): boolean {
  return applyComposedBalancesToBackendTokenList({
    response,
    resolveBalance: (token) =>
      token.isNative || token.address === ''
        ? {
            total: balance.total,
            frozen: balance.frozen,
            decimals,
          }
        : undefined,
  });
}

export function applyZcashBalanceToBackendTokenDetails({
  response,
  balance,
  decimals,
}: {
  response: IFetchServerTokenDetailResponse;
  balance: IPrivacyChainComposedBalance;
  decimals: number;
}): boolean {
  const nativeToken = response.data.data.find(
    (token) => token.info.isNative || token.info.address === '',
  );
  if (!nativeToken) {
    return false;
  }

  const spendableParsed = parsed(balance.spendable, decimals);
  const frozenBalanceParsed = parsed(balance.frozen, decimals);
  const totalBalanceParsed = parsed(balance.total, decimals);
  const price = nativeToken.price || 0;
  Object.assign(nativeToken, {
    balance: balance.spendable,
    balanceParsed: spendableParsed,
    frozenBalance: balance.frozen,
    frozenBalanceParsed,
    totalBalance: balance.total,
    totalBalanceParsed,
    fiatValue: fiatValueOf(spendableParsed, price),
    frozenBalanceFiatValue: fiatValueOf(frozenBalanceParsed, price),
    totalBalanceFiatValue: fiatValueOf(totalBalanceParsed, price),
  });
  return true;
}
