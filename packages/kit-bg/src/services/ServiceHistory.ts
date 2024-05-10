import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EOnChainHistoryTxStatus,
  type IAccountHistoryTx,
  type IFetchAccountHistoryParams,
  type IFetchAccountHistoryResp,
  type IFetchHistoryTxDetailsParams,
  type IFetchHistoryTxDetailsResp,
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
    const { accountId, networkId, tokenIdOnNetwork, onChainHistoryDisabled } =
      params;
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });

    let onChainHistoryTxs: IAccountHistoryTx[] = [];
    let localHistoryConfirmedTxs: IAccountHistoryTx[] = [];

    if (onChainHistoryDisabled) {
      const localHistoryPendingTxs =
        await this.getAccountLocalHistoryPendingTxs({
          networkId,
          accountId,
          tokenIdOnNetwork,
        });

      // TODO: batch fetch confirmed txs
      const confirmedTxs = (
        await Promise.all(
          localHistoryPendingTxs.map((tx) =>
            this.fetchHistoryTxDetails({
              networkId,
              accountAddress,
              txid: tx.decodedTx.txid,
            }),
          ),
        )
      )
        .map((tx) => {
          const confirmedTx = localHistoryPendingTxs.find(
            (t) => t.decodedTx.txid === tx?.data.tx,
          );

          if (confirmedTx) {
            return {
              ...confirmedTx,
              decodedTx: {
                ...confirmedTx.decodedTx,
                status:
                  tx?.data.status === EOnChainHistoryTxStatus.Success
                    ? EDecodedTxStatus.Confirmed
                    : EDecodedTxStatus.Failed,
                isFinal: true,
              },
            };
          }

          return null;
        })
        .filter(Boolean);

      await this.backgroundApi.simpleDb.localHistory.saveLocalHistoryConfirmedTxs(
        confirmedTxs,
      );

      localHistoryConfirmedTxs = await this.getAccountLocalHistoryConfirmedTxs({
        networkId,
        accountId,
        tokenIdOnNetwork,
      });
    } else {
      onChainHistoryTxs = await this.fetchAccountOnChainHistory({
        ...params,
        accountAddress,
      });
    }

    await this.backgroundApi.simpleDb.localHistory.updateLocalHistoryPendingTxs(
      {
        confirmedTxs: localHistoryConfirmedTxs,
        onChainHistoryTxs,
      },
    );

    const localHistoryPendingTxs = await this.getAccountLocalHistoryPendingTxs({
      networkId,
      accountId,
      tokenIdOnNetwork,
    });

    return [
      ...localHistoryPendingTxs,
      ...localHistoryConfirmedTxs,
      ...onChainHistoryTxs,
    ];
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
    try {
      const { networkId, txid, accountAddress } = params;
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
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  @backgroundMethod()
  public async getAccountLocalHistoryPendingTxs(params: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
    limit?: number;
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
  public async getAccountLocalHistoryConfirmedTxs(params: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
    limit?: number;
  }) {
    const { accountId, networkId, tokenIdOnNetwork } = params;
    const localHistoryPendingTxs =
      await this.backgroundApi.simpleDb.localHistory.getAccountLocalHistoryConfirmedTxs(
        {
          networkId,
          accountId,
          tokenIdOnNetwork,
        },
      );

    return localHistoryPendingTxs;
  }

  @backgroundMethod()
  public async saveSendConfirmHistoryTxs(params: {
    networkId: string;
    accountId: string;
    data: ISendTxOnSuccessData;
  }) {
    const { networkId, accountId, data } = params;

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
    await this.saveLocalHistoryPendingTxs({ pendingTxs: [newHistoryTx] });
  }
}

export default ServiceHistory;
