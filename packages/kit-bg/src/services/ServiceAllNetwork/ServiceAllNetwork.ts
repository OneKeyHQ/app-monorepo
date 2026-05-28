import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  IMPL_ALLNETWORKS,
  IMPL_EVM,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import ServiceBase from '../ServiceBase';

import type { IDBAccount } from '../../dbs/local/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '../../vaults/types';

export type IAllNetworkAccountInfo = {
  networkId: string;
  accountId: string;
  apiAddress: string;
  accountXpub: string | undefined;
  pub: string | undefined;
  dbAccount: IDBAccount | undefined;
  isNftEnabled: boolean;
  isBackendIndexed: boolean | undefined;
  deriveType: IAccountDeriveTypes | undefined;
  deriveInfo: IAccountDeriveInfo | undefined;
  isTestnet: boolean;
};
export type IAllNetworkAccountsInfoResult = {
  accountsInfo: IAllNetworkAccountInfo[];
  accountsInfoBackendIndexed: IAllNetworkAccountInfo[];
  accountsInfoBackendNotIndexed: IAllNetworkAccountInfo[];
  allAccountsInfo: IAllNetworkAccountInfo[];
};
export type IAllNetworkAccountsParams = {
  networkId: string; // all networkId or single networkId
  deriveType?: IAccountDeriveTypes; // required for single network, all network should pass undefined
  accountId: string;
  nftEnabledOnly?: boolean;
  DeFiEnabledOnly?: boolean;
  includingNonExistingAccount?: boolean;
  includingNotEqualGlobalDeriveTypeAccount?: boolean;
  includingDeriveTypeMismatchInDefaultVisibleNetworks?: boolean;
  fetchAllNetworkAccounts?: boolean;
  networksEnabledOnly?: boolean;
  excludeTestNetwork?: boolean;
  indexedAccountId?: string;
  excludeIncompatibleWithWalletAccounts?: boolean;
  skipCache?: boolean;
};
export type IAllNetworkAccountsParamsForApi = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
};
// Short-lived in-flight + result cache for getAllNetworkAccounts. CDP
// profiles showed 3-4 callers (Earn portfolio, DeFi block, Token list,
// Universal Search) firing this method redundantly within a single
// tab-switch window, accumulating ~700ms of DB / network-derive-type
// work. A 5s TTL collapses all of them onto a single backend trip
// without holding stale data long enough to mask real account changes.
const GET_ALL_NETWORK_ACCOUNTS_CACHE_TTL_MS = 5000;
const GET_ALL_NETWORK_ACCOUNTS_CACHE_MAX_ENTRIES = 50;
type IGetAllNetworkAccountsCacheEntry = {
  createdAt: number;
  promise: Promise<IAllNetworkAccountsInfoResult>;
};

