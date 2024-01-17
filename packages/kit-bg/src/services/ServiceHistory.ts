import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IAccountHistoryTx,
  IFetchAccountHistoryParams,
  IFetchAccountHistoryResp,
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
    const resp = await client.post<IFetchAccountHistoryResp>(
      '/wallet/v1/account/history/list',
      params,
    );

    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });

    const onChainHistoryTxs = resp.data.data;

    const txGroup: {
      title: string;
      data: IAccountHistoryTx[];
    }[] = [];

    for (let i = 0; i < onChainHistoryTxs.length; i += 1) {
      const { date, items } = onChainHistoryTxs[i];
      const txs = await Promise.all(
        items.map((tx) =>
          vault.buildOnChainHistoryTx({
            accountId,
            networkId,
            onChainHistoryTx: tx,
          }),
        ),
      );
      txGroup.push({
        title: date,
        data: txs.filter(Boolean) as IAccountHistoryTx[],
      });
    }

    return txGroup;
  }
}

export default ServiceHistory;
