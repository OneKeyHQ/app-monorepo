import BigNumber from 'bignumber.js';

import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  EBorrowActionsEnum,
  type IEarnStakeType,
} from '@onekeyhq/shared/types/staking';

const NATIVE_EARN_WRAPPED_ETH_SYMBOL = 'WETH';
const BORROW_CLAIM_SCOPE_VERSION = 'v1';
const BORROW_SET_COLLATERAL_SCOPE_VERSION = 'v1';
const BORROW_SET_MODE_SCOPE_VERSION = 'v1';
const BORROW_ACTION_SCOPE_VERSION = 'v1';

function isNativeEarnEthSymbol(symbol?: string) {
  return symbol?.toUpperCase() === 'ETH';
}

export const buildLocalTxStatusSyncId = ({
  providerName = '',
  tokenSymbol = '',
  protocolVault,
}: {
  providerName?: string;
  tokenSymbol?: string;
  protocolVault?: string;
}) => {
  const baseTag = `${providerName.toLowerCase()}-${tokenSymbol.toLowerCase()}`;
  if (providerName.toLowerCase() === 'bitway' && protocolVault) {
    return `${baseTag}-${protocolVault.toLowerCase()}`;
  }
  return baseTag;
};

// Borrow tag formats:
// borrow:{provider}:{action}
// borrow:{provider}:claim:{claimIds}[:v1:{networkId}:{marketAddress}]
// borrow:{provider}:setCollateral:v1:{networkId}:{marketAddress}:{reserveAddress}
// borrow:{provider}:setEMode:v1:{networkId}:{marketAddress}
// borrow:{provider}:{action}:v1:{networkId}:{marketAddress}
export type IBorrowAction =
  | 'supply'
  | 'borrow'
  | 'withdraw'
  | 'repay'
  | 'claim'
  | 'setEMode'
  | 'setCollateral';

export type IBorrowClaimScope = {
  networkId: string;
  marketAddress: string;
};

export type IBorrowActionScope = IBorrowClaimScope;

const BORROW_MARKET_SCOPED_ACTIONS = new Set<IBorrowAction>([
  EBorrowActionsEnum.Supply,
  EBorrowActionsEnum.Borrow,
  EBorrowActionsEnum.Withdraw,
  EBorrowActionsEnum.Repay,
]);

export type IBorrowSetCollateralScope = IBorrowClaimScope & {
  reserveAddress: string;
};

export function normalizeBorrowMarketAddress({
  networkId,
  marketAddress,
}: IBorrowClaimScope): string {
  return networkUtils.isEvmNetwork({ networkId })
    ? marketAddress.toLowerCase()
    : marketAddress;
}

export function normalizeBorrowSetCollateralScope({
  networkId,
  marketAddress,
  reserveAddress,
}: IBorrowSetCollateralScope): IBorrowSetCollateralScope {
  return {
    networkId,
    marketAddress: normalizeBorrowMarketAddress({ networkId, marketAddress }),
    reserveAddress: normalizeBorrowMarketAddress({
      networkId,
      marketAddress: reserveAddress,
    }),
  };
}

export const buildBorrowTag = ({
  provider,
  action,
  claimIds,
  claimScope,
  setCollateralScope,
  setEModeScope,
  borrowScope,
}: {
  provider: string;
  action: IBorrowAction;
  claimIds?: string[];
  claimScope?: IBorrowClaimScope;
  setCollateralScope?: IBorrowSetCollateralScope;
  setEModeScope?: IBorrowClaimScope;
  borrowScope?: IBorrowActionScope;
}): string => {
  const base = `borrow:${provider.toLowerCase()}:${action}`;
  if (action === 'claim' && claimIds?.length) {
    const claimTag = `${base}:${[...claimIds].toSorted().join(',')}`;
    if (claimScope) {
      const marketAddress = normalizeBorrowMarketAddress(claimScope);
      return `${claimTag}:${BORROW_CLAIM_SCOPE_VERSION}:${encodeURIComponent(
        claimScope.networkId,
      )}:${encodeURIComponent(marketAddress)}`;
    }
    return claimTag;
  }
  if (action === 'setCollateral' && setCollateralScope) {
    const normalizedScope =
      normalizeBorrowSetCollateralScope(setCollateralScope);
    return `${base}:${BORROW_SET_COLLATERAL_SCOPE_VERSION}:${encodeURIComponent(
      normalizedScope.networkId,
    )}:${encodeURIComponent(
      normalizedScope.marketAddress,
    )}:${encodeURIComponent(normalizedScope.reserveAddress)}`;
  }
  if (action === 'setEMode' && setEModeScope) {
    const marketAddress = normalizeBorrowMarketAddress(setEModeScope);
    return `${base}:${BORROW_SET_MODE_SCOPE_VERSION}:${encodeURIComponent(
      setEModeScope.networkId,
    )}:${encodeURIComponent(marketAddress)}`;
  }
  if (BORROW_MARKET_SCOPED_ACTIONS.has(action) && borrowScope) {
    const marketAddress = normalizeBorrowMarketAddress(borrowScope);
    return `${base}:${BORROW_ACTION_SCOPE_VERSION}:${encodeURIComponent(
      borrowScope.networkId,
    )}:${encodeURIComponent(marketAddress)}`;
  }
  return base;
};

