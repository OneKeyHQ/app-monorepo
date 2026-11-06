import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { debounce, throttle } from 'lodash';
import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { earnTestnetNetworkIds } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type {
  IEarnAirdropInvestmentItemV2,
  IEarnInvestmentItemV2,
  IEarnPortfolioClaimSymbolStatus,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
  useEarnPortfolioInvestmentsAtom,
} from '../../../states/jotai/contexts/earn';
import { useCommittedEarnScopeGuard } from '../../Staking/hooks/useCommittedEarnScopeGuard';
import {
  earnPortfolioDataScope,
  getScopedPortfolioEarnAccount,
} from '../utils/portfolioAccountScope';
import {
  buildPortfolioClaimSymbolMap,
  getPortfolioProtocolIdentityKey,
} from '../utils/portfolioClaimUtils';

import {
  buildEarnPortfolioBatchGroups,
  createEarnPortfolioRequestKey,
  matchEarnPortfolioBatchRequest,
  shouldUseEarnPortfolioBatchFetch,
} from './earnPortfolioBatch';
import {
  type IEarnPortfolioInvestmentFetchResult,
  applyEarnPortfolioFetchResult,
  mergeEarnPortfolioInvestments,
  removeEarnPortfolioInvestmentSource,
} from './earnPortfolioInvestmentMerge';
import { useEarnAccountKey } from './useEarnAccountKey';

import type { IPortfolioFetchRequest } from './earnPortfolioBatch';

// ============================================================================
// Types
// ============================================================================

export interface IRefreshOptions {
  provider?: string;
  networkId?: string;
  symbol?: string;
  rewardSymbol?: string;
}

interface IAccountAssetPair {
  isAirdrop: boolean;
  claimSymbol?: string;
  claimSymbolStatus?: IEarnPortfolioClaimSymbolStatus;
  enableBatch?: boolean;
  params: IPortfolioFetchRequest;
}

// ============================================================================
// Pure Utility Functions
// ============================================================================

const resolveVault = ({
  protocolVault,
  requestVault,
}: {
  protocolVault?: string;
  requestVault?: string;
}) => protocolVault || requestVault;

const hasPositiveFiatValue = (value: string | undefined): boolean =>
  new BigNumber(value || '0').gt(0);

const isEarnTestnetNetwork = (networkId: string): boolean =>
  earnTestnetNetworkIds.includes(networkId);

const hasAnyAssets = (
  assets: Array<{
    assetsStatus?: Array<{ title: { text: string } }>;
    rewardAssets?: Array<{ title: { text: string } }>;
  }>,
): boolean =>
  assets.length > 0 &&
  assets.some(
    (asset) =>
      (asset.assetsStatus && asset.assetsStatus.length > 0) ||
      (asset.rewardAssets && asset.rewardAssets.length > 0),
  );

const hasAnyAirdropAssets = (
  assets: Array<{
    airdropAssets?: Array<{ title: { text: string } }>;
  }>,
): boolean =>
  assets.length > 0 &&
  assets.some((asset) => asset.airdropAssets && asset.airdropAssets.length > 0);

const sortByFiatValueDesc = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] =>
  investments.toSorted((a, b) => {
    const valueA = new BigNumber(a.totalFiatValue || '0');
    const valueB = new BigNumber(b.totalFiatValue || '0');
    return valueB.comparedTo(valueA);
  });

const filterValidInvestments = (
  values: Iterable<IEarnPortfolioInvestment>,
): IEarnPortfolioInvestment[] =>
  Array.from(values).filter((inv) => {
    if (hasAnyAirdropAssets(inv.airdropAssets)) return true;
    if (isEarnTestnetNetwork(inv.network.networkId)) {
      return hasAnyAssets(inv.assets);
    }
    return hasPositiveFiatValue(inv.totalFiatValue);
  });

const createInvestmentKeyFromInvestment = (
  investment: IEarnPortfolioInvestment,
): string => {
  const firstAsset = investment.assets[0] || investment.airdropAssets[0];
  const resolvedVault = resolveVault({
    protocolVault: investment.protocol.vault,
    requestVault: firstAsset?.metadata?.protocol?.vault,
  });
  return createEarnPortfolioRequestKey({
    provider: investment.protocol.providerDetail.code,
    symbol: investment.protocol.symbol || firstAsset?.token.info.symbol || '',
    vault: resolvedVault,
    networkId: investment.network.networkId,
  });
};

const buildInvestmentMapFromList = (
  investments: IEarnPortfolioInvestment[],
): Map<string, IEarnPortfolioInvestment> =>
  new Map(
    investments.map((inv) => [createInvestmentKeyFromInvestment(inv), inv]),
  );

