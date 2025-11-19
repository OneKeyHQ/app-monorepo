import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { debounce, throttle } from 'lodash';
import pLimit from 'p-limit';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IEarnAccountTokenResponse,
  IEarnInvestmentItemV2,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '../../../states/jotai/contexts/earn';

interface IRefreshOptions {
  provider?: string;
  networkId?: string;
  symbol?: string;
  rewardSymbol?: string;
}

interface IFetchInvestmentParams {
  publicKey?: string;
  vault?: string;
  accountAddress: string;
  networkId: string;
  provider: string;
  symbol: string;
}

interface IFetchInvestmentResult {
  key: IInvestmentKey;
  investment: IEarnPortfolioInvestment;
}

type IInvestmentKey = string;
type IInvestmentMap = Map<IInvestmentKey, IEarnPortfolioInvestment>;

const createInvestmentKey = (item: {
  provider: string;
  symbol: string;
  vault?: string;
  networkId: string;
}): IInvestmentKey =>
  `${item.provider}_${item.symbol}_${item.vault || ''}_${item.networkId}`;

const hasPositiveFiatValue = (value: string | undefined): boolean =>
  new BigNumber(value || '0').gt(0);

const sortByFiatValueDesc = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] =>
  [...investments].sort((a, b) => {
    const valueA = new BigNumber(a.totalFiatValue || '0');
    const valueB = new BigNumber(b.totalFiatValue || '0');
    return valueB.comparedTo(valueA);
  });

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

const enrichAssetWithMetadata = (
  asset: IEarnInvestmentItemV2['assets'][number],
  investment: IEarnInvestmentItemV2,
): IEarnPortfolioInvestment['assets'][number] => ({
  ...asset,
  metadata: {
    protocol: investment.protocol,
    network: investment.network,
  },
});

const mergeInvestments = (
  existing: IEarnPortfolioInvestment,
  incoming: IEarnPortfolioInvestment,
): IEarnPortfolioInvestment => {
  const existingTotal = new BigNumber(existing.totalFiatValue || '0');
  const incomingTotal = new BigNumber(incoming.totalFiatValue || '0');

  return {
    ...existing,
    assets: [...existing.assets, ...incoming.assets],
    airdropAssets: [...existing.airdropAssets, ...incoming.airdropAssets],
    totalFiatValue: existingTotal.plus(incomingTotal).toFixed(),
  };
};

const aggregateByProtocol = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] => {
  const protocolMap = investments.reduce((map, investment) => {
    const protocolKey = investment.protocol.providerDetail.code;
    const existing = map.get(protocolKey);

    if (existing) {
      map.set(protocolKey, mergeInvestments(existing, investment));
    } else {
      map.set(protocolKey, { ...investment });
    }

    return map;
  }, new Map<string, IEarnPortfolioInvestment>());

  return sortByFiatValueDesc(Array.from(protocolMap.values()));
};

const useInvestmentState = () => {
  const [investments, setInvestments] = useState<IEarnPortfolioInvestment[]>(
    [],
  );
  const [earnTotalFiatValue, setEarnTotalFiatValue] = useState<BigNumber>(
    new BigNumber(0),
  );
  const [earnTotalEarnings24hFiatValue, setEarnTotalEarnings24hFiatValue] =
    useState<BigNumber>(new BigNumber(0));
  const investmentMapRef = useRef<IInvestmentMap>(new Map());
  const isLoadingNewAccountRef = useRef(false);

  const updateInvestments = useCallback(
    (newMap: IInvestmentMap, shouldUpdateTotals = true) => {
      const validInvestments = Array.from(newMap.values()).filter((inv) => {
        if (inv.airdropAssets.length > 0) return true;
        return hasPositiveFiatValue(inv.totalFiatValue);
      });

      const sorted = sortByFiatValueDesc(validInvestments);
      setInvestments(sorted);

      if (shouldUpdateTotals) {
        setEarnTotalFiatValue(calculateTotalFiatValue(sorted));
        setEarnTotalEarnings24hFiatValue(
          calculateTotalEarnings24hValue(sorted),
        );
      }

      investmentMapRef.current = new Map(
        validInvestments.map((inv) => {
          const firstAsset = inv.assets[0] || inv.airdropAssets[0];
          return [
            createInvestmentKey({
              provider: inv.protocol.providerDetail.code,
              symbol: firstAsset?.token.info.symbol || '',
              vault: inv.protocol.vault,
              networkId: inv.network.networkId,
            }),
            inv,
          ];
        }),
      );
    },
    [],
  );

  const clearInvestments = useCallback(() => {
    investmentMapRef.current.clear();
    setInvestments([]);
    isLoadingNewAccountRef.current = true;
  }, []);

  const finishLoadingNewAccount = useCallback(() => {
    isLoadingNewAccountRef.current = false;
  }, []);

  return {
    investments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    investmentMapRef,
    updateInvestments,
    clearInvestments,
    finishLoadingNewAccount,
    isLoadingNewAccountRef,
  };
};

