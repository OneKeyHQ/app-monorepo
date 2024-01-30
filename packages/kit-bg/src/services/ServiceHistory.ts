import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IAccountHistoryTx,
  IFetchAccountHistoryParams,
  IFetchAccountHistoryResp,
  IFetchHistoryTxDetailsParams,
  IFetchHistoryTxDetailsResp,
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

    const { data: onChainHistoryTxs, tokens } = resp.data.data;

    const txs = await Promise.all(
      onChainHistoryTxs.map((tx) =>
        vault.buildOnChainHistoryTx({
          accountId,
          networkId,
          onChainHistoryTx: tx,
          tokens,
        }),
      ),
    );

    return txs.filter(Boolean) as IAccountHistoryTx[];
  }

  @backgroundMethod()
  public async fetchHistoryTxDetails(params: IFetchHistoryTxDetailsParams) {
    const client = await this.getClient();
    const resp = await client.get<{ data: IFetchHistoryTxDetailsResp }>(
      '/wallet/v1/account/history/detail',
      {
        params,
      },
    );
    return resp.data.data;
  }
}

export default ServiceHistory;
