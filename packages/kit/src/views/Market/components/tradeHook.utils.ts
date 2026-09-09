import type {
  IMarketDetailPlatform,
  IMarketDetailPlatformNetwork,
} from '@onekeyhq/shared/types/market';

/**
 * Picks the platform entry the market trade actions operate on.
 *
 * Market data describes a token once per CoinGecko platform, and an entry only
 * carries `onekeyNetworkId` when the market service has mapped that platform.
 * A caller that already knows which network the user came from (the
 * AssetDetails "Market" footer does) passes it as `preferredNetworkId`: the
 * matching entry wins, and when market data has no entry for that network at
 * all we trust the caller instead of guessing another chain — otherwise the
 * Earn/Swap handoffs bail out silently on a missing networkId. Katana vbUSDC
 * was the first token to hit this.
 *
 * Without a hint the original heuristic is kept as-is: native entry, then the
 * entry whose address matches the token's primary platform, then the first.
 */
export function resolveMarketTradeNetwork({
  detailPlatforms,
  platforms,
  preferredNetworkId,
}: {
  detailPlatforms?: IMarketDetailPlatform;
  platforms?: Record<string, string>;
  preferredNetworkId?: string;
}): IMarketDetailPlatformNetwork | undefined {
  const values = detailPlatforms ? Object.values(detailPlatforms) : [];

  if (preferredNetworkId) {
    const preferred = values.find(
      (platform) => platform.onekeyNetworkId === preferredNetworkId,
    );
    if (preferred) {
      return preferred;
    }
    return { contract_address: '', onekeyNetworkId: preferredNetworkId };
  }

  if (!detailPlatforms) {
    return undefined;
  }

  const nativePlatform = values.find((platform) => platform.isNative);
  if (nativePlatform) {
    return nativePlatform;
  }

  const tokenAddress = Object.values(platforms ?? {})[0];
  const tokenAddressPlatform = values.find(
    (platform) => platform.tokenAddress === tokenAddress,
  );
  return tokenAddressPlatform ?? values[0];
}
