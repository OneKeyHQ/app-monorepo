import BigNumber from 'bignumber.js';
import { debounce, isEmpty, isUndefined } from 'lodash';

import { settingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type {
  IFetchAccountDeFiPositionsParams,
  IFetchAccountDeFiPositionsResp,
} from '@onekeyhq/shared/types/defi';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { currencyPersistAtom } from '../states/jotai/atoms/currency';

import ServiceBase from './ServiceBase';

import type { IDeFiDBStruct } from '../dbs/simple/entity/SimpleDbEntityDeFi';

@backgroundClass()
class ServiceDeFi extends ServiceBase {
  private enabledNetworksMapEmptyCacheExpiresAt = 0;

  private ensureEnabledNetworksMapPromise:
    | Promise<Record<string, boolean>>
    | undefined
    | null = null;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });

    appEventBus.on(EAppEventBusNames.LocalPendingTxConfirmed, (payload) => {
      void this.onLocalTxConfirmedForDeFi(payload);
    });
  }

  _fetchAccountDeFiPositionsControllers: AbortController[] = [];

  // Offsets (ms) from a local tx being confirmed at which we force-refresh
  // the DeFi portfolio for that chain. Covers indexer lag after the tx lands.
  private readonly _deFiForceRefreshOffsetsMs = [40_000, 80_000] as const;

  private _deFiForceRefreshTimers = new Map<
    string,
    ReturnType<typeof setTimeout>[]
  >();

  _localDeFiOverviewCache: Record<
    string,
    {
      totalValue: number;
      totalDebt: number;
      totalReward: number;
      netWorth: number;
      currency: string;
    }
  > = {};

  _updateAccountDeFiOverviewDebounced = debounce(
    async ({
      accountAddress,
      xpub,
    }: {
      accountAddress?: string;
      xpub?: string;
    }) => {
      await this.updateAccountsLocalDeFiOverview({
        accountAddress,
        xpub,
        overview: this._localDeFiOverviewCache,
        merge: true,
      });
      this._localDeFiOverviewCache = {};
    },
    3000,
    {
      leading: false,
      trailing: true,
    },
  );

  private _fixCurrencyValue = ({
    sourceCurrencyInfo,
    targetCurrencyInfo,
    value,
  }: {
    sourceCurrencyInfo?: ICurrencyItem;
    targetCurrencyInfo?: ICurrencyItem;
    value: number;
  }) => {
    if (
      sourceCurrencyInfo &&
      targetCurrencyInfo &&
      sourceCurrencyInfo.id !== targetCurrencyInfo.id
    ) {
      return new BigNumber(value ?? 0)
        .div(new BigNumber(sourceCurrencyInfo.value))
        .times(new BigNumber(targetCurrencyInfo.value));
    }
    return new BigNumber(value ?? 0);
  };

  @backgroundMethod()
  public async abortFetchAccountDeFiPositions() {
    this._fetchAccountDeFiPositionsControllers.forEach((controller) => {
      controller.abort();
    });
    this._fetchAccountDeFiPositionsControllers = [];
  }

  @backgroundMethod()
  public async fetchAccountDeFiPositions(
    params: IFetchAccountDeFiPositionsParams,
  ) {
    const {
      accountId,
      networkId,
      isAllNetworks,
      allNetworksAccountId,
      allNetworksNetworkId,
      excludeLowValueProtocols,
      lowValueProtocolsThresholdUsd = 0.01,
      sourceCurrencyInfo,
      targetCurrencyInfo,
      saveToLocal,
      isForceRefresh,
      abortable = true,
    } = params;

    const isUrlAccount = accountUtils.isUrlAccountFn({ accountId });

    const currentNetworkId = isUrlAccount
      ? this._currentUrlNetworkId
      : this._currentNetworkId;

    const currentAccountId = isUrlAccount
      ? this._currentUrlAccountId
      : this._currentAccountId;

    if (isAllNetworks && currentNetworkId !== getNetworkIdsMap().onekeyall)
      return {
        ...defiUtils.getEmptyDeFiData(),
        networkId: currentNetworkId,
      };

    const client = await this.getClient(EServiceEndpointEnum.Wallet);

    const controller = new AbortController();
    if (abortable) {
      this._fetchAccountDeFiPositionsControllers.push(controller);
    }

    let accountAddress = params.accountAddress;
    let xpub = params.xpub;

    if (!accountAddress && !xpub) {
      const [a, x] = await Promise.all([
        this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
        this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
      ]);
      accountAddress = a;
      xpub = x;
    }

    const resp = await client.post<{
      data: IFetchAccountDeFiPositionsResp;
    }>(
      '/wallet/v1/portfolio/positions',
      {
        networkId,
        accountAddress,
        isForceRefresh,
      },
      {
        signal: controller.signal,
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );

    const parsedData = defiUtils.transformDeFiData({
      positions: resp.data.data.data.positions,
      protocolSummaries: resp.data.data.data.protocolSummaries,
    });

    if (excludeLowValueProtocols) {
      parsedData.protocols = parsedData.protocols.filter((protocol) => {
        const sourceTotal =
          parsedData.protocolMap[
            defiUtils.buildProtocolMapKey({
              protocol: protocol.protocol,
              networkId: protocol.networkId,
            })
          ];

        const sourceTotalValue = new BigNumber(sourceTotal?.totalValue ?? 0);
        const sourceTotalDebt = new BigNumber(sourceTotal?.totalDebt ?? 0);
        const sourceTotalReward = new BigNumber(sourceTotal?.totalReward ?? 0);

        let targetTotalValue = sourceTotalValue;
        let targetTotalDebt = sourceTotalDebt;
        let targetTotalReward = sourceTotalReward;

        if (
          sourceCurrencyInfo &&
          targetCurrencyInfo &&
          sourceCurrencyInfo?.id !== targetCurrencyInfo?.id
        ) {
          targetTotalValue = sourceTotalValue
            .div(new BigNumber(sourceCurrencyInfo.value))
            .times(new BigNumber(targetCurrencyInfo.value));
          targetTotalDebt = sourceTotalDebt
            .div(new BigNumber(sourceCurrencyInfo.value))
            .times(new BigNumber(targetCurrencyInfo.value));
          targetTotalReward = sourceTotalReward
            .div(new BigNumber(sourceCurrencyInfo.value))
            .times(new BigNumber(targetCurrencyInfo.value));
        }

        return (
          targetTotalValue.gte(lowValueProtocolsThresholdUsd) ||
          targetTotalDebt.gte(lowValueProtocolsThresholdUsd) ||
          targetTotalReward.gte(lowValueProtocolsThresholdUsd)
        );
      });
    }

    if (saveToLocal) {
      this._localDeFiOverviewCache = {
        ...this._localDeFiOverviewCache,
        [networkId]: {
          totalValue: this._fixCurrencyValue({
            sourceCurrencyInfo,
            targetCurrencyInfo,
            value: resp.data.data.data.totals.totalValue,
          }).toNumber(),
          totalDebt: this._fixCurrencyValue({
            sourceCurrencyInfo,
            targetCurrencyInfo,
            value: resp.data.data.data.totals.totalDebt,
          }).toNumber(),
          totalReward: this._fixCurrencyValue({
            sourceCurrencyInfo,
            targetCurrencyInfo,
            value: resp.data.data.data.totals.totalReward,
          }).toNumber(),
          netWorth: this._fixCurrencyValue({
            sourceCurrencyInfo,
            targetCurrencyInfo,
            value: resp.data.data.data.totals.netWorth,
          }).toNumber(),
          currency: targetCurrencyInfo?.id ?? '',
        },
      };
      await this._updateAccountDeFiOverviewDebounced({
        accountAddress,
        xpub,
      });
    }

    return {
      overview: resp.data.data.data.totals,
      protocols: parsedData.protocols,
      protocolMap: parsedData.protocolMap,
      isSameAllNetworksAccountData: !!(
        allNetworksAccountId &&
        allNetworksNetworkId &&
        allNetworksAccountId === currentAccountId &&
        allNetworksNetworkId === currentNetworkId
      ),
    };
  }

  private _buildDeFiForceRefreshKey(accountId: string, networkId: string) {
    return `${accountId}__${networkId}`;
  }

  private _cancelDeFiForceRefresh(key: string) {
    const timers = this._deFiForceRefreshTimers.get(key);
    if (!timers) return;
    timers.forEach((t) => clearTimeout(t));
    this._deFiForceRefreshTimers.delete(key);
  }

  @backgroundMethod()
  public async isNetworkDeFiEnabled(networkId: string): Promise<boolean> {
    if (!networkId) return false;
    const enabledMap = await this.getDeFiEnabledNetworksMap();
    return !!enabledMap[networkId];
  }

  @backgroundMethod()
  public async onLocalTxConfirmedForDeFi(
    payload: IAppEventBusPayload[EAppEventBusNames.LocalPendingTxConfirmed],
  ) {
    const { accountId, indexedAccountId, networkId, status } = payload;

    if (!accountId || !networkId) return;

    // Failed txs do not move positions, so no force refresh needed.
    if (status !== EDecodedTxStatus.Confirmed) return;

    // Skip chains that do not support DeFi at all.
    if (!(await this.isNetworkDeFiEnabled(networkId))) return;

    const key = this._buildDeFiForceRefreshKey(accountId, networkId);

    // Coalesce multiple confirmed txs: reset the schedule to the latest one.
    this._cancelDeFiForceRefresh(key);

    const maxOffset = Math.max(...this._deFiForceRefreshOffsetsMs);
    const timers = this._deFiForceRefreshOffsetsMs.map((offset) =>
      setTimeout(() => {
        void this._runDeFiForceRefresh({
          accountId,
          indexedAccountId,
          networkId,
        });
        // After the last scheduled offset fires, drop the Map entry so it
        // does not linger once every timer has run.
        if (offset === maxOffset) {
          this._deFiForceRefreshTimers.delete(key);
        }
      }, offset),
    );

    this._deFiForceRefreshTimers.set(key, timers);
  }

  private async _runDeFiForceRefresh(params: {
    accountId: string;
    indexedAccountId?: string;
    networkId: string;
  }) {
    const { accountId, indexedAccountId, networkId } = params;
    try {
      const [settings, currencyMap, accountAddress, xpub] = await Promise.all([
        settingsPersistAtom.get(),
        this.backgroundApi.serviceSetting.getCurrencyMap(),
        this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
        this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
      ]);
      const sourceCurrencyInfo = currencyMap[settings.currencyInfo.id];
      const targetCurrencyInfo = currencyMap.usd;

      const resp = await this.fetchAccountDeFiPositions({
        accountId,
        networkId,
        accountAddress,
        xpub,
        excludeLowValueProtocols: true,
        sourceCurrencyInfo,
        targetCurrencyInfo,
        // Do NOT use saveToLocal here. The shared `_localDeFiOverviewCache`
        // is keyed only by networkId and the debounced flush writes against
        // the last `accountAddress/xpub` it sees, so concurrent background
        // refreshes for different accounts on the same network — or a
        // background refresh racing with a foreground UI fetch — would
        // overwrite each other's per-account local overview. Write this
        // single account's overview directly below instead.
        saveToLocal: false,
        isForceRefresh: true,
        // Do not share the abort pool: a UI-initiated
        // abortFetchAccountDeFiPositions() must not cancel the scheduled
        // force refresh, which is what delivers the post-tx freshness.
        abortable: false,
      });

      if (accountAddress || xpub) {
        await this.updateAccountsLocalDeFiOverview({
          accountAddress,
          xpub,
          overview: {
            [networkId]: {
              totalValue: this._fixCurrencyValue({
                sourceCurrencyInfo,
                targetCurrencyInfo,
                value: resp.overview.totalValue,
              }).toNumber(),
              totalDebt: this._fixCurrencyValue({
                sourceCurrencyInfo,
                targetCurrencyInfo,
                value: resp.overview.totalDebt,
              }).toNumber(),
              totalReward: this._fixCurrencyValue({
                sourceCurrencyInfo,
                targetCurrencyInfo,
                value: resp.overview.totalReward,
              }).toNumber(),
              netWorth: this._fixCurrencyValue({
                sourceCurrencyInfo,
                targetCurrencyInfo,
                value: resp.overview.netWorth,
              }).toNumber(),
              currency: targetCurrencyInfo?.id ?? '',
            },
          },
          merge: true,
        });
      }

      appEventBus.emit(EAppEventBusNames.DeFiPositionRefreshed, {
        accountId,
        indexedAccountId,
        networkId,
        overview: resp.overview,
        protocols: resp.protocols,
        protocolMap: resp.protocolMap,
      });
    } catch (e) {
      // Swallow so a failed force-refresh does not block future schedules.
      console.error(
        '[ServiceDeFi] force refresh failed',
        { accountId, networkId },
        e,
      );
    }
  }

  @backgroundMethod()
  public async syncDeFiEnabledNetworks() {
    const networkIds = await this.fetchDeFiEnabledNetworks();
    if (isEmpty(networkIds)) {
      return;
    }

    await this.backgroundApi.simpleDb.deFi.updateEnabledNetworksMap({
      enabledNetworksMap: networkIds.reduce(
        (acc, networkId) => {
          acc[networkId] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
    });
  }

  @backgroundMethod()
  public async fetchDeFiEnabledNetworks() {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.get<{
      data: { networkIds: string[] };
    }>('/wallet/v1/portfolio/chains');
    const networkIds = resp.data.data.networkIds ?? [];
    return networkIds;
  }

  @backgroundMethod()
  public async getDeFiEnabledNetworksMap() {
    const existing =
      (await this.backgroundApi.simpleDb.deFi.getEnabledNetworksMap()) ?? {};
    if (!isEmpty(existing)) {
      this.enabledNetworksMapEmptyCacheExpiresAt = 0;
      return existing;
    }

    const now = Date.now();
    if (this.enabledNetworksMapEmptyCacheExpiresAt > now) {
      return existing;
    }

    if (this.ensureEnabledNetworksMapPromise) {
      return this.ensureEnabledNetworksMapPromise;
    }

    this.ensureEnabledNetworksMapPromise = (async () => {
      try {
        await this.syncDeFiEnabledNetworks();
      } catch (error) {
        console.error(error);
      }
      const refreshed =
        await this.backgroundApi.simpleDb.deFi.getEnabledNetworksMap();
      const result = refreshed ?? {};
      if (isEmpty(result)) {
        this.enabledNetworksMapEmptyCacheExpiresAt = Date.now() + 30_000;
      } else {
        this.enabledNetworksMapEmptyCacheExpiresAt = 0;
      }
      return result;
    })().finally(() => {
      this.ensureEnabledNetworksMapPromise = null;
    });

    return this.ensureEnabledNetworksMapPromise;
  }

  @backgroundMethod()
  public async getAccountsLocalDeFiOverview({
    accounts,
    deFiRawData,
    networksEnabledOnly,
  }: {
    accounts: {
      accountId: string;
      networkId: string;
      indexedAccountId?: string;
      accountAddress?: string;
      xpub?: string;
    }[];
    deFiRawData?: IDeFiDBStruct;
    networksEnabledOnly?: boolean;
  }) {
    if (
      accounts[0] &&
      networkUtils.isAllNetwork({ networkId: accounts[0].networkId })
    ) {
      const result: Array<{
        accountId: string;
        networkId: string;
        overview: Record<
          string,
          {
            totalValue: number;
            totalDebt: number;
            totalReward: number;
            netWorth: number;
            currency: string;
          }
        >;
      }> = [];
      const rawData = await this.backgroundApi.simpleDb.deFi.getRawData();
      const CONCURRENCY = 10;
      for (let start = 0; start < accounts.length; start += CONCURRENCY) {
        const batch = accounts.slice(start, start + CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (account, batchIdx) => {
            const idx = start + batchIdx;
            const { accountsInfo } =
              await this.backgroundApi.serviceAllNetwork.getAllNetworkAccounts({
                accountId: account.accountId,
                networkId: account.networkId,
                indexedAccountId: account.indexedAccountId,
                deriveType: undefined,
                nftEnabledOnly: false,
                DeFiEnabledOnly: true,
                excludeTestNetwork: true,
                networksEnabledOnly: isUndefined(networksEnabledOnly)
                  ? !accountUtils.isOthersAccount({
                      accountId: account.accountId,
                    })
                  : networksEnabledOnly,
              });
            let entry: (typeof result)[number] | undefined;
            for (const accountInfo of accountsInfo) {
              const key = accountUtils.buildAccountLocalAssetsKey({
                accountAddress: accountInfo.apiAddress,
                xpub: accountInfo.accountXpub,
              });
              if (rawData?.overview?.[key]) {
                if (!entry) {
                  entry = {
                    accountId: account.accountId,
                    networkId: account.networkId,
                    overview: {
                      [accountInfo.networkId]:
                        rawData.overview[key][accountInfo.networkId],
                    },
                  };
                } else {
                  entry.overview = {
                    ...entry.overview,
                    [accountInfo.networkId]:
                      rawData.overview[key][accountInfo.networkId],
                  };
                }
              }
            }
            return { idx, entry };
          }),
        );
        for (const { idx, entry } of batchResults) {
          if (entry) {
            result[idx] = entry;
          }
        }
      }
      return result;
    }

    return this.backgroundApi.simpleDb.deFi.getAccountsDeFiOverview({
      accounts,
      deFiRawData,
    });
  }

  /**
   * Total DeFi netWorth for an account in `targetCurrency`, summed across
   * networks. Pass `networkId: getNetworkIdsMap().onekeyall` for the
   * cross-network total.
   *
   * Reads only from `simpleDb.deFi` — no network call. `hasCache: false`
   * means no DeFi entries; callers should silently fall back to tokens-only.
   */
  @backgroundMethod()
  async getAccountTotalDeFiNetWorth(params: {
    accountId: string;
    networkId: string;
    targetCurrency: string;
    enabledNetworkIds?: string[];
  }): Promise<{ netWorth: string; hasCache: boolean }> {
    const { accountId, networkId, targetCurrency, enabledNetworkIds } = params;
    const enabledNetworkIdSet = enabledNetworkIds?.length
      ? new Set(enabledNetworkIds)
      : undefined;

    const indexedAccountId = accountUtils.isOthersAccount({ accountId })
      ? undefined
      : accountId;

    const entries = await this.getAccountsLocalDeFiOverview({
      accounts: [{ accountId, networkId, indexedAccountId }],
    });

    if (!entries || !entries.some((e) => e?.overview)) {
      return { netWorth: '0', hasCache: false };
    }

    const { currencyMap } = await currencyPersistAtom.get();
    const targetInfo = currencyMap[targetCurrency] ?? currencyMap.usd;

    let total = new BigNumber(0);
    let hasCache = false;
    for (const entry of entries) {
      if (entry?.overview) {
        for (const [entryNetworkId, overview] of Object.entries(
          entry.overview,
        )) {
          const shouldIncludeNetwork =
            !enabledNetworkIdSet || enabledNetworkIdSet.has(entryNetworkId);
          if (overview && shouldIncludeNetwork) {
            hasCache = true;
            const sourceInfo =
              currencyMap[overview.currency] ?? currencyMap.usd;
            const converted = this._fixCurrencyValue({
              sourceCurrencyInfo: sourceInfo,
              targetCurrencyInfo: targetInfo,
              value: overview.netWorth ?? 0,
            });
            total = total.plus(converted);
          }
        }
      }
    }

    return { netWorth: total.toFixed(), hasCache };
  }

  @backgroundMethod()
  public async updateAccountsLocalDeFiOverview({
    accountAddress,
    xpub,
    overview,
    merge,
  }: {
    accountAddress?: string;
    xpub?: string;
    overview: Record<
      string,
      {
        totalValue: number;
        totalDebt: number;
        totalReward: number;
        netWorth: number;
        currency: string;
      }
    >;
    merge?: boolean;
  }) {
    return this.backgroundApi.simpleDb.deFi.updateAccountDeFiOverview({
      accountAddress,
      xpub,
      overview,
      merge,
    });
  }
}

export default ServiceDeFi;
