import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  type IFetchAccountHistoryParams,
  type IFetchAccountHistoryResp,
} from '@onekeyhq/shared/types/history';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceHistory extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async fetchAccountHistory(params: IFetchAccountHistoryParams) {
    const { accountId, networkId } = params;
    const client = await this.getClient();
    const resp = await client.post<{ data: IFetchAccountHistoryResp }>(
      '/wallet/v1/account/history/list',
      params,
    );

    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });

    const onChainHistoryTxs = resp.data.data.data;

    // TODO: move this to refreshHistory and return onChainHistoryTxs directly
    return vault.buildOnChainHistoryTxs({
      accountId,
      networkId,
      onChainHistoryTxs,
      tokens: resp.data.data.tokens,
      localHistoryTxs: [],
    });
  }
}

export default ServiceHistory;
