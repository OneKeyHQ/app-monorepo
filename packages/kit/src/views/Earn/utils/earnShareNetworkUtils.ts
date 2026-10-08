import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

// Slug used when a network cannot be named at all. It is not a valid route
// param: the detail page rejects it, so it only ever means "this link is
// broken" — keep it as the last resort, never as a normal path (OK-61675).
export const UNKNOWN_SHARE_NETWORK_NAME = 'unknown';

// The names Earn share links have used since the feature shipped. They stay
// canonical in both directions: links already shared point at these spellings,
// and generating the raw shortcode instead would change the URL of every
// network listed here (eth -> ethereum, sol -> solana, apt -> aptos,
// cosmoshub -> cosmos).
const getLegacyNameToNetworkIdMap = memoFn<Record<string, string>>(() => {
  const networkIdsMap = getNetworkIdsMap();
  return {
    ethereum: networkIdsMap.eth,
    btc: networkIdsMap.btc,
    sui: networkIdsMap.sui,
    solana: networkIdsMap.sol,
    aptos: networkIdsMap.apt,
    cosmos: networkIdsMap.cosmoshub,
    sbtc: networkIdsMap.sbtc,
    bsc: networkIdsMap.bsc,
    base: networkIdsMap.base,
  };
});

const getLegacyNetworkIdToNameMap = memoFn<Record<string, string>>(() =>
  Object.fromEntries(
    Object.entries(getLegacyNameToNetworkIdMap()).map(([name, id]) => [
      id,
      name,
    ]),
  ),
);

// Every preset network carries a shortcode, and getNetworkIdsMap() is already
// keyed by it. Falling back to it means a network added after the legacy list
// above (Katana, Arbitrum, ...) gets a working slug for free instead of
// generating /earn/unknown/... which nothing can resolve.
// Lower-cased on the way in and out: a handful of shortcodes are camelCase
// (assetHub, ksmAssetHub) and a URL segment must survive a round trip through
// anything that normalizes case.
const getNetworkIdToShortcodeSlugMap = memoFn<Record<string, string>>(() =>
  Object.fromEntries(
    Object.entries(getNetworkIdsMap()).map(([shortcode, id]) => [
      id,
      shortcode.toLowerCase(),
    ]),
  ),
);

const getShortcodeSlugToNetworkIdMap = memoFn<Record<string, string>>(() =>
  Object.fromEntries(
    Object.entries(getNetworkIdToShortcodeSlugMap()).map(([id, slug]) => [
      slug,
      id,
    ]),
  ),
);

/**
 * Resolve the network id behind a share-link `:network` segment.
 * Accepts, in order: the legacy names above, any preset network shortcode, and
 * a raw network id (hand-written links and links generated before the network
 * had a slug both carry one).
 */
export function getNetworkIdByShareName(
  networkName: string,
): string | undefined {
  if (!networkName) {
    return undefined;
  }
  const normalized = networkName.toLowerCase();
  const legacyNetworkId = getLegacyNameToNetworkIdMap()[normalized];
  if (legacyNetworkId) {
    return legacyNetworkId;
  }
  const shortcodeNetworkId = getShortcodeSlugToNetworkIdMap()[normalized];
  if (shortcodeNetworkId) {
    return shortcodeNetworkId;
  }
  return getNetworkIdToShortcodeSlugMap()[normalized] ? normalized : undefined;
}

/**
 * Reverse of {@link getNetworkIdByShareName}. Returns undefined only for a
 * network that is not preset at all.
 */
export function getShareNameByNetworkId(networkId: string): string | undefined {
  if (!networkId) {
    return undefined;
  }
  return (
    getLegacyNetworkIdToNameMap()[networkId] ??
    getNetworkIdToShortcodeSlugMap()[networkId]
  );
}

export function getShareNetworkParam(networkId: string): string {
  return getShareNameByNetworkId(networkId) ?? UNKNOWN_SHARE_NETWORK_NAME;
}
