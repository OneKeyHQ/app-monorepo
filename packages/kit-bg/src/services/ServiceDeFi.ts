import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IFetchAccountDeFiPositionsParams,
  IFetchAccountDeFiPositionsResp,
} from '@onekeyhq/shared/types/defi';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceDeFi extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _fetchAccountDeFiPositionsControllers: AbortController[] = [];

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

    if (!accountAddress) {
      accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
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
        const sourceTotalValue = new BigNumber(
          parsedData.protocolMap[
            defiUtils.buildProtocolMapKey({
              protocol: protocol.protocol,
              networkId: protocol.networkId,
            })
          ]?.totalValue ?? 0,
        );

        let targetTotalValue = sourceTotalValue;

        if (
          sourceCurrencyInfo &&
          targetCurrencyInfo &&
          sourceCurrencyInfo?.id !== targetCurrencyInfo?.id
        ) {
          targetTotalValue = sourceTotalValue
            .div(new BigNumber(sourceCurrencyInfo.value))
            .times(new BigNumber(targetCurrencyInfo.value));
        }

        return targetTotalValue.gte(lowValueProtocolsThresholdUsd);
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
}

export default ServiceDeFi;
