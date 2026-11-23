import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

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
) => {
  const vault = networkUtils.isEvmNetwork({ networkId: request.networkId })
    ? normalizeTokenContractAddress({
        networkId: request.networkId,
        contractAddress: request.vault,
      })
    : request.vault;
  // EtherFi deposit assets share a single position per vault.
  const isEtherFi = request.provider.toLowerCase() === 'etherfi';
  const symbol = isEtherFi && vault ? '' : request.symbol;
  const provider = isEtherFi ? 'etherfi' : request.provider;
  return `${provider}_${symbol}_${vault || ''}_${request.networkId}`;
};

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
  symbolIsAuthoritative = true,
}: {
  group: IEarnPortfolioBatchTaskGroup;
  symbol: string;
  vault?: string;
  symbolIsAuthoritative?: boolean;
}) => {
  if (!symbolIsAuthoritative && !vault) {
    return undefined;
  }
  if (vault && !symbolIsAuthoritative) {
    const vaultKey = createEarnPortfolioRequestKey({
      provider: group.provider,
      symbol: '',
      vault,
      networkId: group.networkId,
    });
    const candidates = Array.from(group.requestsByKey.values()).filter(
      (request) =>
        request.vault &&
        createEarnPortfolioRequestKey({ ...request, symbol: '' }) === vaultKey,
    );
    return candidates.length === 1 ? candidates[0] : undefined;
  }
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

  // A returned vault is authoritative; never assign a different vault's result.
  if (vault) {
    return undefined;
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
  const groups = new Map<string, IEarnPortfolioBatchTaskGroup>();

  requests.forEach((request) => {
    const key = createEarnPortfolioRequestKey(request);
    const groupKey = [
      request.provider,
      request.networkId,
      request.accountAddress,
      request.publicKey || '',
    ].join('_');

    const existingGroup = groups.get(groupKey);
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
    groups.set(groupKey, nextGroup);
  });

  return {
    batchGroups: Array.from(groups.values()),
  };
};
