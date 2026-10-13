import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '../config/networkIds';

import type { ITokenFiat } from '../../types/token';

export type IDeriveTypeAssetState = {
  deriveType: string;
  hasAccount: boolean;
  // false means the balances of this derive type have never been read. That is
  // unknown, which must not be treated as empty.
  hasBalanceRecord: boolean;
  hasAssets: boolean;
};

// Address types are collapsed into the default one only on these networks.
// Other networks with merged derive types keep the existing UI.
function isDeriveTypeCollapseSupportedNetwork({
  networkId,
}: {
  networkId: string | undefined;
}): boolean {
  return !!networkId && networkId === getNetworkIdsMap().btc;
}

function isPositiveAmount(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const amount = new BigNumber(value);
  return amount.isFinite() && amount.gt(0);
}

// Amounts decide, not fiat value: an unpriced holding is still a holding.
// Frozen balances (e.g. inscription-protected coins) count as well.
function hasAssetsInTokenListMap({
  tokenListMap,
}: {
  tokenListMap: Record<string, ITokenFiat> | undefined;
}): boolean {
  return Object.values(tokenListMap ?? {}).some(
    (item) =>
      isPositiveAmount(item?.balance) ||
      isPositiveAmount(item?.frozenBalance) ||
      isPositiveAmount(item?.totalBalance),
  );
}

// Collapsed means the account only shows its default address type. That is
// allowed only when every derive type has an account, every one of them has a
// balance record, and none except the default one holds assets.
function shouldCollapseDeriveTypes({
  defaultDeriveType,
  deriveTypeStates,
}: {
  defaultDeriveType: string | undefined;
  deriveTypeStates: IDeriveTypeAssetState[];
}): boolean {
  if (!defaultDeriveType || deriveTypeStates.length === 0) {
    return false;
  }
  if (!deriveTypeStates.some((item) => item.deriveType === defaultDeriveType)) {
    return false;
  }
  return deriveTypeStates.every(
    (item) =>
      item.hasAccount &&
      item.hasBalanceRecord &&
      (item.deriveType === defaultDeriveType || !item.hasAssets),
  );
}

export default {
  isDeriveTypeCollapseSupportedNetwork,
  hasAssetsInTokenListMap,
  shouldCollapseDeriveTypes,
};
