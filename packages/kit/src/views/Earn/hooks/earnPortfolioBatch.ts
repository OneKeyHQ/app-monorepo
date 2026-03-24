export type IPortfolioFetchRequest = {
  accountId: string;
  accountAddress: string;
  networkId: string;
  provider: string;
  symbol: string;
  publicKey?: string;
  vault?: string;
  ptAddress?: string;
};

export type IEarnPortfolioBatchTaskGroup = {
  provider: string;
  networkId: string;
  accountAddress: string;
  publicKey?: string;
  requestsByKey: Map<string, IPortfolioFetchRequest>;
  requestKeysBySymbol: Map<string, Set<string>>;
};

export const createEarnPortfolioRequestKey = (
  request: Pick<
    IPortfolioFetchRequest,
    'provider' | 'symbol' | 'vault' | 'networkId'
  >,
) =>
  `${request.provider}_${request.symbol}_${request.vault || ''}_${request.networkId}`;

export const shouldUseEarnPortfolioBatchFetch = ({
  enableBatch,
  ptAddress,
}: {
  enableBatch?: boolean;
  ptAddress?: string;
}) => Boolean(enableBatch && !ptAddress);

export const addRequestToEarnPortfolioBatchGroup = ({
  group,
  key,
  request,
}: {
  group: IEarnPortfolioBatchTaskGroup;
  key: string;
  request: IPortfolioFetchRequest;
}) => {
  group.requestsByKey.set(key, request);

  const existingKeys = group.requestKeysBySymbol.get(request.symbol);
  if (existingKeys) {
    existingKeys.add(key);
    return;
  }

  group.requestKeysBySymbol.set(request.symbol, new Set([key]));
};

export const matchEarnPortfolioBatchRequest = ({
  group,
  symbol,
  vault,
}: {
  group: IEarnPortfolioBatchTaskGroup;
  symbol: string;
  vault?: string;
}) => {
  const exactKey = createEarnPortfolioRequestKey({
    provider: group.provider,
    symbol,
    vault,
    networkId: group.networkId,
  });
  const exactRequest = group.requestsByKey.get(exactKey);
  if (exactRequest) {
    return exactRequest;
  }

  const symbolKeys = group.requestKeysBySymbol.get(symbol);
  if (symbolKeys?.size === 1) {
    const [matchedKey] = symbolKeys;
    if (matchedKey) {
      return group.requestsByKey.get(matchedKey);
    }
  }

  return undefined;
};

export const buildEarnPortfolioBatchGroups = ({
  requests,
}: {
  requests: IPortfolioFetchRequest[];
}) => {
  const initialGroups = new Map<string, IEarnPortfolioBatchTaskGroup>();
  const singleRequests: IPortfolioFetchRequest[] = [];

  requests.forEach((request) => {
    const key = createEarnPortfolioRequestKey(request);
    const groupKey = [
      request.provider,
      request.networkId,
      request.accountAddress,
      request.publicKey || '',
    ].join('_');

    const existingGroup = initialGroups.get(groupKey);
    if (existingGroup) {
      addRequestToEarnPortfolioBatchGroup({
        group: existingGroup,
        key,
        request,
      });
      return;
    }

    const nextGroup: IEarnPortfolioBatchTaskGroup = {
      provider: request.provider,
      networkId: request.networkId,
      accountAddress: request.accountAddress,
      publicKey: request.publicKey,
      requestsByKey: new Map(),
      requestKeysBySymbol: new Map(),
    };
    addRequestToEarnPortfolioBatchGroup({
      group: nextGroup,
      key,
      request,
    });
    initialGroups.set(groupKey, nextGroup);
  });

  const batchGroups: IEarnPortfolioBatchTaskGroup[] = [];
  initialGroups.forEach((group) => {
    const eligibleBatchGroup: IEarnPortfolioBatchTaskGroup = {
      ...group,
      requestsByKey: new Map(),
      requestKeysBySymbol: new Map(),
    };

    group.requestsByKey.forEach((request, key) => {
      const requestKeysForSymbol = group.requestKeysBySymbol.get(
        request.symbol,
      );
      if ((requestKeysForSymbol?.size || 0) > 1) {
        singleRequests.push(request);
        return;
      }

      addRequestToEarnPortfolioBatchGroup({
        group: eligibleBatchGroup,
        key,
        request,
      });
    });

    if (eligibleBatchGroup.requestsByKey.size > 0) {
      batchGroups.push(eligibleBatchGroup);
    }
  });

  return {
    batchGroups,
    singleRequests,
  };
};
