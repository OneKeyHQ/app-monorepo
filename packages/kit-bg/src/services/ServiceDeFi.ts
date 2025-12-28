import BigNumber from 'bignumber.js';
import { debounce, isEmpty } from 'lodash';

import type { ICurrencyItem } from '@onekeyhq/kit/src/views/Setting/pages/Currency';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IFetchAccountDeFiPositionsParams,
  IFetchAccountDeFiPositionsResp,
} from '@onekeyhq/shared/types/defi';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import ServiceBase from './ServiceBase';

import type { IDeFiDBStruct } from '../dbs/simple/entity/SimpleDbEntityDeFi';

@backgroundClass()
class ServiceDeFi extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _fetchAccountDeFiPositionsControllers: AbortController[] = [];

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

  @backgroundMethod()
  public async syncDeFiEnabledNetworks() {
    const networkIds = await this.fetchDeFiEnabledNetworks();
    if (isEmpty(networkIds)) {
      return;
    }

    await this.backgroundApi.simpleDb.deFi.updateEnabledNetworksMap({
      enabledNetworksMap: networkIds.reduce((acc, networkId) => {
        acc[networkId] = true;
        return acc;
      }, {} as Record<string, boolean>),
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
    return this.backgroundApi.simpleDb.deFi.getEnabledNetworksMap();
  }

  @backgroundMethod()
  public async getAccountsLocalDeFiOverview({
    accounts,
    deFiRawData,
  }: {
    accounts: {
      accountId: string;
      networkId: string;
      indexedAccountId?: string;
      accountAddress?: string;
      xpub?: string;
    }[];
    deFiRawData?: IDeFiDBStruct;
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
      for (let i = 0; i < accounts.length; i += 1) {
        const account = accounts[i];
        const { accountsInfo } =
          await this.backgroundApi.serviceAllNetwork.getAllNetworkAccounts({
            accountId: account.accountId,
            networkId: account.networkId,
            indexedAccountId: account.indexedAccountId,
            deriveType: undefined,
            nftEnabledOnly: false,
            DeFiEnabledOnly: true,
            excludeTestNetwork: true,
            networksEnabledOnly: !accountUtils.isOthersAccount({
              accountId: account.accountId,
            }),
          });
        for (const accountInfo of accountsInfo) {
          const key = accountUtils.buildAccountLocalAssetsKey({
            accountAddress: accountInfo.apiAddress,
            xpub: accountInfo.accountXpub,
          });
          if (rawData?.overview?.[key]) {
            if (!result[i]) {
              result[i] = {
                accountId: account.accountId,
                networkId: account.networkId,
                overview: {
                  [accountInfo.networkId]:
                    rawData.overview[key][accountInfo.networkId],
                },
              };
            } else {
              result[i].overview = {
                ...(result[i].overview ?? {}),
                [accountInfo.networkId]:
                  rawData.overview[key][accountInfo.networkId],
              };
            }
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