const calculateTotalFiatValue = (
  investments: IEarnPortfolioInvestment[],
): BigNumber =>
  investments.reduce((sum, inv) => {
    if (inv.assets.length === 0 && inv.airdropAssets.length > 0) {
      return sum;
    }
    return sum.plus(new BigNumber(inv.totalFiatValue || '0'));
  }, new BigNumber(0));

const calculateTotalEarnings24hValue = (
  investments: IEarnPortfolioInvestment[],
): BigNumber =>
  investments.reduce((sum, inv) => {
    if (inv.assets.length === 0 && inv.airdropAssets.length > 0) {
      return sum;
    }
    return sum.plus(new BigNumber(inv.earnings24hFiatValue || '0'));
  }, new BigNumber(0));

const aggregateByProtocol = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] => {
  const protocolMap = investments.reduce((map, investment) => {
    const protocolKey = investment.protocol.providerDetail.code;
    const existing = map.get(protocolKey);

    if (existing) {
      map.set(protocolKey, mergeEarnPortfolioInvestments(existing, investment));
    } else {
      map.set(protocolKey, { ...investment });
    }

    return map;
  }, new Map<string, IEarnPortfolioInvestment>());

  return sortByFiatValueDesc(Array.from(protocolMap.values()));
};

// ============================================================================
// Investment Fetching
// ============================================================================

function normalizeAirdropInvestmentResult(
  params: Pick<IPortfolioFetchRequest, 'symbol' | 'vault'>,
  result: IEarnAirdropInvestmentItemV2,
  claimSymbol?: string,
  claimSymbolStatus?: IEarnPortfolioClaimSymbolStatus,
): IEarnPortfolioInvestmentFetchResult {
  const resolvedVault = result.protocol.vault || params.vault;
  const normalizedProtocol = {
    ...result.protocol,
    symbol: params.symbol,
    ...(claimSymbol ? { claimSymbol } : {}),
    ...(claimSymbolStatus ? { claimSymbolStatus } : {}),
    ...(resolvedVault ? { vault: resolvedVault } : {}),
  };

  const key = createEarnPortfolioRequestKey({
    provider: result.protocol.providerDetail.code,
    symbol: params.symbol,
    vault: resolvedVault,
    networkId: result.network.networkId,
  });

  const enrichedAirdropAssets = result.assets.map((asset) => ({
    ...asset,
    metadata: {
      protocol: normalizedProtocol,
      network: result.network,
    },
  }));

  return {
    key,
    source: 'airdrop',
    investment: {
      totalFiatValue: '0',
      totalFiatValueUsd: '0',
      earnings24hFiatValue: '0',
      // Kept on its own field: the phone positions page sums it into the
      // Rewards header while totalFiatValue stays principal-only.
      airdropFiatValue: result.totalFiatValue,
      protocol: normalizedProtocol,
      network: result.network,
      assets: [],
      airdropAssets: enrichedAirdropAssets,
    },
  };
}

function normalizeInvestmentResult(
  params: Pick<IPortfolioFetchRequest, 'symbol' | 'vault'>,
  result: IEarnInvestmentItemV2,
): IEarnPortfolioInvestmentFetchResult {
  const resolvedProtocolVault = resolveVault({
    protocolVault: result.protocol.vault,
    // Use request vault as fallback (Pendle PT market address).
    requestVault: params.vault,
  });
  const { positionSymbol, assetSymbol } = getEarnProtocol(
    result.protocol.providerDetail.code,
  ).resolvePortfolioSymbols({
    requestSymbol: params.symbol,
    responseSymbol: result.protocol.symbol,
  });
  const normalizedProtocol = {
    ...result.protocol,
    ...(resolvedProtocolVault ? { vault: resolvedProtocolVault } : {}),
    symbol: positionSymbol,
  };

  const key = createEarnPortfolioRequestKey({
    provider: result.protocol.providerDetail.code,
    symbol: params.symbol,
    vault: resolvedProtocolVault,
    networkId: result.network.networkId,
  });

  const shouldRemove = isEarnTestnetNetwork(result.network.networkId)
    ? !hasAnyAssets(result.assets)
    : !hasPositiveFiatValue(result.totalFiatValue);

  if (shouldRemove) {
    return { key, source: 'normal', remove: true };
  }

  const enrichedAssets = result.assets.map((asset) => {
    const resolvedAssetVault = resolveVault({
      protocolVault: result.protocol.vault,
      requestVault: params.vault,
    });
    const assetProtocol =
      assetSymbol === normalizedProtocol.symbol
        ? normalizedProtocol
        : { ...result.protocol, symbol: assetSymbol };
    return {
      ...asset,
      metadata: {
        protocol: resolvedAssetVault
          ? { ...assetProtocol, vault: resolvedAssetVault }
          : assetProtocol,
        network: result.network,
        fiatValue: result.totalFiatValue,
        fiatValueUsd: result.totalFiatValueUsd,
        netPnl: result.netPnl,
        netPnlFiatValue: result.netPnlFiatValue,
      },
    };
  });

  return {
    key,
    source: 'normal',
    investment: {
      totalFiatValue: result.totalFiatValue,
      totalFiatValueUsd: result.totalFiatValueUsd,
      earnings24hFiatValue: result.earnings24hFiatValue,
      ...(result.rewardsFiatValue !== undefined
        ? { rewardsFiatValue: result.rewardsFiatValue }
        : {}),
      netPnl: result.netPnl,
      netPnlFiatValue: result.netPnlFiatValue,
      protocol: normalizedProtocol,
      network: result.network,
      assets: enrichedAssets,
      airdropAssets: [],
    },
  };
}

