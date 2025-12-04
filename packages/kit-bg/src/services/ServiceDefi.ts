import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
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
    const { accountId, networkId } = params;
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

    return {
      overview: resp.data.data.data.totals,
      protocols: parsedData.protocols,
      protocolMap: parsedData.protocolMap,
    };
  }
}

export default ServiceDeFi;
