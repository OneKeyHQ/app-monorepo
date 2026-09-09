import type { IEarnAvailableAssetAprInfo } from '@onekeyhq/shared/types/earn';

export function getProtocolAprColor(
  aprInfo?: IEarnAvailableAssetAprInfo,
): NonNullable<IEarnAvailableAssetAprInfo['normal']>['color'] | undefined {
  if (aprInfo?.highlight?.text) {
    return aprInfo.highlight.color;
  }

  if (aprInfo?.normal?.text) {
    return aprInfo.normal.color;
  }

  if (aprInfo?.deprecated?.text) {
    return aprInfo.deprecated.color;
  }

  return undefined;
}

export function shouldShowProtocolListBalances(
  protocols: Array<{ network?: { networkId?: string } }>,
) {
  if (!protocols.length) {
    return true;
  }

  const networkIds = new Set<string>();

  for (const protocol of protocols) {
    const networkId = protocol.network?.networkId?.trim();

    if (!networkId) {
      return true;
    }

    networkIds.add(networkId);

    if (networkIds.size > 1) {
      return true;
    }
  }

  return false;
}