@backgroundClass()
class ServiceAllNetwork extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });

    const invalidate = () => this.clearGetAllNetworkAccountsCache();
    appEventBus.on(EAppEventBusNames.AccountUpdate, invalidate);
    appEventBus.on(EAppEventBusNames.AccountRemove, invalidate);
    appEventBus.on(EAppEventBusNames.AddDBAccountsToWallet, invalidate);
    appEventBus.on(EAppEventBusNames.RenameDBAccounts, invalidate);
    appEventBus.on(EAppEventBusNames.WalletRemove, invalidate);
    appEventBus.on(EAppEventBusNames.WalletUpdate, invalidate);
    appEventBus.on(EAppEventBusNames.WalletClear, invalidate);
  }

  private _getAllNetworkAccountsCache = new Map<
    string,
    IGetAllNetworkAccountsCacheEntry
  >();

  private _buildGetAllNetworkAccountsCacheKey(
    params: IAllNetworkAccountsParams,
  ): string {
    // Include every field the function branches on so two callers with
    // different intents (e.g. NFT-only vs unrestricted) don't share a
    // result.
    return [
      params.accountId ?? '',
      params.networkId ?? '',
      params.indexedAccountId ?? '',
      params.deriveType ?? '',
      params.nftEnabledOnly ? 1 : 0,
      params.DeFiEnabledOnly ? 1 : 0,
      params.includingNonExistingAccount ? 1 : 0,
      params.includingNotEqualGlobalDeriveTypeAccount ? 1 : 0,
      params.includingDeriveTypeMismatchInDefaultVisibleNetworks === false
        ? 0
        : 1,
      params.fetchAllNetworkAccounts ? 1 : 0,
      params.networksEnabledOnly ? 1 : 0,
      params.excludeTestNetwork === false ? 0 : 1,
      params.excludeIncompatibleWithWalletAccounts ? 1 : 0,
    ].join('::');
  }

  private _sweepGetAllNetworkAccountsCache(now: number) {
    for (const [key, entry] of Array.from(
      this._getAllNetworkAccountsCache.entries(),
    )) {
      if (now - entry.createdAt >= GET_ALL_NETWORK_ACCOUNTS_CACHE_TTL_MS) {
        this._getAllNetworkAccountsCache.delete(key);
      }
    }
    while (
      this._getAllNetworkAccountsCache.size >
      GET_ALL_NETWORK_ACCOUNTS_CACHE_MAX_ENTRIES
    ) {
      const oldestKey = this._getAllNetworkAccountsCache.keys().next().value;
      if (!oldestKey) break;
      this._getAllNetworkAccountsCache.delete(oldestKey);
    }
  }

  private isValidIndexedAccountId(indexedAccountId: string | undefined) {
    if (!indexedAccountId) {
      return false;
    }
    const { walletId, index } = accountUtils.parseIndexedAccountId({
      indexedAccountId,
    });
    return Boolean(walletId) && Number.isFinite(index);
  }

  private getIndexedAccountIdForAllNetwork({
    accountId,
    indexedAccountId,
    isAllNetwork,
  }: {
    accountId: string;
    indexedAccountId: string | undefined;
    isAllNetwork: boolean;
  }) {
    if (
      !isAllNetwork ||
      accountUtils.isOthersAccount({ accountId }) ||
      this.isValidIndexedAccountId(indexedAccountId)
    ) {
      return indexedAccountId;
    }

    if (this.isValidIndexedAccountId(accountId)) {
      return accountId;
    }

    const resolvedIndexedAccountId =
      accountUtils.buildAllNetworkIndexedAccountIdFromAccountId({
        accountId,
      });
    return this.isValidIndexedAccountId(resolvedIndexedAccountId)
      ? resolvedIndexedAccountId
      : indexedAccountId;
  }

  private async forEachWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<void>,
  ) {
    if (!items.length) return;
    const limit = Math.max(1, Math.trunc(concurrency));
    let nextIndex = 0;
    const workers = new Array(Math.min(limit, items.length))
      .fill(0)
      .map(async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= items.length) return;
          await fn(items[index], index);
        }
      });
    await Promise.all(workers);
  }

  // Per-deriveInfoMap cache for the entries() array + an LRU-ish lookup by
  // (accountId, template). getAllNetworkAccounts runs this once per network
  // per account (50+ times on a normal wallet), so the Object.entries() call
  // and the for-loop scan dominate CPU on cold-cache runs.
  // - WeakMap keyed by deriveInfoMap reference auto-evicts when the map is
  //   GC'd, so we don't grow unbounded across reloads.
  // - The inner Map's keys (accountId + template) are bounded by the
  //   number of (account, template) pairs a wallet actually has — a few
  //   dozen at most, well under any LRU threshold.
  private _deriveInfoMapEntriesCache = new WeakMap<
    Record<string, IAccountDeriveInfo>,
    [string, IAccountDeriveInfo][]
  >();

  private _deriveTypeLookupCache = new WeakMap<
    Record<string, IAccountDeriveInfo>,
    Map<
      string,
      {
        deriveType: IAccountDeriveTypes;
        deriveInfo: IAccountDeriveInfo | undefined;
      }
    >
  >();

  private getDeriveTypeByTemplateFromDeriveInfoMap({
    accountId,
    template,
    deriveInfoMap,
  }: {
    accountId: string;
    template: string | undefined;
    deriveInfoMap: Record<string, IAccountDeriveInfo>;
  }): {
    deriveType: IAccountDeriveTypes;
    deriveInfo: IAccountDeriveInfo | undefined;
  } {
    if (!template) {
      return { deriveType: 'default', deriveInfo: undefined };
    }

    let lookupCache = this._deriveTypeLookupCache.get(deriveInfoMap);
    if (!lookupCache) {
      lookupCache = new Map();
      this._deriveTypeLookupCache.set(deriveInfoMap, lookupCache);
    }
    const cacheKey = `${accountId}::${template}`;
    const cached = lookupCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let entries = this._deriveInfoMapEntriesCache.get(deriveInfoMap);
    if (!entries) {
      entries = Object.entries(deriveInfoMap);
      this._deriveInfoMapEntriesCache.set(deriveInfoMap, entries);
    }
    if (!entries.length) {
      const result = {
        deriveType: 'default' as IAccountDeriveTypes,
        deriveInfo: undefined,
      };
      lookupCache.set(cacheKey, result);
      return result;
    }

    const useAddressEncodingDerive = Boolean(
      entries[0]?.[1]?.useAddressEncodingDerive,
    );
    const shouldMatchByEncoding =
      useAddressEncodingDerive && accountId.split('--').length > 2;

    if (shouldMatchByEncoding) {
      for (const [deriveType, info] of entries) {
        if (
          info.template === template &&
          info.addressEncoding &&
          accountId.endsWith(info.addressEncoding)
        ) {
          const result = {
            deriveType: deriveType as IAccountDeriveTypes,
            deriveInfo: info,
          };
          lookupCache.set(cacheKey, result);
          return result;
        }
      }
    }

    for (const [deriveType, info] of entries) {
      if (info.template === template) {
        const result = {
          deriveType: deriveType as IAccountDeriveTypes,
          deriveInfo: info,
        };
        lookupCache.set(cacheKey, result);
        return result;
      }
    }

    const fallback = {
      deriveType: 'default' as IAccountDeriveTypes,
      deriveInfo: undefined,
    };
    lookupCache.set(cacheKey, fallback);
    return fallback;
  }

  @backgroundMethod()
  public async sampleMethod() {
    console.log('sampleMethod');
    return 'sampleMethod';
  }

  @backgroundMethod()
  async getAllNetworkDbAccounts({
    networkId,
    singleNetworkDeriveType,
    indexedAccountId,
    othersWalletAccountId,
    fetchAllNetworkAccounts = false,
  }: {
    networkId: string;
    singleNetworkDeriveType: IAccountDeriveTypes | undefined;
    indexedAccountId: string | undefined;
    othersWalletAccountId: string | undefined;
    fetchAllNetworkAccounts?: boolean;
  }): Promise<IDBAccount[]> {
    const isAllNetwork =
      fetchAllNetworkAccounts ||
      (networkId && networkUtils.isAllNetwork({ networkId }));
    let dbAccounts: IDBAccount[] = [];
    const isOthersWallet = !!(
      othersWalletAccountId &&
      !indexedAccountId &&
      accountUtils.isOthersAccount({ accountId: othersWalletAccountId })
    );

    if (isOthersWallet) {
      if (!othersWalletAccountId) {
        throw new OneKeyLocalError(
          'getAllNetworkDbAccounts ERROR: accountId is required',
        );
      }
      const dbAccount = await this.backgroundApi.serviceAccount.getDBAccount({
        accountId: othersWalletAccountId,
      });
      dbAccounts = [dbAccount].filter(Boolean);
    } else {
      if (!indexedAccountId) {
        throw new OneKeyLocalError(
          'getAllNetworkDbAccounts ERROR: indexedAccountId is required',
        );
      }
      if (isAllNetwork) {
        ({ accounts: dbAccounts } =
          await this.backgroundApi.serviceAccount.getAccountsInSameIndexedAccountId(
            {
              indexedAccountId,
            },
          ));
      } else {
        if (!singleNetworkDeriveType) {
          throw new OneKeyLocalError(
            'getAllNetworkDbAccounts ERROR: deriveType is required',
          );
        }
        const dbAccountId =
          await this.backgroundApi.serviceAccount.getDbAccountIdFromIndexedAccountId(
            {
              indexedAccountId,
              networkId,
              deriveType: singleNetworkDeriveType,
            },
          );
        const dbAccount = await this.backgroundApi.serviceAccount.getDBAccount({
          accountId: dbAccountId,
        });
        dbAccounts = [dbAccount].filter(Boolean);
      }
    }

    dbAccounts = dbAccounts
      .filter(Boolean)
      .filter((acc) => acc.impl !== IMPL_ALLNETWORKS);

    return dbAccounts;
  }

  @backgroundMethod()
  async getAllNetworkAccountsWithEnabledNetworks(
    params: IAllNetworkAccountsParams,
  ): Promise<IAllNetworkAccountsInfoResult> {
    const accountsInfoResult = await this.getAllNetworkAccounts({
      ...params,
      networksEnabledOnly: true,
      excludeTestNetwork: params.excludeTestNetwork ?? false,
    });
    return accountsInfoResult;
  }

  @backgroundMethod()
  async getAllNetworkAccounts(
    params: IAllNetworkAccountsParams,
  ): Promise<IAllNetworkAccountsInfoResult> {
    if (params.skipCache) {
      return this._getAllNetworkAccountsUncached(params);
    }
    const now = Date.now();
    this._sweepGetAllNetworkAccountsCache(now);
    const cacheKey = this._buildGetAllNetworkAccountsCacheKey(params);
    const cached = this._getAllNetworkAccountsCache.get(cacheKey);
    if (
      cached &&
      now - cached.createdAt < GET_ALL_NETWORK_ACCOUNTS_CACHE_TTL_MS
    ) {
      return cached.promise;
    }
    const promise = this._getAllNetworkAccountsUncached(params).catch(
      (error) => {
        // Don't keep a rejected promise in the cache; the next caller
        // should retry.
        const current = this._getAllNetworkAccountsCache.get(cacheKey);
        if (current?.promise === promise) {
          this._getAllNetworkAccountsCache.delete(cacheKey);
        }
        throw error;
      },
    );
    this._getAllNetworkAccountsCache.set(cacheKey, {
      createdAt: now,
      promise,
    });
    return promise;
  }

  public clearGetAllNetworkAccountsCache(): void {
    this._getAllNetworkAccountsCache.clear();
  }

  private async _getAllNetworkAccountsUncached(
    params: IAllNetworkAccountsParams,
  ): Promise<IAllNetworkAccountsInfoResult> {
    defaultLogger.account.allNetworkAccountPerf.getAllNetworkAccountsStart();

    const {
      accountId,
      networkId,
      deriveType: singleNetworkDeriveType,
      includingNonExistingAccount,
      includingNotEqualGlobalDeriveTypeAccount,
      includingDeriveTypeMismatchInDefaultVisibleNetworks = true,
      fetchAllNetworkAccounts,
      networksEnabledOnly,
      excludeTestNetwork = true,
      indexedAccountId,
    } = params;

    const isAllNetwork =
      fetchAllNetworkAccounts || networkUtils.isAllNetwork({ networkId });
    const resolvedIndexedAccountId = this.getIndexedAccountIdForAllNetwork({
      accountId,
      indexedAccountId,
      isAllNetwork,
    });

    defaultLogger.account.allNetworkAccountPerf.consoleLog('getAccount');
    let networkAccount: INetworkAccount | undefined;
    if (
      !(
        isAllNetwork &&
        resolvedIndexedAccountId &&
        !accountUtils.isOthersAccount({ accountId })
      )
    ) {
      try {
        // single network account or all network mocked account
        networkAccount = await this.backgroundApi.serviceAccount.getAccount({
          accountId,
          networkId,
          indexedAccountId: resolvedIndexedAccountId ?? indexedAccountId,
        });
      } catch (error) {
        console.log('getAccount error', error);
      }
    }

    defaultLogger.account.allNetworkAccountPerf.consoleLog('getAccount done');

    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'getAllNetworkDbAccounts',
    );
    const dbAccounts = await this.getAllNetworkDbAccounts({
      networkId,
      singleNetworkDeriveType,
      indexedAccountId:
        resolvedIndexedAccountId ??
        indexedAccountId ??
        networkAccount?.indexedAccountId,
      othersWalletAccountId: accountId,
      fetchAllNetworkAccounts,
    });
    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'getAllNetworkDbAccounts done',
    );

    const accountsInfo: Array<IAllNetworkAccountInfo> = [];
    const accountsInfoBackendIndexed: Array<IAllNetworkAccountInfo> = [];
    const accountsInfoBackendNotIndexed: Array<IAllNetworkAccountInfo> = [];
    const allAccountsInfo: Array<IAllNetworkAccountInfo> = [];
    const enableNFTNetworkIds = networkUtils.getEnabledNFTNetworkIds();

    let enableDeFiNetworkIdsMap: Record<string, boolean> = {};
    if (params.DeFiEnabledOnly) {
      enableDeFiNetworkIdsMap =
        await this.backgroundApi.simpleDb.deFi.getEnabledNetworksMap();
    }

    defaultLogger.account.allNetworkAccountPerf.consoleLog('getAllNetworks');
    const { networks: allNetworks } =
      await this.backgroundApi.serviceNetwork.getAllNetworks({
        excludeTestNetwork,
      });
    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'getAllNetworks done',
    );

    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'process all networks',
    );

    // Cache derive info per network impl for this run; derive templates are impl-scoped.
    const deriveInfoMapCacheByImpl = new Map<
      string,
      Promise<Record<string, IAccountDeriveInfo>>
    >();
    // Reuse EVM account address info across EVM networks (same address format).
    const evmAccountAddressInfoCache = new Map<
      string,
      Promise<{ address: string; account: INetworkAccount }>
    >();

    let enabledNetworks: Record<string, boolean> = {};
    let disabledNetworks: Record<string, boolean> = {};

    if (networksEnabledOnly) {
      const allNetworkState = await this.getAllNetworksState();
      enabledNetworks = allNetworkState.enabledNetworks;
      disabledNetworks = allNetworkState.disabledNetworks;
    }

    // Avoid spawning (networks * accounts) async tasks at once, which can cause
    // event-loop stalls and show up as thousands of slow calls in profiling.
    await this.forEachWithConcurrency(allNetworks, 8, async (n) => {
      const { backendIndex: isBackendIndexed } = n;
      const realNetworkId = n.id;
      const impl = networkUtils.getNetworkImpl({ networkId: realNetworkId });
      const isNftEnabled = enableNFTNetworkIds.includes(realNetworkId);
      const isDeFiEnabled = enableDeFiNetworkIdsMap[realNetworkId];
      const shouldProcessByNetworkEnabled =
        !networksEnabledOnly ||
        isEnabledNetworksInAllNetworks({
          networkId: realNetworkId,
          isTestnet: n.isTestnet,
          disabledNetworks,
          enabledNetworks,
        });
      const shouldProcessByCategory =
        (!params.nftEnabledOnly || isNftEnabled) &&
        (!params.DeFiEnabledOnly || isDeFiEnabled);

      if (!shouldProcessByNetworkEnabled || !shouldProcessByCategory) {
        return;
      }

      const appendAccountInfo = (accountInfo: IAllNetworkAccountInfo) => {
        if (
          networksEnabledOnly &&
          !isEnabledNetworksInAllNetworks({
            networkId: accountInfo.networkId,
            isTestnet: accountInfo.isTestnet,
            disabledNetworks,
            enabledNetworks,
          })
        ) {
          return;
        }

        if (
          (!params.nftEnabledOnly || isNftEnabled) &&
          (!params.DeFiEnabledOnly || isDeFiEnabled)
        ) {
          accountsInfo.push(accountInfo);
          if (isBackendIndexed) {
            accountsInfoBackendIndexed.push(accountInfo);
          } else {
            accountsInfoBackendNotIndexed.push(accountInfo);
          }
        }
        allAccountsInfo.push(accountInfo);
      };

      let compatibleAccountExists = false;

      // Load derive info once per network (impl) and reuse for all accounts.
      let deriveInfoMapPromise = deriveInfoMapCacheByImpl.get(impl);
      if (!deriveInfoMapPromise) {
        deriveInfoMapPromise =
          this.backgroundApi.serviceNetwork.getDeriveInfoMapOfNetwork({
            networkId: realNetworkId,
          });
        deriveInfoMapCacheByImpl.set(impl, deriveInfoMapPromise);
      }
      const deriveInfoMap = await deriveInfoMapPromise;

      const shouldFilterNotEqualGlobalDeriveTypeAccount =
        !includingNotEqualGlobalDeriveTypeAccount &&
        isAllNetwork &&
        !accountUtils.isOthersAccount({ accountId }) &&
        !(
          networkUtils
            .getDefaultDeriveTypeVisibleNetworks()
            .includes(realNetworkId) &&
          includingDeriveTypeMismatchInDefaultVisibleNetworks
        );
      let globalDeriveTypePromise: Promise<IAccountDeriveTypes> | undefined;

      await Promise.all(
        dbAccounts.map(async (a) => {
          const perf = perfUtils.createPerf({
            name: EPerformanceTimerLogNames.allNetwork__getAllNetworkAccounts_EachAccount,
          });

          const isCompatible = accountUtils.isAccountCompatibleWithNetwork({
            account: a,
            networkId: realNetworkId,
          });

          let isMatched = isAllNetwork
            ? isCompatible
            : networkId === realNetworkId;

          const { deriveType, deriveInfo } =
            this.getDeriveTypeByTemplateFromDeriveInfoMap({
              accountId: a.id,
              template: a.template,
              deriveInfoMap,
            });

          if (
            shouldFilterNotEqualGlobalDeriveTypeAccount &&
            isMatched &&
            a.template
          ) {
            if (!globalDeriveTypePromise) {
              globalDeriveTypePromise =
                this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
                  networkId: realNetworkId,
                });
            }
            const globalDeriveType = await globalDeriveTypePromise;

            if (a.impl === IMPL_EVM) {
              // console.log({ deriveType, globalDeriveType, realNetworkId });
            }
            if (deriveType !== globalDeriveType) {
              isMatched = false;
            }
          }

          let apiAddress = '';
          let accountXpub: string | undefined;
          if (isMatched) {
            perf.markStart('getAccountAddressForApi');
            let theMatchedNetworkAccount: INetworkAccount | undefined;
            let accountAddressInfoPromise: Promise<{
              address: string;
              account: INetworkAccount;
            }>;
            if (impl === IMPL_EVM) {
              const cachedPromise = evmAccountAddressInfoCache.get(a.id);
              if (cachedPromise) {
                accountAddressInfoPromise = cachedPromise;
              } else {
                accountAddressInfoPromise =
                  this.backgroundApi.serviceAccount.getAccountAddressInfoForApi(
                    {
                      dbAccount: a,
                      accountId: a.id,
                      networkId: getNetworkIdsMap().eth,
                    },
                  );
                evmAccountAddressInfoCache.set(a.id, accountAddressInfoPromise);
              }
            } else {
              accountAddressInfoPromise =
                this.backgroundApi.serviceAccount.getAccountAddressInfoForApi({
                  dbAccount: a,
                  accountId: a.id,
                  networkId: realNetworkId,
                });
            }
            ({ address: apiAddress, account: theMatchedNetworkAccount } =
              await accountAddressInfoPromise);
            perf.markEnd('getAccountAddressForApi');

            // TODO pass dbAccount for better performance
            perf.markStart('getAccountXpub');
            accountXpub =
              await this.backgroundApi.serviceAccount.getAccountXpub({
                dbAccount: a,
                accountId: a.id,
                networkId: realNetworkId,
              });
            perf.markEnd('getAccountXpub');

            const accountInfo: IAllNetworkAccountInfo = {
              networkId: realNetworkId,
              accountId: a.id,
              apiAddress,
              pub: a?.pub,
              accountXpub,
              isBackendIndexed,
              isNftEnabled,
              isTestnet: n.isTestnet,
              dbAccount: a,
              deriveType,
              deriveInfo,
            };

            appendAccountInfo(accountInfo);
            void this.backgroundApi.serviceAccount.saveAccountAddresses({
              networkId: realNetworkId,
              account: theMatchedNetworkAccount,
            });

            compatibleAccountExists = true;
          }
          perf.done({ minDuration: 1 });
        }),
      );

      if (
        !compatibleAccountExists &&
        includingNonExistingAccount &&
        isAllNetwork &&
        !networkUtils.isAllNetwork({ networkId: realNetworkId }) &&
        !accountUtils.isOthersAccount({ accountId })
      ) {
        appendAccountInfo({
          networkId: realNetworkId,
          accountId: '',
          apiAddress: '',
          pub: undefined,
          accountXpub: undefined,
          isNftEnabled,
          isBackendIndexed,
          dbAccount: undefined,
          deriveType: undefined,
          deriveInfo: undefined,
          isTestnet: n.isTestnet,
        });
      }
    });
    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'process all networks done',
    );

    defaultLogger.account.allNetworkAccountPerf.getAllNetworkAccountsEnd();
    return {
      accountsInfo,
      allAccountsInfo,
      accountsInfoBackendIndexed,
      accountsInfoBackendNotIndexed,
    };
  }

  @backgroundMethod()
  async getAllNetworksState() {
    const allNetworksState =
      await this.backgroundApi.simpleDb.allNetworks.getAllNetworksState();
    return allNetworksState;
  }

  @backgroundMethod()
  async updateAllNetworksState(params: {
    disabledNetworks?: Record<string, boolean>;
    enabledNetworks?: Record<string, boolean>;
    // Optional context so bg can prime the UnifiedNetworkSelector's SWR
    // cache (swrKeys.unifiedNetworkSelectorMeta) for this account — the
    // next modal open then reflects the new enabled/disabled state from
    // frame 0 instead of flashing the pre-update snapshot. The context
    // is additive: callers that don't supply it retain the old behavior.
    cacheContext?: {
      walletId?: string;
      accountId?: string;
    };
  }) {
    await this.backgroundApi.simpleDb.allNetworks.updateAllNetworksState(
      params,
    );
    this.clearGetAllNetworkAccountsCache();
    const { cacheContext } = params;
    if (cacheContext?.walletId) {
      void this.backgroundApi.serviceNetwork.primeUnifiedNetworkSelectorMetaCache(
        {
          walletId: cacheContext.walletId,
          accountId: cacheContext.accountId,
        },
      );
    }
  }

  @backgroundMethod()
  async buildAllNetworkAccountsForApiParam(
    params: IAllNetworkAccountsParams & { withoutAccountId?: boolean },
  ) {
    const { accountsInfo } = await this.getAllNetworkAccounts({
      ...params,
      networksEnabledOnly: params.networksEnabledOnly ?? true,
      excludeTestNetwork: params.excludeTestNetwork ?? false,
    });

    const allNetworkAccounts = accountsInfo.map((acc) => ({
      accountId: params.withoutAccountId ? undefined : acc.accountId,
      networkId: acc.networkId,
      accountAddress: acc.apiAddress,
      accountXpub: acc.accountXpub,
    }));

    if (params.excludeIncompatibleWithWalletAccounts) {
      const compatibleResp =
        await this.backgroundApi.serviceNetwork.getNetworkIdsCompatibleWithWalletId(
          {
            networkIds: allNetworkAccounts.map((acc) => acc.networkId),
            walletId: accountUtils.getWalletIdFromAccountId({
              accountId: params.accountId,
            }),
          },
        );
      const incompatibleNetworksSet = new Set(
        compatibleResp.networkIdsIncompatible,
      );
      return {
        allNetworkAccounts: allNetworkAccounts.filter(
          (acc) => !incompatibleNetworksSet.has(acc.networkId),
        ),
      };
    }

    return {
      allNetworkAccounts,
    };
  }
}

export default ServiceAllNetwork;
