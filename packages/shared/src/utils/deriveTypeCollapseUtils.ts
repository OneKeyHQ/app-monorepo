import BigNumber from 'bignumber.js';

import networkUtils from './networkUtils';
import { isValidNumberValue } from './tokenValueUtils';

import type { ITokenFiat } from '../../types/token';

export type IDeriveTypeAssetState = {
  deriveType: string;
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
  return networkUtils.isBTCMainnet(networkId);
}

function isPositiveAmount(value: string | undefined): boolean {
  return isValidNumberValue(value) && new BigNumber(value).gt(0);
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

// Collapsed means the account only shows its default address type. Given the
// state of every derive type (the caller makes sure each one has an account),
// that is allowed only when the default type is among them, every one of them
// has a balance record, and none except the default one holds assets.
function shouldCollapseDeriveTypes({
  defaultDeriveType,
  deriveTypeStates,
}: {
  defaultDeriveType: string | undefined;
  deriveTypeStates: IDeriveTypeAssetState[];
}): boolean {
  if (!deriveTypeStates.some((item) => item.deriveType === defaultDeriveType)) {
    return false;
  }
  return deriveTypeStates.every(
    (item) =>
      item.hasBalanceRecord &&
      (item.deriveType === defaultDeriveType || !item.hasAssets),
  );
}

export default {
  isDeriveTypeCollapseSupportedNetwork,
  hasAssetsInTokenListMap,
  shouldCollapseDeriveTypes,
};