const useAccountState = (
  account?: { id: string } | null,
  indexedAccount?: { id: string } | null,
) => {
  const prevAccountRef = useRef({
    accountId: account?.id,
    indexedAccountId: indexedAccount?.id,
  });
  const currentRequestIdRef = useRef(0);

  const accountId = account?.id;
  const indexedAccountId = indexedAccount?.id;

  const hasAccountChanged = useCallback(() => {
    return (
      prevAccountRef.current.accountId !== accountId ||
      prevAccountRef.current.indexedAccountId !== indexedAccountId
    );
  }, [accountId, indexedAccountId]);

  const markAccountChange = useCallback(() => {
    prevAccountRef.current = { accountId, indexedAccountId };
    currentRequestIdRef.current += 1;
  }, [accountId, indexedAccountId]);

  const isRequestStale = useCallback((requestId: number) => {
    return requestId !== currentRequestIdRef.current;
  }, []);

  const getCurrentRequestId = useCallback(
    () => currentRequestIdRef.current,
    [],
  );

  return {
    hasAccountChanged,
    markAccountChange,
    isRequestStale,
    getCurrentRequestId,
  };
};

export interface IUseEarnPortfolioReturn {
  investments: IEarnPortfolioInvestment[];
  earnTotalFiatValue: BigNumber;
  earnTotalEarnings24hFiatValue: BigNumber;
  isLoading: boolean;
  refresh: (options?: IRefreshOptions) => Promise<void>;
}

