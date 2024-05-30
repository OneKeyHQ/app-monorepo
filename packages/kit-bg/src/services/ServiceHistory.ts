import type ILightningVault from '@onekeyhq/kit-bg/src/vaults/impls/lightning/Vault';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { OneKeyServerApiError } from '@onekeyhq/shared/src/errors';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  EOnChainHistoryTxStatus,
  type IAccountHistoryTx,
  type IFetchAccountHistoryParams,
  type IFetchAccountHistoryResp,
  type IFetchHistoryTxDetailsParams,
  type IFetchHistoryTxDetailsResp,
  type IFetchTxDetailsParams,
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
  async buildFetchHistoryListParams(params: IFetchAccountHistoryParams) {
    const { networkId, accountId } = params;
    const vault = await vaultFactory.getVault({ networkId, accountId });
    return vault.buildFetchHistoryListParams(params);
  }

  @backgroundMethod()
  public async fetchAccountOnChainHistory(params: IFetchAccountHistoryParams) {
    const { accountId, networkId, xpub, tokenIdOnNetwork, accountAddress } =
      params;
    const extraParams = await this.buildFetchHistoryListParams(params);
    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    let resp;
    try {
      resp = await client.post<{ data: IFetchAccountHistoryResp }>(
        '/wallet/v1/account/history/list',
        {
          networkId,
          accountAddress,
          xpub,
          tokenAddress: tokenIdOnNetwork,
          ...extraParams,
        },
      );
    } catch (e) {
      const error = e as OneKeyServerApiError;
      // Exchange the token on the first error to ensure subsequent polling requests succeed
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error.data?.data?.code === 50401) {
        // 50401 -> Lightning service special error code
        await (vault as ILightningVault).exchangeToken();
      }
      throw e;
    }

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
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
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
  public async fetchTxDetails({
    accountId,
    networkId,
    txid,
  }: IFetchTxDetailsParams) {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    return this.fetchHistoryTxDetails({ networkId, accountAddress, txid });
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
