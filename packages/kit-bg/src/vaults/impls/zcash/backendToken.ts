import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';

import type { IPrivacyChainComposedBalance } from '@onekeyhq/shared/src/utils/privacyChainBalanceUtils';
import type {
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';

function parsed(value: string, decimals: number): string {
  return new BigNumber(value).shiftedBy(-decimals).toFixed();
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
  const fiatValue = new BigNumber(balanceParsed).multipliedBy(price).toFixed();
  const frozenBalanceFiatValue = new BigNumber(frozenBalanceParsed)
    .multipliedBy(price)
    .toFixed();
  response.data.data.tokens.map[nativeToken.$key] = {
    ...nativeFiat,
    balance: balance.total,
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
    balanceParsed: spendableParsed,
    frozenBalance: balance.frozen,
    frozenBalanceParsed,
    totalBalance: balance.total,
    totalBalanceParsed,
    fiatValue: new BigNumber(spendableParsed).multipliedBy(price).toFixed(),
    frozenBalanceFiatValue: new BigNumber(frozenBalanceParsed)
      .multipliedBy(price)
      .toFixed(),
    totalBalanceFiatValue: new BigNumber(totalBalanceParsed)
      .multipliedBy(price)
      .toFixed(),
  });
  return true;
}
