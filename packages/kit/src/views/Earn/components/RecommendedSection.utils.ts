import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

export function shouldShowRecommendedBalance(
  token: Pick<IRecommendAsset, 'protocols'>,
) {
  const protocols = token.protocols ?? [];

  if (!protocols.length) {
    return true;
  }

  const networkIds = new Set<string>();

  for (const protocol of protocols) {
    const networkId = protocol.networkId?.trim();

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
