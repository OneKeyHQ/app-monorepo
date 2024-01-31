import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type {
  IAccountHistoryTx,
  IFetchAccountHistoryParams,
  IFetchAccountHistoryResp,
  IFetchHistoryTxDetailsParams,
  IFetchHistoryTxDetailsResp,
} from '@onekeyhq/shared/types/history';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import simpleDb from '../dbs/simple/simpleDb';
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

  @backgroundMethod()
  public async saveLocalHistoryTxs(params: { txs: IAccountHistoryTx[] }) {
    const { txs } = params;
    if (!txs || !txs.length) return;

    return simpleDb.localHistory.saveLocalHistoryTxs(txs);
  }

  @backgroundMethod()
  public async saveSendConfirmHistoryTxs(params: {
    networkId: string;
    accountId: string;
    data: ISendTxOnSuccessData;
    feeInfo?: IFeeInfoUnit | undefined;
  }) {
    const { networkId, accountId, feeInfo, data } = params;

    if (!data || !data.decodedTx) {
      return;
    }

    const { decodedTx, signedTx } = data;

    const vault = await vaultFactory.getVault({ networkId, accountId });
    const newHistoryTx = await vault.buildHistoryTx({
      decodedTx,
      signedTx,
      isSigner: true,
      isLocalCreated: true,
    });
    newHistoryTx.decodedTx.feeInfo = newHistoryTx.decodedTx.feeInfo ?? feeInfo;

    await this.saveLocalHistoryTxs({ txs: [newHistoryTx] });
  }
}

export default ServiceHistory;