async function fetchSingleInvestment(
  params: IPortfolioFetchRequest,
  isAirdrop: boolean,
  claimSymbol?: string,
  claimSymbolStatus?: IEarnPortfolioClaimSymbolStatus,
): Promise<IEarnPortfolioInvestmentFetchResult | null> {
  if (isAirdrop) {
    const result =
      await backgroundApiProxy.serviceStaking.fetchAirdropInvestmentDetail(
        params,
      );

    return normalizeAirdropInvestmentResult(
      params,
      result,
      claimSymbol,
      claimSymbolStatus,
    );
  }

  const result =
    await backgroundApiProxy.serviceStaking.fetchInvestmentDetailV2(params);

  return normalizeInvestmentResult(params, result);
}

// ============================================================================
// Custom Hooks
// ============================================================================

interface IInvestmentStateOptions {
  initialInvestments?: IEarnPortfolioInvestment[];
  initialTotalFiatValue?: string;
  initialTotalEarnings24hFiatValue?: string;
}

function useInvestmentState(options: IInvestmentStateOptions = {}) {
  const {
    initialInvestments,
    initialTotalFiatValue,
    initialTotalEarnings24hFiatValue,
  } = options;

  const [investments, setInvestments] = useState<IEarnPortfolioInvestment[]>(
    () => initialInvestments ?? [],
  );
  const [earnTotalFiatValue, setEarnTotalFiatValue] = useState<BigNumber>(
    () => new BigNumber(initialTotalFiatValue || 0),
  );
  const [earnTotalEarnings24hFiatValue, setEarnTotalEarnings24hFiatValue] =
    useState<BigNumber>(
      () => new BigNumber(initialTotalEarnings24hFiatValue || 0),
    );

  const investmentMapRef = useRef<Map<string, IEarnPortfolioInvestment>>(
    initialInvestments && initialInvestments.length > 0
      ? buildInvestmentMapFromList(initialInvestments)
      : new Map(),
  );

  const updateInvestments = useCallback(
    (
      newMap: Map<string, IEarnPortfolioInvestment>,
      shouldUpdateTotals = true,
    ): IEarnPortfolioInvestment[] => {
      const validInvestments = filterValidInvestments(newMap.values());
      const sorted = sortByFiatValueDesc(validInvestments);
      setInvestments(sorted);

      if (shouldUpdateTotals) {
        setEarnTotalFiatValue(calculateTotalFiatValue(sorted));
        setEarnTotalEarnings24hFiatValue(
          calculateTotalEarnings24hValue(sorted),
        );
      }

      return sorted;
    },
    [],
  );

  const clearInvestments = useCallback(() => {
    investmentMapRef.current.clear();
    setInvestments([]);
    setEarnTotalFiatValue(new BigNumber(0));
    setEarnTotalEarnings24hFiatValue(new BigNumber(0));
  }, []);

  return {
    investments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    investmentMapRef,
    updateInvestments,
    clearInvestments,
  };
}

interface IPortfolioRequest {
  sequence: number;
  isCurrent: () => boolean;
}

interface IRequestControllerState {
  scope: string;
  sequence: number;
  latestFullSequence: number;
  isLoadingNewAccount: boolean;
}

