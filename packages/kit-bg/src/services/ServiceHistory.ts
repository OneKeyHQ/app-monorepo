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
  async refreshAccountHistory({
    accountId,
    networkId,
    tokenIdOnNetwork,
  }: {
    accountId: string;
    networkId: string;
    tokenIdOnNetwork?: string;
  }) {
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });
    const [xpub, vaultSettings] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceNetwork.getVaultSettings({
        networkId,
      }),
    ]);
    return this.fetchAccountHistory({
      accountId,
      accountAddress,
      xpub,
      networkId,
      tokenIdOnNetwork,
      onChainHistoryDisabled: vaultSettings.onChainHistoryDisabled,
      saveConfirmedTxsEnabled: vaultSettings.saveConfirmedTxsEnabled,
    });
  }

  @backgroundMethod()
  public async fetchAccountHistory(params: IFetchAccountHistoryParams) {
    const {
      accountId,
      networkId,
      tokenIdOnNetwork,
      onChainHistoryDisabled,
      saveConfirmedTxsEnabled,
      xpub,
    } = params;
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });

    let onChainHistoryTxs: IAccountHistoryTx[] = [];
    let localHistoryConfirmedTxs: IAccountHistoryTx[] = [];

    if (onChainHistoryDisabled || saveConfirmedTxsEnabled) {
      const localHistoryPendingTxs =
        await this.getAccountLocalHistoryPendingTxs({
          networkId,
          accountAddress,
          xpub,
          tokenIdOnNetwork,
        });

      // TODO: batch fetch confirmed txs
      const confirmedTxs = (
        await Promise.all(
          localHistoryPendingTxs.map((tx) =>
            this.fetchHistoryTxDetails({
              accountId,
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
        accountAddress,
        xpub,
        tokenIdOnNetwork,
      });
    }

    if (!onChainHistoryDisabled) {
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
      accountAddress,
      tokenIdOnNetwork,
    });

    if (saveConfirmedTxsEnabled && !onChainHistoryDisabled) {
      localHistoryConfirmedTxs = [];
    }

    return [
      ...localHistoryPendingTxs,
      ...localHistoryConfirmedTxs,
      ...onChainHistoryTxs,
    ];
  }

  @backgroundMethod()
  async buildFetchHistoryListParams(params: {
    accountId: string;
    networkId: string;
    accountAddress: string;
  }) {
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
      if (error.data?.data?.message?.code === 50401) {
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
            accountAddress,
            xpub,
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
      const { networkId, txid, accountAddress, xpub } = params;
      const extraParams = await this.buildFetchHistoryListParams({
        ...params,
        accountAddress: accountAddress || '',
      });
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.get<{ data: IFetchHistoryTxDetailsResp }>(
        '/wallet/v1/account/history/detail',
        {
          params: {
            networkId,
            txid,
            xpub,
            accountAddress,
            ...extraParams,
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
    return this.fetchHistoryTxDetails({
      accountId,
      networkId,
      accountAddress,
      txid,
    });
  }

  @backgroundMethod()
  public async getAccountLocalHistoryPendingTxs(params: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    tokenIdOnNetwork?: string;
    limit?: number;
  }) {
    const { accountAddress, xpub, networkId, tokenIdOnNetwork } = params;
    const localHistoryPendingTxs =
      await this.backgroundApi.simpleDb.localHistory.getAccountLocalHistoryPendingTxs(
        {
          networkId,
          accountAddress,
          xpub,
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
  public async clearLocalHistoryPendingTxs() {
    return this.backgroundApi.simpleDb.localHistory.clearLocalHistoryPendingTxs();
  }

  @backgroundMethod()
  public async clearLocalHistory() {
    return this.backgroundApi.simpleDb.localHistory.clearLocalHistory();
  }

  @backgroundMethod()
  public async getAccountLocalHistoryConfirmedTxs(params: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    tokenIdOnNetwork?: string;
    limit?: number;
  }) {
    const { accountAddress, xpub, networkId, tokenIdOnNetwork } = params;
    const localHistoryPendingTxs =
      await this.backgroundApi.simpleDb.localHistory.getAccountLocalHistoryConfirmedTxs(
        {
          networkId,
          accountAddress,
          xpub,
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
    if (signedTx.stakingInfo) {
      newHistoryTx.stakingInfo = signedTx.stakingInfo;
    }
    await this.saveLocalHistoryPendingTxs({ pendingTxs: [newHistoryTx] });
  }
}

export default ServiceHistory;
