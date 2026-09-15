import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';

import type { IPrivacyChainComposedBalance } from '@onekeyhq/shared/src/utils/privacyChainBalanceUtils';
import type {
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';

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
  const nativeToken = response.data.data.tokens.data.find(
    (token) => token.isNative || token.address === '',
  );
  const nativeFiat = nativeToken
    ? response.data.data.tokens.map[nativeToken.$key]
    : undefined;
  if (!nativeToken || !nativeFiat) {
    return false;
  }

  const balanceParsed = parsed(balance.total, decimals);
  const frozenBalanceParsed = parsed(balance.frozen, decimals);
  const price = nativeFiat.price || 0;
  const fiatValue = fiatValueOf(balanceParsed, price);
  const frozenBalanceFiatValue = fiatValueOf(frozenBalanceParsed, price);
  response.data.data.tokens.map[nativeToken.$key] = {
    ...nativeFiat,
    balance: balance.total,
    balanceStatus: balance.balanceStatus,
    balanceParsed,
    frozenBalance: balance.frozen,
    frozenBalanceParsed,
    totalBalance: balance.total,
    totalBalanceParsed: balanceParsed,
    fiatValue,
    frozenBalanceFiatValue,
    totalBalanceFiatValue: fiatValue,
  };
  response.data.data.tokens.keys = md5(
    `${response.data.data.tokens.keys}_${balance.total}_${balance.frozen}`,
  );
  return true;
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
    balanceStatus: balance.balanceStatus,
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