function decodeBorrowTagPart(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export const parseBorrowTag = (
  tag: string,
): {
  provider: string;
  action: IBorrowAction;
  claimIds?: string[];
  claimScope?: IBorrowClaimScope;
  setCollateralScope?: IBorrowSetCollateralScope;
  setEModeScope?: IBorrowClaimScope;
  borrowScope?: IBorrowActionScope;
} | null => {
  if (!tag.startsWith('borrow:')) return null;
  const parts = tag.split(':');
  if (parts.length < 3) return null;
  const scopeNetworkId =
    parts[4] === BORROW_CLAIM_SCOPE_VERSION
      ? decodeBorrowTagPart(parts[5])
      : undefined;
  const scopeMarketAddress =
    parts[4] === BORROW_CLAIM_SCOPE_VERSION
      ? decodeBorrowTagPart(parts[6])
      : undefined;
  const claimScope =
    scopeNetworkId && scopeMarketAddress
      ? {
          networkId: scopeNetworkId,
          marketAddress: normalizeBorrowMarketAddress({
            networkId: scopeNetworkId,
            marketAddress: scopeMarketAddress,
          }),
        }
      : undefined;
  const setCollateralScopeNetworkId =
    parts[3] === BORROW_SET_COLLATERAL_SCOPE_VERSION
      ? decodeBorrowTagPart(parts[4])
      : undefined;
  const setCollateralScopeMarketAddress =
    parts[3] === BORROW_SET_COLLATERAL_SCOPE_VERSION
      ? decodeBorrowTagPart(parts[5])
      : undefined;
  const setCollateralScopeReserveAddress =
    parts[3] === BORROW_SET_COLLATERAL_SCOPE_VERSION
      ? decodeBorrowTagPart(parts[6])
      : undefined;
  const setCollateralScope =
    parts[2] === 'setCollateral' &&
    setCollateralScopeNetworkId &&
    setCollateralScopeMarketAddress &&
    setCollateralScopeReserveAddress !== undefined
      ? normalizeBorrowSetCollateralScope({
          networkId: setCollateralScopeNetworkId,
          marketAddress: setCollateralScopeMarketAddress,
          reserveAddress: setCollateralScopeReserveAddress,
        })
      : undefined;
  const setEModeScopeNetworkId =
    parts[3] === BORROW_SET_MODE_SCOPE_VERSION
      ? decodeBorrowTagPart(parts[4])
      : undefined;
  const setEModeScopeMarketAddress =
    parts[3] === BORROW_SET_MODE_SCOPE_VERSION
      ? decodeBorrowTagPart(parts[5])
      : undefined;
  const setEModeScope =
    parts[2] === 'setEMode' &&
    setEModeScopeNetworkId &&
    setEModeScopeMarketAddress
      ? {
          networkId: setEModeScopeNetworkId,
          marketAddress: normalizeBorrowMarketAddress({
            networkId: setEModeScopeNetworkId,
            marketAddress: setEModeScopeMarketAddress,
          }),
        }
      : undefined;
  const borrowScopeNetworkId =
    BORROW_MARKET_SCOPED_ACTIONS.has(parts[2] as IBorrowAction) &&
    parts[3] === BORROW_ACTION_SCOPE_VERSION
      ? decodeBorrowTagPart(parts[4])
      : undefined;
  const borrowScopeMarketAddress =
    BORROW_MARKET_SCOPED_ACTIONS.has(parts[2] as IBorrowAction) &&
    parts[3] === BORROW_ACTION_SCOPE_VERSION
      ? decodeBorrowTagPart(parts[5])
      : undefined;
  const borrowScope =
    borrowScopeNetworkId && borrowScopeMarketAddress
      ? {
          networkId: borrowScopeNetworkId,
          marketAddress: normalizeBorrowMarketAddress({
            networkId: borrowScopeNetworkId,
            marketAddress: borrowScopeMarketAddress,
          }),
        }
      : undefined;
  return {
    provider: parts[1],
    action: parts[2] as IBorrowAction,
    ...(parts[2] === 'claim' && parts[3]
      ? { claimIds: parts[3].split(',') }
      : {}),
    ...(claimScope ? { claimScope } : {}),
    ...(setCollateralScope ? { setCollateralScope } : {}),
    ...(setEModeScope ? { setEModeScope } : {}),
    ...(borrowScope ? { borrowScope } : {}),
  };
};

export const isBorrowTag = (tag: string): boolean => tag.startsWith('borrow:');

// Check if any tag in the list is a borrow tag for the given provider
export const hasBorrowTagForProvider = (
  tags: string[],
  provider: string,
): boolean =>
  tags.some((tag) => {
    const parsed = parseBorrowTag(tag);
    return parsed?.provider === provider.toLowerCase();
  });

export function capitalizeString(str: string): string {
  if (!str) return str; // Return if the string is empty or undefined
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function normalizeStakeTokenAddress(params?: {
  address?: string;
  isNative?: boolean;
}) {
  if (!params || params.isNative) {
    return '';
  }
  return (params.address || '').toLowerCase();
}

export function resolveStakeTokenAddress(params?: {
  address?: string;
  isNative?: boolean;
}) {
  if (!params || params.isNative) {
    return '';
  }
  return params.address || '';
}

export function resolveNativeEarnStakeType({
  isNativeProvider,
  vaultSymbol,
  tokenIsNative,
}: {
  isNativeProvider: boolean;
  vaultSymbol?: string;
  tokenIsNative?: boolean;
}): IEarnStakeType | undefined {
  if (!isNativeProvider) {
    return undefined;
  }

  const normalizedVaultSymbol = vaultSymbol?.toUpperCase();
  if (normalizedVaultSymbol !== 'ETH' && normalizedVaultSymbol !== 'WETH') {
    return undefined;
  }

  return tokenIsNative ? 'wrap' : 'normal';
}

export function resolveNativeEarnProtocolSymbol({
  isNativeProvider,
  protocolSymbol,
}: {
  isNativeProvider: boolean;
  protocolSymbol?: string;
}) {
  if (!isNativeProvider) {
    return protocolSymbol || '';
  }
  return isNativeEarnEthSymbol(protocolSymbol)
    ? NATIVE_EARN_WRAPPED_ETH_SYMBOL
    : protocolSymbol || '';
}

export function resolveNativeEarnStakeRequestSymbol({
  isNativeProvider,
  protocolSymbol,
  tokenSymbol,
  tokenIsNative,
  wrappedTokenSymbol,
}: {
  isNativeProvider: boolean;
  protocolSymbol?: string;
  tokenSymbol?: string;
  tokenIsNative?: boolean;
  wrappedTokenSymbol?: string;
}) {
  if (!isNativeProvider) {
    return protocolSymbol || tokenSymbol || '';
  }
  if (tokenIsNative) {
    return (
      wrappedTokenSymbol ||
      resolveNativeEarnProtocolSymbol({
        isNativeProvider,
        protocolSymbol,
      })
    );
  }
  return (
    tokenSymbol ||
    resolveNativeEarnProtocolSymbol({
      isNativeProvider,
      protocolSymbol,
    })
  );
}

export function buildStakeTokenUniqueKey(params?: {
  uniqueKey?: string;
  address?: string;
  symbol?: string;
  isNative?: boolean;
}) {
  if (!params) {
    return '';
  }
  if (params.uniqueKey) {
    return params.uniqueKey;
  }
  return `${params.isNative ? 'native' : params.address}-${params.symbol || ''}`;
}

export function isInvalidAmount(num: string): boolean {
  return BigNumber(num).isNaN() || num.endsWith('.');
}

export function countDecimalPlaces(input: string | number): number {
  // Convert the input to a string if it's a number
  const inputNum = typeof input === 'string' ? Number(input) : input;

  if (Number.isNaN(inputNum)) {
    return 0;
  }

  const inputStr =
    typeof input === 'string' ? input : BigNumber(input).toFixed();

  // Find the decimal point
  const decimalIndex = inputStr.indexOf('.');

  // If there's no decimal point, return 0
  if (decimalIndex === -1) {
    return 0;
  }

  // Return the number of characters after the decimal point
  return inputStr.length - decimalIndex - 1;
}

export function shouldShowStakingSummaryCard({
  isDisabled,
  isPendleProvider,
  amountValue,
  hasSummarySection,
  showPendleTransactionSection,
}: {
  isDisabled?: boolean;
  isPendleProvider: boolean;
  amountValue: string;
  hasSummarySection: boolean;
  showPendleTransactionSection: boolean;
}): boolean {
  if (isDisabled) {
    return false;
  }

  if (isPendleProvider && Number(amountValue) <= 0) {
    return false;
  }

  return hasSummarySection || showPendleTransactionSection;
}
