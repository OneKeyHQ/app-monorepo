import type {
  IMarketDetailPlatform,
  IMarketDetailPlatformNetwork,
  IMarketPreferredToken,
} from '@onekeyhq/shared/types/market';

/**
 * Picks the platform entry the market trade actions operate on.
 *
 * Market data describes a token once per CoinGecko platform, and an entry only
 * carries `onekeyNetworkId` when the market service has mapped that platform.
 * A caller that already knows which asset the user came from (the
 * AssetDetails "Market" footer does) passes it as `preferredToken`: the
 * entry mapped to that network wins, and when market data has no entry for
 * that network at all we rebuild one from the caller's identity instead of
 * guessing another chain — otherwise the Earn/Swap handoffs either bail out
 * silently on a missing networkId or, worse, open Swap on a token with no
 * contract address. Katana vbUSDC was the first token to hit this.
 *
 * Without a hint the original heuristic is kept as-is: native entry, then the
 * entry whose address matches the token's primary platform, then the first.
 */
export function resolveMarketTradeNetwork({
  detailPlatforms,
  platforms,
  preferredToken,
}: {
  detailPlatforms?: IMarketDetailPlatform;
  platforms?: Record<string, string>;
  preferredToken?: IMarketPreferredToken;
}): IMarketDetailPlatformNetwork | undefined {
  const values = detailPlatforms ? Object.values(detailPlatforms) : [];

  if (preferredToken) {
    const preferred = values.find(
      (platform) => platform.onekeyNetworkId === preferredToken.networkId,
    );
    if (preferred) {
      return preferred;
    }
    return {
      contract_address: preferredToken.tokenAddress,
      tokenAddress: preferredToken.tokenAddress,
      onekeyNetworkId: preferredToken.networkId,
      ...(preferredToken.isNative ? { isNative: true as const } : {}),
    };
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