function useRequestController(scope: string) {
  const scopeGuard = useCommittedEarnScopeGuard(scope);
  const stateRef = useRef<IRequestControllerState>({
    scope,
    sequence: 0,
    latestFullSequence: 0,
    isLoadingNewAccount: true,
  });

  const hasAccountChanged = useCallback(
    () => stateRef.current.scope !== scope,
    [scope],
  );

  const startNewRequest = useCallback(
    (isAccountChange = false, isFull = true): IPortfolioRequest => {
      const state = stateRef.current;
      state.scope = scope;
      state.sequence += 1;
      if (isFull) state.latestFullSequence = state.sequence;
      if (isAccountChange) state.isLoadingNewAccount = true;
      return { sequence: state.sequence, isCurrent: scopeGuard.capture() };
    },
    [scope, scopeGuard],
  );
  const isRequestStale = useCallback(
    (request: IPortfolioRequest) => !request.isCurrent(),
    [],
  );
  const isLatestFull = useCallback(
    (request: IPortfolioRequest) =>
      request.isCurrent() &&
      request.sequence === stateRef.current.latestFullSequence,
    [],
  );
  const isScopeCurrent = scopeGuard.isCurrent;
  const finishLoadingNewAccount = useCallback(() => {
    stateRef.current.isLoadingNewAccount = false;
  }, []);
  const isLoadingNewAccount = useCallback(
    () => stateRef.current.isLoadingNewAccount,
    [],
  );

  return {
    hasAccountChanged,
    startNewRequest,
    isRequestStale,
    isLatestFull,
    isScopeCurrent,
    finishLoadingNewAccount,
    isLoadingNewAccount,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export interface IUseEarnPortfolioReturn {
  investments: IEarnPortfolioInvestment[];
  earnTotalFiatValue: BigNumber;
  earnTotalEarnings24hFiatValue: BigNumber;
  cachedOverviewTotalFiatValue: string | undefined;
  cachedOverviewEarnings24h: string | undefined;
  isLoading: boolean;
  refresh: (options?: IRefreshOptions) => Promise<void>;
}

export const useEarnPortfolio = ({
  isActive = true,
}: {
  isActive?: boolean;
} = {}): IUseEarnPortfolioReturn => {
  const isMountedRef = useRef(true);
  const isSyncingAtomRef = useRef(false);

  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  const allNetworkId = getNetworkIdsMap().onekeyall;
  const accountIdValue = account?.id ?? '';
  const indexedAccountIdValue = indexedAccount?.id ?? '';
  const accountIndexedAccountIdValue = account?.indexedAccountId;

  const actions = useEarnActions();
  const [{ earnAccount }] = useEarnAtom();
  const [portfolioCache, setPortfolioCache] = useEarnPortfolioInvestmentsAtom();
  const earnAccountKey = useEarnAccountKey();
  const accountScope = earnPortfolioDataScope({
    earnAccountKey,
    account,
    indexedAccountId: indexedAccount?.id,
  });
  const committedPortfolioScopeRef = useRef(accountScope);
  useLayoutEffect(() => {
    committedPortfolioScopeRef.current = accountScope;
  }, [accountScope]);

  const storedOverviewData =
    earnAccountKey && earnAccount ? earnAccount[earnAccountKey] : undefined;
  const currentOverviewData = getScopedPortfolioEarnAccount(
    storedOverviewData,
    accountScope,
  );

  const cachedInvestments = useMemo(() => {
    if (!earnAccountKey) return undefined;
    const entry = portfolioCache[earnAccountKey];
    return entry?.accountScope === accountScope ? entry.investments : undefined;
  }, [portfolioCache, earnAccountKey, accountScope]);
  const [displayScope, setDisplayScope] = useState(accountScope);

  const [isLoading, setIsLoading] = useState(
    () => !(cachedInvestments && cachedInvestments.length > 0),
  );

  const {
    investments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    investmentMapRef,
    updateInvestments,
    clearInvestments,
  } = useInvestmentState({
    initialInvestments: cachedInvestments,
    initialTotalFiatValue: currentOverviewData?.totalFiatValue,
    initialTotalEarnings24hFiatValue: currentOverviewData?.earnings24h,
  });

  const {
    hasAccountChanged,
    startNewRequest,
    isRequestStale,
    isLatestFull,
    isScopeCurrent,
    finishLoadingNewAccount,
    isLoadingNewAccount,
  } = useRequestController(accountScope);

  const lastSyncedValuesRef = useRef({ totalFiatValue: '', earnings24h: '' });
  const sourceVersionsRef = useRef(new Map<string, number>());
  const metadataVersionRef = useRef(0);
  const hasSettledSnapshotRef = useRef(cachedInvestments !== undefined);
  const latestFullKeysRef = useRef<
    | {
        sequence: number;
        normal: Set<string>;
        airdrop: Set<string>;
      }
    | undefined
  >(undefined);
  const isScopeCurrentRef = useRef(isScopeCurrent);
  useLayoutEffect(() => {
    isScopeCurrentRef.current = isScopeCurrent;
  }, [isScopeCurrent]);

  // Throttled UI update for progressive loading
  const throttledUIUpdate = useMemo(
    () =>
      throttle(
        () => {
          if (isScopeCurrentRef.current()) {
            updateInvestments(new Map(investmentMapRef.current), false);
          }
        },
        500,
        { leading: true, trailing: true },
      ),
    [investmentMapRef, updateInvestments],
  );

  useLayoutEffect(() => {
    throttledUIUpdate.cancel();
  }, [accountScope, throttledUIUpdate]);

  // Handle account changes
  useEffect(() => {
    if (hasAccountChanged()) {
      clearInvestments();
      throttledUIUpdate.cancel();
      setDisplayScope(accountScope);
      lastSyncedValuesRef.current = { totalFiatValue: '', earnings24h: '' };
      sourceVersionsRef.current.clear();
      metadataVersionRef.current = 0;
      hasSettledSnapshotRef.current = false;
      latestFullKeysRef.current = undefined;
      startNewRequest(true);
      setIsLoading(true);
    }
  }, [
    hasAccountChanged,
    clearInvestments,
    throttledUIUpdate,
    startNewRequest,
    accountScope,
  ]);

  // Main fetch function
  const fetchAndUpdateInvestments = useCallback(
    async (options?: IRefreshOptions) => {
      if (!isActive || !isMountedRef.current || !isScopeCurrent()) return;

      const isPartialRefresh = Boolean(options);
      const requestId = startNewRequest(hasAccountChanged(), !isPartialRefresh);

      if (!accountIdValue && !indexedAccountIdValue) {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        return;
      }

      if (!isPartialRefresh && isMountedRef.current) {
        setIsLoading(true);
      }

      try {
        const [assets, accounts] = await Promise.all([
          backgroundApiProxy.serviceStaking.getAvailableAssetsV2(),
          backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams({
            accountId: accountIdValue,
            networkId: allNetworkId,
            indexedAccountId:
              accountIndexedAccountIdValue || indexedAccountIdValue,
          }),
        ]);

        if (isRequestStale(requestId) || !isMountedRef.current) return;

        // Update earn accounts in global state
        if (
          earnAccountKey &&
          requestId.sequence >= metadataVersionRef.current
        ) {
          metadataVersionRef.current = requestId.sequence;
          const normalizedAccounts = accounts.map((accountItem) => ({
            tokens: [],
            networkId: accountItem.networkId,
            accountAddress: accountItem.accountAddress,
            publicKey: accountItem.publicKey,
          }));
          const previousAccountData =
            actions.current.getEarnAccount(earnAccountKey);
          actions.current.updateEarnAccounts({
            key: earnAccountKey,
            earnAccount: {
              ...previousAccountData,
              ...(previousAccountData?.portfolioAccountScope !== accountScope
                ? { totalFiatValue: undefined, earnings24h: undefined }
                : {}),
              portfolioAccountScope: accountScope,
              accounts: normalizedAccounts,
              isOverviewLoaded: true,
            },
          });
        }

        const claimSymbolMap = buildPortfolioClaimSymbolMap(assets);

        // Build account-asset pairs
        const accountAssetPairs: IAccountAssetPair[] = accounts.flatMap(
          (accountItem) =>
            assets
              .filter((asset) => asset.networkId === accountItem.networkId)
              .map((asset) => {
                const isAirdrop = asset.type === 'airdrop';
                const claimSymbolMatch = isAirdrop
                  ? claimSymbolMap.get(getPortfolioProtocolIdentityKey(asset))
                  : undefined;
                const claimSymbol =
                  claimSymbolMatch?.status === 'matched'
                    ? claimSymbolMatch.symbol
                    : undefined;
                const claimSymbolStatus = isAirdrop
                  ? claimSymbolMatch?.status || 'unmatched'
                  : undefined;

                return {
                  isAirdrop,
                  claimSymbol,
                  claimSymbolStatus,
                  enableBatch: asset.enableBatch,
                  params: {
                    accountId: accountIdValue || '',
                    accountAddress: accountItem.accountAddress,
                    networkId: accountItem.networkId,
                    provider: asset.provider,
                    symbol: asset.symbol,
                    ...(asset.vault && { vault: asset.vault }),
                    ...(asset.ptAddress && { ptAddress: asset.ptAddress }),
                    ...(accountItem.publicKey && {
                      publicKey: accountItem.publicKey,
                    }),
                  },
                };
              }),
        );

        // Filter pairs based on refresh options
        const pairsToFetch = options
          ? accountAssetPairs.filter((pair) => {
              const { params, isAirdrop } = pair;
              if (options.provider && params.provider !== options.provider)
                return false;
              if (options.networkId && params.networkId !== options.networkId)
                return false;
              if (options.symbol) {
                if (isAirdrop) {
                  if (
                    options.rewardSymbol &&
                    params.symbol !== options.rewardSymbol
                  ) {
                    return false;
                  }
                } else if (params.symbol !== options.symbol) {
                  return false;
                }
              }
              return true;
            })
          : accountAssetPairs;

        const normalKeysToFetch = new Set<string>();
        const airdropKeysToFetch = new Set<string>();
        const normalKeysUpdatedInThisSession = new Set<string>();
        const airdropKeysUpdatedInThisSession = new Set<string>();
        const normalKeysFailedInThisSession = new Set<string>();
        const airdropKeysFailedInThisSession = new Set<string>();
        const limit = pLimit(6);

        const singlePairs: IAccountAssetPair[] = [];
        const batchCandidateRequests: IPortfolioFetchRequest[] = [];

        pairsToFetch.forEach((pair) => {
          const requestKey = createEarnPortfolioRequestKey(pair.params);
          if (pair.isAirdrop) {
            airdropKeysToFetch.add(requestKey);
            singlePairs.push(pair);
            return;
          }

          normalKeysToFetch.add(requestKey);
          if (
            shouldUseEarnPortfolioBatchFetch({
              enableBatch: pair.enableBatch,
              ptAddress: pair.params.ptAddress,
            })
          ) {
            batchCandidateRequests.push(pair.params);
            return;
          }

          singlePairs.push(pair);
        });

        const { batchGroups } = buildEarnPortfolioBatchGroups({
          requests: batchCandidateRequests,
        });

        const applyResult = (result: IEarnPortfolioInvestmentFetchResult) => {
          const latestFull = latestFullKeysRef.current;
          if (
            latestFull &&
            latestFull.sequence > requestId.sequence &&
            !latestFull[result.source].has(result.key)
          )
            return;
          const versionKey = JSON.stringify([result.key, result.source]);
          const lastVersion = sourceVersionsRef.current.get(versionKey) ?? 0;
          if (lastVersion > requestId.sequence) return;
          const requestMap = new Map(investmentMapRef.current);
          const shouldPreserveAirdrop = result.source === 'normal';

          const didUpdate = applyEarnPortfolioFetchResult({
            requestMap,
            result,
            normalKeysUpdatedInSession: normalKeysUpdatedInThisSession,
            airdropKeysUpdatedInSession: airdropKeysUpdatedInThisSession,
            preserveExistingAirdropOnNormalUpdate: shouldPreserveAirdrop,
            preserveAirdropOnNormalRemove: shouldPreserveAirdrop,
          });

          if (!didUpdate) {
            return;
          }

          sourceVersionsRef.current.set(versionKey, requestId.sequence);
          investmentMapRef.current = requestMap;
          if (isMountedRef.current) {
            throttledUIUpdate();
          }
        };

        const tasks = [
          ...singlePairs.map((pair) =>
            limit(async () => {
              if (isRequestStale(requestId) || !isMountedRef.current) return;

              const { params, isAirdrop, claimSymbol, claimSymbolStatus } =
                pair;
              let result: IEarnPortfolioInvestmentFetchResult | null = null;
              try {
                result = await fetchSingleInvestment(
                  params,
                  isAirdrop,
                  claimSymbol,
                  claimSymbolStatus,
                );
              } catch (error) {
                const failedKey = createEarnPortfolioRequestKey(params);
                if (isAirdrop) {
                  airdropKeysFailedInThisSession.add(failedKey);
                } else {
                  normalKeysFailedInThisSession.add(failedKey);
                }
                console.warn(
                  `[useEarnPortfolio] Failed to fetch investment for ${params.provider}/${params.symbol}:`,
                  error,
                );
                return;
              }

              if (
                isRequestStale(requestId) ||
                !isMountedRef.current ||
                !result
              ) {
                return;
              }

              // Skip outdated account responses
              if (params.accountId && params.accountId !== accountIdValue) {
                return;
              }

              applyResult(result);
            }),
          ),
          ...batchGroups.map((group) =>
            limit(async () => {
              if (isRequestStale(requestId) || !isMountedRef.current) return;

              let response: Awaited<
                ReturnType<
                  typeof backgroundApiProxy.serviceStaking.fetchInvestmentBatchDetail
                >
              >;

              try {
                response =
                  await backgroundApiProxy.serviceStaking.fetchInvestmentBatchDetail(
                    {
                      accountId: accountIdValue || '',
                      accountAddress: group.accountAddress,
                      networkId: group.networkId,
                      provider: group.provider,
                      publicKey: group.publicKey,
                    },
                  );
              } catch (error) {
                group.requestsByKey.forEach((_request, key) => {
                  normalKeysFailedInThisSession.add(key);
                });
                console.warn(
                  `[useEarnPortfolio] Failed to batch fetch investments for ${group.provider}/${group.networkId}:`,
                  error,
                );
                return;
              }

              if (isRequestStale(requestId) || !isMountedRef.current) {
                return;
              }

              const portfolioProtocol = getEarnProtocol(group.provider);
              const resolvedKeys = new Set<string>();
              let hasUnidentifiedItem = false;
              response.items.forEach((item) => {
                const matchedRequest = matchEarnPortfolioBatchRequest({
                  group,
                  symbol:
                    item.protocol.symbol ||
                    item.assets[0]?.token.info.symbol ||
                    '',
                  vault: item.protocol.vault,
                  symbolIsAuthoritative: Boolean(item.protocol.symbol?.trim()),
                });

                if (
                  !matchedRequest ||
                  (matchedRequest.accountId &&
                    matchedRequest.accountId !== accountIdValue)
                ) {
                  if (!item.protocol.vault) hasUnidentifiedItem = true;
                  return;
                }

                if (
                  portfolioProtocol.shouldPreserveUnsettledPortfolioValue(
                    item.totalFiatValue || '0',
                  )
                ) {
                  const key = createEarnPortfolioRequestKey(matchedRequest);
                  resolvedKeys.add(key);
                  normalKeysFailedInThisSession.add(key);
                  return;
                }

                applyResult(normalizeInvestmentResult(matchedRequest, item));
                resolvedKeys.add(createEarnPortfolioRequestKey(matchedRequest));
              });

              const failedKeys = new Set<string>();
              let hasUnidentifiedError = false;
              response.errors.forEach((error) => {
                const request = matchEarnPortfolioBatchRequest({
                  group,
                  symbol: error.symbol,
                  vault: error.vault,
                });
                if (request) {
                  failedKeys.add(createEarnPortfolioRequestKey(request));
                } else if (!error.vault) {
                  hasUnidentifiedError = true;
                }
              });
              group.requestsByKey.forEach((request, key) => {
                if (!resolvedKeys.has(key)) {
                  if (
                    portfolioProtocol.removeConfirmedMissingPortfolioVault() &&
                    request.vault &&
                    !failedKeys.has(key) &&
                    !hasUnidentifiedError &&
                    !hasUnidentifiedItem
                  ) {
                    applyResult({ key, source: 'normal', remove: true });
                  } else {
                    normalKeysFailedInThisSession.add(key);
                  }
                }
              });
            }),
          ),
        ];

        await Promise.all(tasks);

        if (!isRequestStale(requestId) && isMountedRef.current) {
          throttledUIUpdate.flush();

          const requestMap = new Map(investmentMapRef.current);
          if (!isPartialRefresh && isLatestFull(requestId)) {
            latestFullKeysRef.current = {
              sequence: requestId.sequence,
              normal: normalKeysToFetch,
              airdrop: airdropKeysToFetch,
            };
            Array.from(requestMap.keys()).forEach((key) => {
              const removeSource = (source: 'normal' | 'airdrop') => {
                const versionKey = JSON.stringify([key, source]);
                if (
                  (sourceVersionsRef.current.get(versionKey) ?? 0) >
                  requestId.sequence
                )
                  return;
                removeEarnPortfolioInvestmentSource({
                  requestMap,
                  key,
                  source,
                });
                sourceVersionsRef.current.set(versionKey, requestId.sequence);
              };
              if (
                !normalKeysToFetch.has(key) ||
                (!normalKeysUpdatedInThisSession.has(key) &&
                  !normalKeysFailedInThisSession.has(key))
              ) {
                removeSource('normal');
              }
              if (
                !airdropKeysToFetch.has(key) ||
                (!airdropKeysUpdatedInThisSession.has(key) &&
                  !airdropKeysFailedInThisSession.has(key))
              ) {
                removeSource('airdrop');
              }
            });
          }

          investmentMapRef.current = requestMap;

          updateInvestments(new Map(requestMap), true);

          if (!isPartialRefresh && isLatestFull(requestId)) {
            hasSettledSnapshotRef.current = true;
            finishLoadingNewAccount();
            setIsLoading(false);
          }

          if (earnAccountKey && hasSettledSnapshotRef.current) {
            setPortfolioCache((prev) => {
              if (isRequestStale(requestId)) return prev;
              return {
                ...prev,
                [earnAccountKey]: {
                  accountScope,
                  investments: sortByFiatValueDesc(
                    filterValidInvestments(investmentMapRef.current.values()),
                  ),
                },
              };
            });
          }
        }
      } catch (error) {
        console.error('[useEarnPortfolio] Fetch investments failed:', error);
        if (
          !isRequestStale(requestId) &&
          !isPartialRefresh &&
          isLatestFull(requestId) &&
          isMountedRef.current
        ) {
          if (hasSettledSnapshotRef.current) finishLoadingNewAccount();
          setIsLoading(false);
        }
      }
    },
    [
      isActive,
      accountIdValue,
      indexedAccountIdValue,
      accountIndexedAccountIdValue,
      allNetworkId,
      hasAccountChanged,
      startNewRequest,
      isRequestStale,
      isLatestFull,
      isScopeCurrent,
      accountScope,
      earnAccountKey,
      actions,
      throttledUIUpdate,
      updateInvestments,
      setPortfolioCache,
      finishLoadingNewAccount,
      investmentMapRef,
    ],
  );

  // Focus recovery and dependency changes can request the same refresh together.
  const automaticFetchRef = useRef<
    | {
        fetch: typeof fetchAndUpdateInvestments;
        promise: Promise<void>;
      }
    | undefined
  >(undefined);
  const fetchAutomatically = useCallback(() => {
    const pending = automaticFetchRef.current;
    if (pending?.fetch === fetchAndUpdateInvestments) {
      return pending.promise;
    }

    const promise = fetchAndUpdateInvestments();
    automaticFetchRef.current = { fetch: fetchAndUpdateInvestments, promise };
    const clearPending = () => {
      if (automaticFetchRef.current?.promise === promise) {
        automaticFetchRef.current = undefined;
      }
    };
    void promise.then(clearPending, clearPending);
    return promise;
  }, [fetchAndUpdateInvestments]);

  // Polling with usePromiseResult
  usePromiseResult(
    fetchAutomatically,
    [
      isActive,
      accountIdValue,
      indexedAccountIdValue,
      allNetworkId,
      fetchAutomatically,
    ],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
      overrideIsFocused: (isFocused) => isFocused && isActive,
    },
  );

  // Refresh function
  const refresh = useCallback(
    async (options?: IRefreshOptions) => {
      automaticFetchRef.current = undefined;
      await fetchAndUpdateInvestments(options);
    },
    [fetchAndUpdateInvestments],
  );

  // Account data update listener (instance-scoped, not global)
  const fetchRef = useRef(fetchAndUpdateInvestments);
  useEffect(() => {
    fetchRef.current = fetchAndUpdateInvestments;
  }, [fetchAndUpdateInvestments]);

  const shouldRegisterAccountListener =
    isActive && (accountIdValue || indexedAccountIdValue);

  useEffect(() => {
    if (!shouldRegisterAccountListener) {
      return undefined;
    }

    const handleAccountDataUpdate = () => {
      if (isSyncingAtomRef.current) return;
      automaticFetchRef.current = undefined;
      void fetchRef.current();
    };

    appEventBus.on(
      EAppEventBusNames.AccountDataUpdate,
      handleAccountDataUpdate,
    );
    appEventBus.on(EAppEventBusNames.AccountUpdate, handleAccountDataUpdate);

    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountDataUpdate,
        handleAccountDataUpdate,
      );
      appEventBus.off(EAppEventBusNames.AccountUpdate, handleAccountDataUpdate);
    };
  }, [shouldRegisterAccountListener]);

  // Aggregate investments by protocol
  const aggregatedInvestments = useMemo(
    () => aggregateByProtocol(investments),
    [investments],
  );

  // Debounced global state sync
  const debouncedUpdateGlobalState = useMemo(() => {
    return debounce(
      (key: string, scope: string, fiatValue: string, earnings: string) => {
        const latestAccount = actions.current.getEarnAccount(key);
        if (
          !latestAccount ||
          latestAccount.portfolioAccountScope !== scope ||
          committedPortfolioScopeRef.current !== scope
        )
          return;

        if (
          lastSyncedValuesRef.current.totalFiatValue === fiatValue &&
          lastSyncedValuesRef.current.earnings24h === earnings
        ) {
          return;
        }

        isSyncingAtomRef.current = true;
        lastSyncedValuesRef.current = {
          totalFiatValue: fiatValue,
          earnings24h: earnings,
        };

        actions.current.updateEarnAccounts({
          key,
          earnAccount: {
            ...latestAccount,
            totalFiatValue: fiatValue,
            earnings24h: earnings,
          },
        });

        setTimeout(() => {
          isSyncingAtomRef.current = false;
        }, 100);
      },
      500,
    );
  }, [actions]);

  // Sync totals to global state
  useEffect(() => {
    if (!earnAccountKey || isLoadingNewAccount()) return;

    const totalFiatValueStr = earnTotalFiatValue.toFixed();
    const earnings24hStr = earnTotalEarnings24hFiatValue.toFixed();

    if (
      lastSyncedValuesRef.current.totalFiatValue === totalFiatValueStr &&
      lastSyncedValuesRef.current.earnings24h === earnings24hStr
    ) {
      return;
    }

    debouncedUpdateGlobalState(
      earnAccountKey,
      accountScope,
      totalFiatValueStr,
      earnings24hStr,
    );
  }, [
    earnAccountKey,
    accountScope,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    debouncedUpdateGlobalState,
    isLoading,
    isLoadingNewAccount,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      throttledUIUpdate.cancel();
      debouncedUpdateGlobalState.cancel();
      investmentMapRef.current.clear();
    };
  }, [throttledUIUpdate, debouncedUpdateGlobalState, investmentMapRef]);

  return {
    investments: displayScope === accountScope ? aggregatedInvestments : [],
    earnTotalFiatValue:
      displayScope === accountScope ? earnTotalFiatValue : new BigNumber(0),
    earnTotalEarnings24hFiatValue:
      displayScope === accountScope
        ? earnTotalEarnings24hFiatValue
        : new BigNumber(0),
    cachedOverviewTotalFiatValue: currentOverviewData?.totalFiatValue,
    cachedOverviewEarnings24h: currentOverviewData?.earnings24h,
    isLoading,
    refresh,
  };
};
