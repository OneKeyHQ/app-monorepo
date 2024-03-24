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
import {
  EDecodedTxStatus,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceHistory extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async fetchAccountHistory(params: IFetchAccountHistoryParams) {
    const { accountId, networkId, tokenIdOnNetwork } = params;
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddress({
        accountId,
        networkId,
      });
    const onChainHistoryTxs = await this.fetchAccountOnChainHistory({
      ...params,
      accountAddress,
    });

    await this.backgroundApi.simpleDb.localHistory.updateLocalHistoryPendingTxs(
      onChainHistoryTxs,
    );

    const localHistoryPendingTxs = await this.getAccountLocalHistoryPendingTxs({
      networkId,
      accountId,
      tokenIdOnNetwork,
    });

    return [...localHistoryPendingTxs, ...onChainHistoryTxs];
  }

  @backgroundMethod()
  public async fetchAccountOnChainHistory(params: IFetchAccountHistoryParams) {
    const { accountId, networkId, xpub, tokenIdOnNetwork, accountAddress } =
      params;
    const client = await this.getClient();
    const resp = await client.post<{ data: IFetchAccountHistoryResp }>(
      '/wallet/v1/account/history/list',
      {
        networkId,
        accountAddress,
        xpub,
        tokenAddress: tokenIdOnNetwork,
      },
    );

    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });

    const { data: onChainHistoryTxs, tokens, nfts } = resp.data.data;

    const txs = (
      await Promise.all(
        onChainHistoryTxs.map((tx, index) =>
          vault.buildOnChainHistoryTx({
            accountId,
            networkId,
            onChainHistoryTx: tx,
            tokens,
            nfts,
            index,
          }),
        ),
      )
    ).filter(Boolean);

    return txs;
  }

  @backgroundMethod()
  public async fetchHistoryTxDetails(params: IFetchHistoryTxDetailsParams) {
    const { networkId, txid, accountAddress, status } = params;
    if (status === EDecodedTxStatus.Pending) return;
    const client = await this.getClient();
    const resp = await client.get<{ data: IFetchHistoryTxDetailsResp }>(
      '/wallet/v1/account/history/detail',
      {
        params: {
          networkId,
          txid,
          accountAddress,
        },
      },
    );
    return resp.data.data;
  }

  @backgroundMethod()
  public async getAccountLocalHistoryPendingTxs(params: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
    limit?: number;
    isPending?: boolean;
  }) {
    const { accountId, networkId, tokenIdOnNetwork } = params;
    const localHistoryPendingTxs =
      await this.backgroundApi.simpleDb.localHistory.getAccountLocalHistoryPendingTxs(
        {
          networkId,
          accountId,
          tokenIdOnNetwork,
        },
      );

    return localHistoryPendingTxs;
  }

  @backgroundMethod()
  public async saveLocalHistoryPendingTxs(params: {
    pendingTxs: IAccountHistoryTx[];
  }) {
    const { pendingTxs } = params;

    return this.backgroundApi.simpleDb.localHistory.saveLocalHistoryPendingTxs(
      pendingTxs,
    );
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

    await this.saveLocalHistoryPendingTxs({ pendingTxs: [newHistoryTx] });
  }
}

export default ServiceHistory;