export const useEarnPortfolio = (): IUseEarnPortfolioReturn => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const allNetworkId = getNetworkIdsMap().onekeyall;
  const accountIdValue = account?.id ?? '';
  const indexedAccountIdValue = indexedAccount?.id ?? '';
  const accountIndexedAccountIdValue = account?.indexedAccountId;

  const [isLoading, setIsLoading] = useState(true);
  const actions = useEarnActions();
  const [{ earnAccount }] = useEarnAtom();

  const {
    investments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    investmentMapRef,
    updateInvestments,
    clearInvestments,
    finishLoadingNewAccount,
    isLoadingNewAccountRef,
  } = useInvestmentState();

  const {
    hasAccountChanged,
    markAccountChange,
    isRequestStale,
    getCurrentRequestId,
  } = useAccountState(account, indexedAccount);

  const throttledUIUpdate = useMemo(
    () =>
      throttle(
        (newMap: IInvestmentMap) => {
          updateInvestments(newMap, false);
        },
        500,
        { leading: true, trailing: true },
      ),
    [updateInvestments],
  );

  const earnAccountKey = useMemo(
    () =>
      actions.current.buildEarnAccountsKey({
        accountId: accountIdValue || undefined,
        indexAccountId:
          accountIndexedAccountIdValue || indexedAccountIdValue || undefined,
        networkId: allNetworkId,
      }),
    [
      actions,
      accountIdValue,
      accountIndexedAccountIdValue,
      indexedAccountIdValue,
      allNetworkId,
    ],
  );

  useEffect(() => {
    if (hasAccountChanged()) {
      clearInvestments();
      throttledUIUpdate.cancel();
    }
  }, [hasAccountChanged, clearInvestments, throttledUIUpdate]);

  const fetchInvestmentDetail = useCallback(
    async (
      item: IFetchInvestmentParams,
      isAirdrop: boolean,
      requestId: number,
    ): Promise<IFetchInvestmentResult | null> => {
      try {
        if (isAirdrop) {
          const result =
            await backgroundApiProxy.serviceStaking.fetchAirdropInvestmentDetail(
              item,
            );
          if (isRequestStale(requestId)) return null;

          const key = createInvestmentKey({
            provider: result.protocol.providerDetail.code,
            symbol: result.assets?.[0]?.token.info.symbol || '',
            vault: result.protocol.vault,
            networkId: result.network.networkId,
          });

          const enrichedAirdropAssets = result.assets.map((asset) => ({
            ...asset,
            metadata: {
              protocol: result.protocol,
              network: result.network,
            },
          }));

          return {
            key,
            investment: {
              totalFiatValue: '0',
              earnings24hFiatValue: '0',
              protocol: result.protocol,
              network: result.network,
              assets: [],
              airdropAssets: enrichedAirdropAssets,
            },
          };
        }

        const result =
          await backgroundApiProxy.serviceStaking.fetchInvestmentDetailV2(item);

        if (
          isRequestStale(requestId) ||
          !hasPositiveFiatValue(result.totalFiatValue)
        ) {
          return null;
        }

        const key = createInvestmentKey({
          provider: result.protocol.providerDetail.code,
          symbol: result.assets?.[0]?.token.info.symbol || '',
          vault: result.protocol.vault,
          networkId: result.network.networkId,
        });

        const enrichedAssets = result.assets.map((asset) =>
          enrichAssetWithMetadata(asset, result),
        );

        return {
          key,
          investment: {
            totalFiatValue: result.totalFiatValue,
            earnings24hFiatValue: result.earnings24hFiatValue,
            protocol: result.protocol,
            network: result.network,
            assets: enrichedAssets,
            airdropAssets: [],
          },
        };
      } catch (error) {
        return null;
      }
    },
    [isRequestStale],
  );

  const fetchAndUpdateInvestments = useCallback(
    async (options?: IRefreshOptions) => {
      if (!accountIdValue && !indexedAccountIdValue) {
        setIsLoading(false);
        return;
      }

      if (hasAccountChanged()) {
        markAccountChange();
      }

      const requestId = getCurrentRequestId();
      const isPartialRefresh = Boolean(options);
      if (!isPartialRefresh) {
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

        if (isRequestStale(requestId)) return;

        if (earnAccountKey) {
          const normalizedAccounts = accounts.map((accountItem) => ({
            tokens: [],
            networkId: accountItem.networkId,
            accountAddress: accountItem.accountAddress,
            publicKey: accountItem.publicKey,
          }));
          const previousAccountData =
            actions.current.getEarnAccount(earnAccountKey) || {};
          actions.current.updateEarnAccounts({
            key: earnAccountKey,
            earnAccount: {
              ...previousAccountData,
              accounts: normalizedAccounts,
              isOverviewLoaded: true,
            },
          });
        }

        const accountAssetPairs = accounts.flatMap((accountItem) =>
          assets
            .filter((asset) => asset.networkId === accountItem.networkId)
            .map((asset) => ({
              isAirdrop: asset.type === 'airdrop',
              params: {
                accountAddress: accountItem.accountAddress,
                networkId: accountItem.networkId,
                provider: asset.provider,
                symbol: asset.symbol,
                ...(asset.vault && { vault: asset.vault }),
                ...(accountItem.publicKey && {
                  publicKey: accountItem.publicKey,
                }),
              },
            })),
        );

        const pairsWithType = options
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

        const keysUpdatedInThisSession = new Set<IInvestmentKey>();
        const limit = pLimit(6);

        const tasks = pairsWithType.map(({ params, isAirdrop }) =>
          limit(async () => {
            if (isRequestStale(requestId)) return;

            const result = await fetchInvestmentDetail(
              params,
              isAirdrop,
              requestId,
            );

            if (!isRequestStale(requestId) && result) {
              const { key: resultKey, investment: newInv } = result;

              const currentMap = investmentMapRef.current;
              const existingInMap = currentMap.get(resultKey);
              const hasUpdatedInSession =
                keysUpdatedInThisSession.has(resultKey);

              let finalInv = newInv;

              if (hasUpdatedInSession && existingInMap) {
                finalInv = mergeInvestments(existingInMap, newInv);
              }

              keysUpdatedInThisSession.add(resultKey);
              currentMap.set(resultKey, finalInv);

              throttledUIUpdate(new Map(currentMap));
            }
          }),
        );

        await Promise.all(tasks);

        if (!isRequestStale(requestId)) {
          throttledUIUpdate.flush();

          if (!options) {
            const finalMap = new Map(investmentMapRef.current);
            Array.from(finalMap.keys()).forEach((key) => {
              if (!keysUpdatedInThisSession.has(key)) {
                finalMap.delete(key);
              }
            });
            investmentMapRef.current = finalMap;
          }

          updateInvestments(new Map(investmentMapRef.current), true);

          finishLoadingNewAccount();

          if (!isPartialRefresh) {
            setIsLoading(false);
          }
        }
      } catch (e) {
        console.error('Fetch investments failed', e);
        if (!isRequestStale(requestId) && !isPartialRefresh) {
          setIsLoading(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      accountIdValue,
      indexedAccountIdValue,
      accountIndexedAccountIdValue,
      allNetworkId,
      hasAccountChanged,
      markAccountChange,
      getCurrentRequestId,
      isRequestStale,
      earnAccountKey,
      actions,
      fetchInvestmentDetail,
      throttledUIUpdate,
      updateInvestments,
    ],
  );

  usePromiseResult(
    fetchAndUpdateInvestments,
    [
      accountIdValue,
      indexedAccountIdValue,
      allNetworkId,
      fetchAndUpdateInvestments,
    ],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  const refresh = useCallback(
    async (options?: IRefreshOptions) => {
      await fetchAndUpdateInvestments(options);
    },
    [fetchAndUpdateInvestments],
  );

  const aggregatedInvestments = useMemo(
    () => aggregateByProtocol(investments),
    [investments],
  );

  const debouncedUpdateGlobalState = useMemo(
    () =>
      debounce(
        (
          key: string,
          currentAccount: IEarnAccountTokenResponse,
          fiatValue: string,
          earnings: string,
        ) => {
          actions.current.updateEarnAccounts({
            key,
            earnAccount: {
              ...currentAccount,
              totalFiatValue: fiatValue,
              earnings24h: earnings,
            },
          });
        },
        500,
      ),
    [actions],
  );

  useEffect(() => {
    if (!earnAccountKey) return;

    if (isLoadingNewAccountRef.current) return;

    const currentAccount = earnAccount?.[earnAccountKey];
    if (!currentAccount) return;

    const totalFiatValueStr = earnTotalFiatValue.toFixed();
    const earnings24hStr = earnTotalEarnings24hFiatValue.toFixed();

    if (
      currentAccount.totalFiatValue === totalFiatValueStr &&
      currentAccount.earnings24h === earnings24hStr
    ) {
      return;
    }

    debouncedUpdateGlobalState(
      earnAccountKey,
      currentAccount,
      totalFiatValueStr,
      earnings24hStr,
    );

    return () => debouncedUpdateGlobalState.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    earnAccountKey,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    earnAccount,
    debouncedUpdateGlobalState,
  ]);

  return {
    investments: aggregatedInvestments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    isLoading,
    refresh,
  };
};
