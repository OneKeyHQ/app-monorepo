import type { IEarnAvailableAssetV2 } from '@onekeyhq/shared/types/earn';
import type { IEarnPortfolioPositionsResponse } from '@onekeyhq/shared/types/earn/portfolioPositions';

/** Pure helpers of useEarnPortfolioPositions: request planning and merging. */

export type IPositionsRequest = {
  key: string;
  accountId: string;
  accountAddress: string;
  networkId: string;
  provider: string;
  publicKey?: string;
};

type IEarnAccountParams = {
  networkId: string;
  accountAddress: string;
  publicKey?: string;
};

/**
 * One request per (account, network, provider) the wallet can hold on: the
 * scope of POST /earn/v1/portfolio/positions. Airdrop entries of the asset
 * list are ledger rewards, served by the Rewards tab's own endpoint.
 */
export function buildPositionsRequests({
  accountId,
  assets,
  accounts,
}: {
  accountId: string;
  assets: IEarnAvailableAssetV2[];
  accounts: IEarnAccountParams[];
}): IPositionsRequest[] {
  const requests = new Map<string, IPositionsRequest>();
  accounts.forEach((account) => {
    assets.forEach((asset) => {
      if (asset.type !== 'normal' || asset.networkId !== account.networkId) {
        return;
      }
      const key = [
        account.networkId,
        asset.provider,
        account.accountAddress,
        account.publicKey ?? '',
      ].join('_');
      if (requests.has(key)) {
        return;
      }
      requests.set(key, {
        key,
        accountId,
        accountAddress: account.accountAddress,
        networkId: account.networkId,
        provider: asset.provider,
        ...(account.publicKey ? { publicKey: account.publicKey } : {}),
      });
    });
  });
  return Array.from(requests.values());
}

export const EMPTY_POSITIONS_RESPONSE: IEarnPortfolioPositionsResponse = {
  positions: {},
  protocolSummaries: [],
  errors: [],
};

/** The per-scope responses as one wallet response, positions still keyed by network. */
export function mergePortfolioPositionsResponses(
  responses: IEarnPortfolioPositionsResponse[],
): IEarnPortfolioPositionsResponse {
  const merged: IEarnPortfolioPositionsResponse = {
    positions: {},
    protocolSummaries: [],
    errors: [],
  };
  responses.forEach((response) => {
    Object.entries(response.positions).forEach(([networkId, positions]) => {
      (merged.positions[networkId] ??= []).push(...positions);
    });
    merged.protocolSummaries.push(...response.protocolSummaries);
    merged.errors.push(...response.errors);
  });
  return merged;
}
