import BigNumber from 'bignumber.js';
import { debounce, isEmpty, isUndefined } from 'lodash';

import type { ICurrencyItem } from '@onekeyhq/kit/src/views/Setting/pages/Currency';
import { settingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IFetchAccountDeFiPositionsParams,
  IFetchAccountDeFiPositionsResp,
} from '@onekeyhq/shared/types/defi';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

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
  private readonly _FORCE_REFRESH_OFFSETS_MS = [40_000, 80_000] as const;

  // Per (accountId + networkId) pending timers; newer txs reset the schedule.
  private _deFiForceRefreshTimers = new Map<
    string,
    { timers: ReturnType<typeof setTimeout>[]; scheduledAt: number }
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
    this._fetchAccountDeFiPositionsControllers.push(controller);

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
    const entry = this._deFiForceRefreshTimers.get(key);
    if (!entry) return;
    entry.timers.forEach((t) => clearTimeout(t));
    this._deFiForceRefreshTimers.delete(key);
  }

  @backgroundMethod()
  public async isNetworkDeFiEnabled(networkId: string): Promise<boolean> {
    if (!networkId) return false;
    const enabledMap = await this.getDeFiEnabledNetworksMap();
    return !!enabledMap[networkId];
  }

  @backgroundMethod()
  public async onLocalTxConfirmedForDeFi(payload: {
    accountId: string;
    networkId: string;
    status: EDecodedTxStatus;
    txid?: string;
    accountAddress?: string;
    xpub?: string;
  }) {
    const { accountId, networkId, status } = payload;

    if (!accountId || !networkId) return;

    // Failed txs do not move positions, so no force refresh needed.
    if (status !== EDecodedTxStatus.Confirmed) return;

    // Skip chains that do not support DeFi at all.
    if (!(await this.isNetworkDeFiEnabled(networkId))) return;

    const key = this._buildDeFiForceRefreshKey(accountId, networkId);

    // Coalesce multiple confirmed txs: reset the schedule to the latest one.
    this._cancelDeFiForceRefresh(key);

    const timers = this._FORCE_REFRESH_OFFSETS_MS.map((offset) =>
      setTimeout(() => {
        void this._runDeFiForceRefresh({ accountId, networkId });
      }, offset),
    );

    this._deFiForceRefreshTimers.set(key, {
      timers,
      scheduledAt: Date.now(),
    });
  }

  private async _runDeFiForceRefresh(params: {
    accountId: string;
    networkId: string;
  }) {
    const { accountId, networkId } = params;
    try {
      const [settings, currencyMap] = await Promise.all([
        settingsPersistAtom.get(),
        this.backgroundApi.serviceSetting.getCurrencyMap(),
      ]);
      const sourceCurrencyInfo = currencyMap[settings.currencyInfo.id];
      const targetCurrencyInfo = currencyMap.usd;

      const resp = await this.fetchAccountDeFiPositions({
        accountId,
        networkId,
        excludeLowValueProtocols: true,
        sourceCurrencyInfo,
        targetCurrencyInfo,
        saveToLocal: true,
        isForceRefresh: true,
      });

      appEventBus.emit(EAppEventBusNames.DeFiPositionRefreshed, {
        accountId,
        networkId,
        overview: {
          totalValue: resp.overview.totalValue ?? 0,
          totalDebt: resp.overview.totalDebt ?? 0,
          totalReward: resp.overview.totalReward ?? 0,
          netWorth: resp.overview.netWorth ?? 0,
          chains: resp.overview.chains ?? [],
          protocolCount: resp.overview.protocolCount ?? 0,
          positionCount: resp.overview.positionCount ?? 0,
        },
        protocols: resp.protocols,
        protocolMap: resp.protocolMap,
      });
    } catch (e) {
      // Swallow: do not let a failed force-refresh poison the timer table.
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
