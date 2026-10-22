import BigNumber from 'bignumber.js';

import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IEarnStakeType,
  IEarnTokenInfo,
  IEarnWithdrawActionIcon,
  IProtocolInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';

const NATIVE_EARN_WRAPPED_ETH_SYMBOL = 'WETH';
const BORROW_CLAIM_SCOPE_VERSION = 'v1';
const BORROW_SET_COLLATERAL_SCOPE_VERSION = 'v1';

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

/**
 * The token the detail page's flows take (the manage page, the withdrawal
 * by order), from the v2 detail: its subscription token at the balance the
 * page shows. Undefined until the detail carries the token.
 */
export function buildEarnTokenInfo({
  detailInfo,
  networkId,
  provider,
  vault,
  accountId,
}: {
  detailInfo: IStakeEarnDetail | undefined;
  networkId: string;
  provider: string;
  vault: string | undefined;
  accountId: string;
}): IEarnTokenInfo | undefined {
  if (!detailInfo?.subscriptionValue?.token) {
    return undefined;
  }
  const balanceBN = new BigNumber(detailInfo.subscriptionValue.balance || '0');
  return {
    balanceParsed: balanceBN.isNaN() ? '0' : balanceBN.toFixed(),
    token: detailInfo.subscriptionValue.token.info,
    price: detailInfo.subscriptionValue.token.price,
    networkId,
    provider,
    vault: detailInfo.protocol?.vault ?? vault,
    accountId,
  };
}

/**
 * The protocol the detail page's flows take, from the v2 detail and the
 * account it was read for: the server's protocol block with the page's
 * limits and the local tx tag. Undefined until the detail carries the
 * protocol.
 */
export function buildEarnProtocolInfo({
  detailInfo,
  earnAccount,
  provider,
  symbol,
  vault,
}: {
  detailInfo: IStakeEarnDetail | undefined;
  earnAccount: NonNullable<IProtocolInfo['earnAccount']>;
  provider: string;
  symbol: string;
  vault: string | undefined;
}): IProtocolInfo | undefined {
  if (!detailInfo?.protocol) {
    return undefined;
  }
  const withdrawAction = detailInfo.actions?.find(
    (i) => i.type === 'withdraw',
  ) as IEarnWithdrawActionIcon | undefined;
  return {
    ...detailInfo.protocol,
    apyDetail: detailInfo.apyDetail,
    earnAccount,
    activeBalance: withdrawAction?.data?.balance,
    eventEndTime: detailInfo.countDownAlert?.endTime,
    stakeTag: buildLocalTxStatusSyncId({
      providerName: provider,
      tokenSymbol: symbol,
      protocolVault: detailInfo.protocol.vault ?? vault,
    }),
    overflowBalance: detailInfo.nums?.overflow,
    maxUnstakeAmount: detailInfo.nums?.maxUnstakeAmount,
    minUnstakeAmount: detailInfo.nums?.minUnstakeAmount,
    minTransactionFee: detailInfo.nums?.minTransactionFee,
    remainingCap: detailInfo.nums?.remainingCap,
    claimable: detailInfo.nums?.claimable,
    withdrawApprove: detailInfo.withdrawApprove,
    receiptTokenRate:
      detailInfo.protocol.receiptTokenRate ??
      detailInfo.protocol.morphoTokenRate,
    morphoTokenRate: detailInfo.protocol.morphoTokenRate,
  };
}

// Borrow tag formats:
// borrow:{provider}:{action}
// borrow:{provider}:claim:{claimIds}[:v1:{networkId}:{marketAddress}]
// borrow:{provider}:setCollateral:v1:{networkId}:{marketAddress}:{reserveAddress}
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
}: {
  provider: string;
  action: IBorrowAction;
  claimIds?: string[];
  claimScope?: IBorrowClaimScope;
  setCollateralScope?: IBorrowSetCollateralScope;
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
  return {
    provider: parts[1],
    action: parts[2] as IBorrowAction,
    ...(parts[2] === 'claim' && parts[3]
      ? { claimIds: parts[3].split(',') }
      : {}),
    ...(claimScope ? { claimScope } : {}),
    ...(setCollateralScope ? { setCollateralScope } : {}),
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
