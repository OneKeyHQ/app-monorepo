import BigNumber from 'bignumber.js';
import { isEmpty, isEqual, isUndefined } from 'lodash';

import { settingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type {
  IDeFiBuildTransactionParams,
  IDeFiBuildTransactionResp,
  IDeFiEvmTransaction,
  IDeFiOverviewTotals,
  IDeFiProtocol,
  IFetchAccountDeFiPositionsBatchParams,
  IFetchAccountDeFiPositionsParams,
  IFetchAccountDeFiPositionsResp,
  IFetchAccountDeFiPositionsResult,
  IGetSupportedDeFiProtocolsResp,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { currencyPersistAtom } from '../states/jotai/atoms/currency';

import ServiceBase from './ServiceBase';

import type { IDeFiDBStruct } from '../dbs/simple/entity/SimpleDbEntityDeFi';

type IDeFiEnabledNetworksMapState = {
  enabledNetworksMap: Record<string, boolean>;
  isReady: boolean;
};

type IGetDeFiEnabledNetworksMapStateOptions = {
  syncIfEmpty?: boolean;
};

type IDeFiPermitData = NonNullable<IDeFiBuildTransactionResp['permit']>;

type IDeFiBuildTransactionApiResp = {
  tx?: IDeFiEvmTransaction | string;
  approvalTx?: IDeFiEvmTransaction | string;
  orderId?: string;
  permit?: IDeFiPermitData | string;
};

type IManualDeFiForceRefreshConfig = {
  dailyLimit: number;
  minIntervalMs: number;
};

export function buildVisibleDeFiOverview({
  overview,
  protocolMap,
  protocols,
}: {
  overview: IFetchAccountDeFiPositionsResp['data']['totals'];
  protocolMap: Record<string, IProtocolSummary>;
  protocols: IDeFiProtocol[];
}): IFetchAccountDeFiPositionsResp['data']['totals'] {
  const totals = protocols.reduce(
    (result, protocol) => {
      const summary =
        protocolMap[
          defiUtils.buildProtocolMapKey({
            protocol: protocol.protocol,
            networkId: protocol.networkId,
          })
        ];
      if (!summary) {
        return result;
      }
      return {
        totalValue: result.totalValue.plus(summary.totalValue ?? 0),
        totalDebt: result.totalDebt.plus(summary.totalDebt ?? 0),
        totalReward: result.totalReward.plus(summary.totalReward ?? 0),
        netWorth: result.netWorth.plus(summary.netWorth ?? 0),
        positionCount: result.positionCount + (summary.positionCount ?? 0),
      };
    },
    {
      totalValue: new BigNumber(0),
      totalDebt: new BigNumber(0),
      totalReward: new BigNumber(0),
      netWorth: new BigNumber(0),
      positionCount: 0,
    },
  );

  return {
    ...overview,
    totalValue: totals.totalValue.toNumber(),
    totalDebt: totals.totalDebt.toNumber(),
    totalReward: totals.totalReward.toNumber(),
    netWorth: totals.netWorth.toNumber(),
    chains: protocols.length ? overview.chains : [],
    protocolCount: protocols.length,
    positionCount: totals.positionCount,
  };
}

function parseDeFiJsonField<T extends object>({
  fieldName,
  value,
}: {
  fieldName: string;
  value: T | string | undefined;
}): T | undefined {
  if (isUndefined(value)) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return value;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    // Throw a stable local error below so callers do not depend on JSON syntax text.
  }

  throw new OneKeyLocalError(`Invalid DeFi ${fieldName} response`);
}

function normalizeDeFiBuildTransactionResp(
  resp: IDeFiBuildTransactionApiResp,
): IDeFiBuildTransactionResp {
  return {
    orderId: resp.orderId,
    tx: parseDeFiJsonField<IDeFiEvmTransaction>({
      fieldName: 'tx',
      value: resp.tx,
    }),
    approvalTx: parseDeFiJsonField<IDeFiEvmTransaction>({
      fieldName: 'approvalTx',
      value: resp.approvalTx,
    }),
    permit: parseDeFiJsonField<IDeFiPermitData>({
      fieldName: 'permit',
      value: resp.permit,
    }),
  };
}

@backgroundClass()
class ServiceDeFi extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });

    appEventBus.on(EAppEventBusNames.LocalPendingTxConfirmed, (payload) => {
      void this.onLocalTxConfirmedForDeFi(payload);
    });
  }

  _fetchAccountDeFiPositionsControllers: AbortController[] = [];

  // Sorted network sets the backend refused as one array (code 40115), keyed
  // by their joined ids. Such a set goes straight to single-network requests
  // until the entry expires, so a family the backend does not array costs one
  // rejected request per window instead of one per run, and support added on
  // the backend is picked up without a client change.
  private _rejectedMultiChainSets = new Map<string, number>();

  private readonly _rejectedMultiChainSetTtlMs = timerUtils.getTimeDurationMs({
    hour: 1,
  });

  private _isMultiChainSetRejected(key: string) {
    const rejectedAt = this._rejectedMultiChainSets.get(key);
    if (rejectedAt === undefined) {
      return false;
    }
    if (Date.now() - rejectedAt > this._rejectedMultiChainSetTtlMs) {
      this._rejectedMultiChainSets.delete(key);
      return false;
    }
    return true;
  }

  private readonly _manualDeFiForceRefreshDefaultDailyLimit = 50;

  private readonly _manualDeFiForceRefreshDefaultMinIntervalMs = 15_000;

  // Offsets (ms) from a local tx being confirmed at which we force-refresh
  // the DeFi portfolio for that chain. Covers indexer lag after the tx lands.
  private readonly _deFiForceRefreshOffsetsMs = [40_000, 80_000] as const;

  private _deFiForceRefreshTimers = new Map<
    string,
    ReturnType<typeof setTimeout>[]
  >();

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

  private _buildLocalDeFiOverviewEntry({
    overview,
    sourceCurrencyInfo,
    targetCurrencyInfo,
  }: {
    overview: IDeFiOverviewTotals;
    sourceCurrencyInfo?: ICurrencyItem;
    targetCurrencyInfo?: ICurrencyItem;
  }) {
    const fix = (value: number) =>
      this._fixCurrencyValue({
        sourceCurrencyInfo,
        targetCurrencyInfo,
        value,
      }).toNumber();
    return {
      totalValue: fix(overview.totalValue),
      totalDebt: fix(overview.totalDebt),
      totalReward: fix(overview.totalReward),
      netWorth: fix(overview.netWorth),
      currency: targetCurrencyInfo?.id ?? '',
    };
  }

  // The overview is a cache: a failed write must not discard the positions
  // the request already returned.
  private async _saveLocalDeFiOverview(params: {
    accountAddress?: string;
    xpub?: string;
    overview: Record<
      string,
      ReturnType<ServiceDeFi['_buildLocalDeFiOverviewEntry']>
    >;
  }) {
    try {
      await this.updateAccountsLocalDeFiOverview({ ...params, merge: true });
    } catch (error) {
      console.error('[ServiceDeFi] local DeFi overview write failed', error);
    }
  }

  // `meta.queriedNetworkIds` names the networks the backend actually handed
  // to a provider (OK-63882). A requested network it omits was dropped before
  // any fetch (not in the multi-chain allowlist, a capability gap, a provider
  // skip), so its missing positions mean "never looked", not "holds nothing";
  // a queried network with nothing is seeded as an empty bucket. Without the
  // field every requested network counts as queried.
  private _getNotQueriedNetworkIds({
    networkIds,
    resp,
  }: {
    networkIds: string[];
    resp: Pick<IFetchAccountDeFiPositionsResp, 'data' | 'meta'>;
  }) {
    const queriedNetworkIds = resp.meta?.queriedNetworkIds;
    if (!Array.isArray(queriedNetworkIds)) {
      return [];
    }
    const queried = new Set(queriedNetworkIds);
    return networkIds.filter(
      (networkId) =>
        !queried.has(networkId) && !resp.data?.positions?.[networkId],
    );
  }

  private _filterLowValueProtocols({
    protocols,
    protocolMap,
    sourceCurrencyInfo,
    targetCurrencyInfo,
    lowValueProtocolsThresholdUsd,
  }: {
    protocols: IDeFiProtocol[];
    protocolMap: Record<string, IProtocolSummary>;
    sourceCurrencyInfo?: ICurrencyItem;
    targetCurrencyInfo?: ICurrencyItem;
    lowValueProtocolsThresholdUsd: number;
  }) {
    return protocols.filter((protocol) => {
      const sourceTotal =
        protocolMap[
          defiUtils.buildProtocolMapKey({
            protocol: protocol.protocol,
            networkId: protocol.networkId,
          })
        ];
      const toTarget = (value: number) =>
        this._fixCurrencyValue({
          sourceCurrencyInfo,
          targetCurrencyInfo,
          value,
        });
      return (
        toTarget(sourceTotal?.totalValue ?? 0).gte(
          lowValueProtocolsThresholdUsd,
        ) ||
        toTarget(sourceTotal?.totalDebt ?? 0).gte(
          lowValueProtocolsThresholdUsd,
        ) ||
        toTarget(sourceTotal?.totalReward ?? 0).gte(
          lowValueProtocolsThresholdUsd,
        )
      );
    });
  }

  @backgroundMethod()
  public async abortFetchAccountDeFiPositions() {
    this._fetchAccountDeFiPositionsControllers.forEach((controller) => {
      controller.abort();
    });
    this._fetchAccountDeFiPositionsControllers = [];
  }

  private _buildManualDeFiForceRefreshDayKey(now: number) {
    const date = new Date(now);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  @backgroundMethod()
  public async getManualDeFiForceRefreshConfig(): Promise<IManualDeFiForceRefreshConfig> {
    return {
      dailyLimit: this._manualDeFiForceRefreshDefaultDailyLimit,
      minIntervalMs: this._manualDeFiForceRefreshDefaultMinIntervalMs,
    };
  }

  @backgroundMethod()
  public async consumeManualDeFiForceRefreshQuota() {
    const config = await this.getManualDeFiForceRefreshConfig();
    const now = Date.now();
    return this.backgroundApi.simpleDb.deFi.consumeManualForceRefreshQuota({
      dayKey: this._buildManualDeFiForceRefreshDayKey(now),
      now,
      dailyLimit: config.dailyLimit,
      minIntervalMs: config.minIntervalMs,
    });
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
    const indexedAccountId =
      params.indexedAccountId ??
      (
        await this.backgroundApi.serviceAccount.getDBAccountSafe({
          accountId,
        })
      )?.indexedAccountId;

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
      accountId,
      indexedAccountId,
      positions: resp.data.data.data.positions,
      protocolSummaries: resp.data.data.data.protocolSummaries,
    });

    if (excludeLowValueProtocols) {
      parsedData.protocols = this._filterLowValueProtocols({
        protocols: parsedData.protocols,
        protocolMap: parsedData.protocolMap,
        sourceCurrencyInfo,
        targetCurrencyInfo,
        lowValueProtocolsThresholdUsd,
      });
    }

    const overview = excludeLowValueProtocols
      ? buildVisibleDeFiOverview({
          overview: resp.data.data.data.totals,
          protocolMap: parsedData.protocolMap,
          protocols: parsedData.protocols,
        })
      : resp.data.data.data.totals;

    const isNetworkQueried =
      this._getNotQueriedNetworkIds({
        networkIds: [networkId],
        resp: resp.data.data,
      }).length === 0;
    // A network the backend did not query keeps its last cached overview:
    // the empty data returned for it is not a result.
    if (saveToLocal && (accountAddress || xpub) && isNetworkQueried) {
      // Written under this call's own address/xpub. The previous shared,
      // debounced map was keyed by networkId only and flushed under the last
      // caller's address, misfiling other accounts' overviews.
      await this._saveLocalDeFiOverview({
        accountAddress,
        xpub,
        overview: {
          [networkId]: this._buildLocalDeFiOverviewEntry({
            overview,
            sourceCurrencyInfo,
            targetCurrencyInfo,
          }),
        },
      });
    }

    return {
      overview,
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

  // Single-network string requests are not subject to the multi-chain checks
  // (allowlist, client version); one failed network does not fail the rest.
  private async _fetchAccountDeFiPositionsPerNetwork(
    params: IFetchAccountDeFiPositionsBatchParams,
  ): Promise<Array<IFetchAccountDeFiPositionsResult | undefined>> {
    const settled = await promiseAllSettledEnhanced(
      params.networkIds.map((networkId) => async () => {
        const r = await this.fetchAccountDeFiPositions({
          ...params,
          networkId,
        });
        return { ...r, networkId };
      }),
      { continueOnError: true, concurrency: 2 },
    );
    return settled.map((r) =>
      r
        ? {
            networkId: r.networkId,
            overview: r.overview,
            protocols: r.protocols,
            protocolMap: r.protocolMap,
            isSameAllNetworksAccountData: !!r.isSameAllNetworksAccountData,
          }
        : undefined,
    );
  }

  /**
   * One request for up to 10 networks served by the same address/xpub
   * (All Networks fan-out). Returns one entry per `networkIds` element in the
   * same order; `undefined` marks a network whose fallback request failed.
   */
  @backgroundMethod()
  public async fetchAccountDeFiPositionsBatch(
    params: IFetchAccountDeFiPositionsBatchParams,
  ): Promise<Array<IFetchAccountDeFiPositionsResult | undefined>> {
    const {
      accountId,
      networkIds,
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
    if (networkIds.length === 0) {
      return [];
    }

    const isUrlAccount = accountUtils.isUrlAccountFn({ accountId });
    const currentNetworkId = isUrlAccount
      ? this._currentUrlNetworkId
      : this._currentNetworkId;
    const currentAccountId = isUrlAccount
      ? this._currentUrlAccountId
      : this._currentAccountId;
    const isSameAllNetworksAccountData = !!(
      allNetworksAccountId &&
      allNetworksNetworkId &&
      allNetworksAccountId === currentAccountId &&
      allNetworksNetworkId === currentNetworkId
    );

    if (isAllNetworks && currentNetworkId !== getNetworkIdsMap().onekeyall) {
      return networkIds.map((networkId) => ({
        ...defiUtils.getEmptyDeFiData(),
        networkId,
        isSameAllNetworksAccountData: false,
      }));
    }

    const indexedAccountId =
      params.indexedAccountId ??
      (
        await this.backgroundApi.serviceAccount.getDBAccountSafe({
          accountId,
        })
      )?.indexedAccountId;

    let accountAddress = params.accountAddress;
    let xpub = params.xpub;
    if (!accountAddress && !xpub) {
      const [a, x] = await Promise.all([
        this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId: networkIds[0],
        }),
        this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId: networkIds[0],
        }),
      ]);
      accountAddress = a;
      xpub = x;
    }

    const resolvedParams = {
      ...params,
      indexedAccountId,
      accountAddress,
      xpub,
    };
    const multiChainSetKey = networkIds.join(',');
    if (
      networkIds.length > 1 &&
      this._isMultiChainSetRejected(multiChainSetKey)
    ) {
      return this._fetchAccountDeFiPositionsPerNetwork(resolvedParams);
    }

    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const controller = new AbortController();
    if (abortable) {
      this._fetchAccountDeFiPositionsControllers.push(controller);
    }

    let resp: { data: { data: IFetchAccountDeFiPositionsResp } };
    try {
      resp = await client.post<{ data: IFetchAccountDeFiPositionsResp }>(
        '/wallet/v1/portfolio/positions',
        {
          // Contract: one network is a string, several are an array.
          networkId: networkIds.length === 1 ? networkIds[0] : networkIds,
          accountAddress,
          isForceRefresh,
        },
        {
          signal: controller.signal,
          headers:
            await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader(
              { accountId },
            ),
        },
      );
    } catch (error) {
      const code = (error as { code?: number } | undefined)?.code;
      if (code === 13_004 && networkIds.length > 1) {
        // Defensive: the planner never exceeds the limit. Halve and retry once.
        const middle = Math.ceil(networkIds.length / 2);
        const [head, tail] = await Promise.all([
          this.fetchAccountDeFiPositionsBatch({
            ...resolvedParams,
            networkIds: networkIds.slice(0, middle),
          }),
          this.fetchAccountDeFiPositionsBatch({
            ...resolvedParams,
            networkIds: networkIds.slice(middle),
          }),
        ]);
        return [...head, ...tail];
      }
      if (code === 40_115) {
        // The backend does not array this network set (not in its multi-chain
        // allowlist, or an old client): remember it and serve the networks
        // one by one.
        if (networkIds.length > 1) {
          this._rejectedMultiChainSets.set(multiChainSetKey, Date.now());
        }
        return this._fetchAccountDeFiPositionsPerNetwork(resolvedParams);
      }
      if (networkIds.length > 1 && !controller.signal.aborted) {
        // Any other failure of the array request (timeout, 5xx, another
        // business code) would drop every network of the batch at once.
        // Serve them one by one, as each ran before batching, so only the
        // networks that fail on their own are missing. The set is not
        // remembered: the backend did not reject it, the request failed.
        return this._fetchAccountDeFiPositionsPerNetwork(resolvedParams);
      }
      throw error;
    }

    const body = resp.data.data;
    const data = body.data;
    const notQueriedNetworkIds = this._getNotQueriedNetworkIds({
      networkIds,
      resp: body,
    });
    const notQueried = new Set(notQueriedNetworkIds);
    // A single network already went out as the string request the fallback
    // would send: its empty result stands, only the cache write is skipped.
    const refetchNetworkIds = networkIds.length > 1 ? notQueriedNetworkIds : [];
    const refetch = new Set(refetchNetworkIds);
    const results: IFetchAccountDeFiPositionsResult[] = defiUtils
      .splitDeFiPositionsByNetwork({
        accountId,
        indexedAccountId,
        networkIds: networkIds.filter((networkId) => !refetch.has(networkId)),
        positions: data?.positions,
      })
      .map(({ networkId, protocols, protocolMap, overview }) => {
        const visibleProtocols = excludeLowValueProtocols
          ? this._filterLowValueProtocols({
              protocols,
              protocolMap,
              sourceCurrencyInfo,
              targetCurrencyInfo,
              lowValueProtocolsThresholdUsd,
            })
          : protocols;
        const visibleOverview = excludeLowValueProtocols
          ? buildVisibleDeFiOverview({
              overview,
              protocolMap,
              protocols: visibleProtocols,
            })
          : overview;
        return {
          networkId,
          overview: visibleOverview,
          protocols: visibleProtocols,
          protocolMap,
          isSameAllNetworksAccountData,
        };
      });

    const persistedResults = results.filter(
      (result) => !notQueried.has(result.networkId),
    );
    if (saveToLocal && (accountAddress || xpub) && persistedResults.length) {
      await this._saveLocalDeFiOverview({
        accountAddress,
        xpub,
        overview: Object.fromEntries(
          persistedResults.map((result) => [
            result.networkId,
            this._buildLocalDeFiOverviewEntry({
              overview: result.overview,
              sourceCurrencyInfo,
              targetCurrencyInfo,
            }),
          ]),
        ),
      });
    }

    if (refetchNetworkIds.length === 0) {
      return results;
    }
    // The networks the array request did not query are served as string
    // requests, which the backend routes through its single-chain providers;
    // one that fails stays `undefined` and keeps its cached overview.
    const fallbackResults = await this._fetchAccountDeFiPositionsPerNetwork({
      ...resolvedParams,
      networkIds: refetchNetworkIds,
    });
    const resultByNetworkId = new Map<
      string,
      IFetchAccountDeFiPositionsResult | undefined
    >(results.map((result) => [result.networkId, result]));
    fallbackResults.forEach((result, index) => {
      resultByNetworkId.set(refetchNetworkIds[index], result);
    });
    return networkIds.map((networkId) => resultByNetworkId.get(networkId));
  }

  @backgroundMethod()
  public async fetchSupportedDeFiProtocols() {
    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.get<{
      data: IGetSupportedDeFiProtocolsResp;
    }>('/earn/v1/defi/supported-protocols');
    return resp.data.data.protocols ?? [];
  }

  @backgroundMethod()
  public async buildDeFiTransaction(params: IDeFiBuildTransactionParams) {
    const { accountId, ...rest } = params;

    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId: params.networkId,
      });

    const client = await this.getClient(EServiceEndpointEnum.Earn);
    const resp = await client.post<{
      data: IDeFiBuildTransactionApiResp;
    }>('/earn/v1/defi/build-transaction', {
      ...rest,
      accountAddress,
    });
    return normalizeDeFiBuildTransactionResp(resp.data.data);
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

  private _scheduleDeFiForceRefresh(
    key: string,
    params: {
      accountId: string;
      indexedAccountId?: string;
      networkId: string;
    },
  ) {
    // Coalesce multiple refresh triggers: reset the schedule to the latest one.
    this._cancelDeFiForceRefresh(key);

    const maxOffset = Math.max(...this._deFiForceRefreshOffsetsMs);
    const timers = this._deFiForceRefreshOffsetsMs.map((offset) =>
      setTimeout(() => {
        void this._runDeFiForceRefresh(params);
        // After the last scheduled offset fires, drop the Map entry so it
        // does not linger once every timer has run.
        if (offset === maxOffset) {
          this._deFiForceRefreshTimers.delete(key);
        }
      }, offset),
    );

    this._deFiForceRefreshTimers.set(key, timers);
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
    this._scheduleDeFiForceRefresh(key, {
      accountId,
      indexedAccountId,
      networkId,
    });
    return this._runDeFiForceRefresh({
      accountId,
      indexedAccountId,
      networkId,
    });
  }

  private async _runDeFiForceRefresh(params: {
    accountId: string;
    indexedAccountId?: string;
    networkId: string;
  }): Promise<
    IAppEventBusPayload[EAppEventBusNames.DeFiPositionRefreshed] | undefined
  > {
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
        indexedAccountId,
        networkId,
        accountAddress,
        xpub,
        excludeLowValueProtocols: true,
        sourceCurrencyInfo,
        targetCurrencyInfo,
        // Written directly below with this account's address/xpub.
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

      const payload: IAppEventBusPayload[EAppEventBusNames.DeFiPositionRefreshed] =
        {
          accountId,
          indexedAccountId,
          networkId,
          overview: resp.overview,
          protocols: resp.protocols,
          protocolMap: resp.protocolMap,
        };

      appEventBus.emit(EAppEventBusNames.DeFiPositionRefreshed, payload);
      return payload;
    } catch (e) {
      // Swallow so a failed force-refresh does not block future schedules.
      console.error(
        '[ServiceDeFi] force refresh failed',
        { accountId, networkId },
        e,
      );
      return undefined;
    }
  }

  @backgroundMethod()
  public async refreshAccountDeFiPositionsAfterAction(params: {
    accountId: string;
    networkId: string;
  }) {
    const { accountId, networkId } = params;
    if (!accountId || !networkId) return undefined;
    if (!(await this.isNetworkDeFiEnabled(networkId))) return undefined;

    const dbAccount = await this.backgroundApi.serviceAccount.getDBAccountSafe({
      accountId,
    });
    const indexedAccountId = dbAccount?.indexedAccountId;
    const key = this._buildDeFiForceRefreshKey(accountId, networkId);

    // The submitted tx may not be indexed yet, so refresh once immediately
    // for visible feedback and then retry on the existing post-tx schedule.
    this._scheduleDeFiForceRefresh(key, {
      accountId,
      indexedAccountId,
      networkId,
    });

    return this._runDeFiForceRefresh({
      accountId,
      indexedAccountId,
      networkId,
    });
  }

  @backgroundMethod()
  public async syncDeFiEnabledNetworks() {
    const networkIds = await this.fetchDeFiEnabledNetworks();
    if (isEmpty(networkIds)) {
      return;
    }

    const previousMap =
      await this.backgroundApi.simpleDb.deFi.getEnabledNetworksMap();
    const enabledNetworksMap = networkIds.reduce(
      (acc, networkId) => {
        acc[networkId] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );
    await this.backgroundApi.simpleDb.deFi.updateEnabledNetworksMap({
      enabledNetworksMap,
    });

    if (!isEqual(previousMap, enabledNetworksMap)) {
      appEventBus.emit(EAppEventBusNames.DeFiEnabledNetworksChanged, undefined);
    }
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
    const { enabledNetworksMap } = await this.getDeFiEnabledNetworksMapState();
    return enabledNetworksMap;
  }

  @backgroundMethod()
  public async getDeFiEnabledNetworksMapState(
    options?: IGetDeFiEnabledNetworksMapStateOptions,
  ): Promise<IDeFiEnabledNetworksMapState> {
    const existing =
      (await this.backgroundApi.simpleDb.deFi.getEnabledNetworksMap()) ?? {};
    const isReady = !isEmpty(existing);

    if (isReady) {
      void this._syncDeFiEnabledNetworksMapStateWithCache().catch(
        console.error,
      );
      return {
        enabledNetworksMap: existing,
        isReady: true,
      };
    }

    if (options?.syncIfEmpty === false) {
      void this._syncDeFiEnabledNetworksMapStateWithCache().catch(
        console.error,
      );
      return {
        enabledNetworksMap: existing,
        isReady: false,
      };
    }

    try {
      return await this._syncDeFiEnabledNetworksMapStateWithCache();
    } catch (error) {
      console.error(error);
      return {
        enabledNetworksMap: existing,
        isReady: false,
      };
    }
  }

  private _syncDeFiEnabledNetworksMapStateWithCache = cacheUtils.memoizee(
    async (): Promise<IDeFiEnabledNetworksMapState> => {
      await this.syncDeFiEnabledNetworks();
      const enabledNetworksMap =
        (await this.backgroundApi.simpleDb.deFi.getEnabledNetworksMap()) ?? {};
      const isReady = !isEmpty(enabledNetworksMap);
      return {
        enabledNetworksMap,
        isReady,
      };
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
      promise: true,
    },
  );

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
  }): Promise<{
    hasCache: boolean;
    netWorth: string;
    networkIds: string[];
  }> {
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
      return { hasCache: false, netWorth: '0', networkIds: [] };
    }

    const { currencyMap } = await currencyPersistAtom.get();
    const targetInfo = currencyMap[targetCurrency] ?? currencyMap.usd;

    let total = new BigNumber(0);
    let hasCache = false;
    const coveredNetworkIds = new Set<string>();
    for (const entry of entries) {
      if (entry?.overview) {
        for (const [entryNetworkId, overview] of Object.entries(
          entry.overview,
        )) {
          const shouldIncludeNetwork =
            !enabledNetworkIdSet || enabledNetworkIdSet.has(entryNetworkId);
          if (overview && shouldIncludeNetwork) {
            hasCache = true;
            coveredNetworkIds.add(entryNetworkId);
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

    return {
      hasCache,
      netWorth: total.toFixed(),
      networkIds: [...coveredNetworkIds].toSorted(),
    };
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
