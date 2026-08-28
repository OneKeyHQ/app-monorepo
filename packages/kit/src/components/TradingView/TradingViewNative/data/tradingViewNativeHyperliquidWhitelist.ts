import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

export type ITradingViewNativeHyperliquidWhitelistBranch =
  | 'market'
  | 'swap'
  | 'wallet';

export interface ITradingViewNativeHyperliquidWhitelistSource {
  coin: string;
  type: 'hyperliquid';
}

export interface ITradingViewNativeHyperliquidWhitelistItem {
  isNative: boolean;
  market?: ITradingViewNativeHyperliquidWhitelistSource;
  networkId: string;
  swap?: ITradingViewNativeHyperliquidWhitelistSource;
  tokenAddress?: string;
  wallet?: ITradingViewNativeHyperliquidWhitelistSource;
}

export interface ITradingViewNativeHyperliquidTokenIdentity {
  isNative?: boolean;
  networkId?: string;
  tokenAddress?: string;
}

const networkIdsMap = getNetworkIdsMap();

export const TRADING_VIEW_NATIVE_HYPERLIQUID_WHITELIST = {
  bnb: {
    isNative: true,
    market: { coin: 'BNB', type: 'hyperliquid' },
    networkId: networkIdsMap.bsc,
    swap: { coin: 'BNB', type: 'hyperliquid' },
    wallet: { coin: 'BNB', type: 'hyperliquid' },
  },
  btc: {
    isNative: true,
    market: { coin: 'BTC', type: 'hyperliquid' },
    networkId: networkIdsMap.btc,
    swap: { coin: 'BTC', type: 'hyperliquid' },
    wallet: { coin: 'BTC', type: 'hyperliquid' },
  },
  eth: {
    isNative: true,
    market: { coin: 'ETH', type: 'hyperliquid' },
    networkId: networkIdsMap.eth,
    swap: { coin: 'ETH', type: 'hyperliquid' },
    wallet: { coin: 'ETH', type: 'hyperliquid' },
  },
  hype: {
    isNative: true,
    networkId: networkIdsMap.hyperevm,
    swap: { coin: '@107', type: 'hyperliquid' },
  },
} as const satisfies Record<string, ITradingViewNativeHyperliquidWhitelistItem>;

export function getTradingViewNativeWhitelistedHyperliquidSource({
  branch,
  token,
}: {
  branch: ITradingViewNativeHyperliquidWhitelistBranch;
  token?: ITradingViewNativeHyperliquidTokenIdentity;
}): ITradingViewNativeHyperliquidWhitelistSource | undefined {
  if (!token?.networkId) {
    return undefined;
  }
  const normalizedTokenAddress = token.tokenAddress?.trim().toLowerCase();
  const whitelistItems: readonly ITradingViewNativeHyperliquidWhitelistItem[] =
    Object.values(TRADING_VIEW_NATIVE_HYPERLIQUID_WHITELIST);
  const item = whitelistItems.find((candidate) => {
    if (
      candidate.networkId !== token.networkId ||
      candidate.isNative !== Boolean(token.isNative)
    ) {
      return false;
    }
    if (candidate.isNative) {
      return true;
    }
    const normalizedWhitelistAddress = candidate.tokenAddress
      ?.trim()
      .toLowerCase();
    return Boolean(
      normalizedWhitelistAddress &&
      normalizedTokenAddress &&
      normalizedWhitelistAddress === normalizedTokenAddress,
    );
  });
  const source = item?.[branch];
  const coin = source?.coin.trim();
  return source && coin ? { ...source, coin } : undefined;
}
