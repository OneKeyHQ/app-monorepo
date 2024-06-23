import { unionBy } from 'lodash';

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
    let localHistoryPendingTxs: IAccountHistoryTx[] = [];

    // 1. 拿到本地正在 pending 的交易
    localHistoryPendingTxs = await this.getAccountLocalHistoryPendingTxs({
      networkId,
      accountAddress,
      xpub,
      tokenIdOnNetwork,
    });

    // 2. 查询本地 pending 的交易是否已经被确认

    // 已经被确认的交易
    const confirmedTxs: IAccountHistoryTx[] = [];
    // 仍然是 pending 状态的交易
    const pendingTxs: IAccountHistoryTx[] = [];

    // 查询本地 pending 交易的详情
    const onChainHistoryTxsDetails = await Promise.all(
      localHistoryPendingTxs.map((tx) =>
        this.fetchHistoryTxDetails({
          accountId,
          networkId,
          accountAddress,
          txid: tx.decodedTx.txid,
        }),
      ),
    );

    for (const localHistoryPendingTx of localHistoryPendingTxs) {
      const confirmedTx = onChainHistoryTxsDetails.find(
        (txDetails) =>
          localHistoryPendingTx.decodedTx.txid === txDetails?.data.tx,
      );

      if (confirmedTx) {
        confirmedTxs.push({
          ...localHistoryPendingTx,
          decodedTx: {
            ...localHistoryPendingTx.decodedTx,
            status:
              confirmedTx?.data.status === EOnChainHistoryTxStatus.Success
                ? EDecodedTxStatus.Confirmed
                : EDecodedTxStatus.Failed,
            isFinal: true,
          },
        });
      } else {
        pendingTxs.push(localHistoryPendingTx);
      }
    }

    // 3. 获取本地已经确认的交易

    localHistoryConfirmedTxs = await this.getAccountLocalHistoryConfirmedTxs({
      networkId,
      accountAddress,
      xpub,
      tokenIdOnNetwork,
    });

    // 4. 获取链上的历史记录
    onChainHistoryTxs = await this.fetchAccountOnChainHistory({
      ...params,
      accountAddress,
    });

    // 5. 将刚才查询到的已经确认的交易和本地已经确认的交易和链上的历史记录合并

    // 将本地已经确认的交易和刚才查询到的已经确认的交易合并
    const mergedConfirmedTxs = unionBy(
      [...confirmedTxs, ...localHistoryConfirmedTxs],
      (tx) => tx.id,
    );

    // 将合并后的已经确认的交易和链上的历史记录合并

    // 找出通过历史详情查询已经确认的交易，但是链上历史记录中没有的, 这部分是需要保存的
    let confirmedTxsToSave: IAccountHistoryTx[] = [];
    if (!saveConfirmedTxsEnabled) {
      confirmedTxsToSave = mergedConfirmedTxs.filter(
        (tx) =>
          !onChainHistoryTxs.find(
            (onChainHistoryTx) => onChainHistoryTx.id === tx.id,
          ),
      );
    }
    // 如果有的链需要保存所有的已经确认的交易，那么就不过滤直接保存所有的已确认交易
    else {
      confirmedTxsToSave = mergedConfirmedTxs;
    }

    await this.backgroundApi.simpleDb.localHistory.updateLocalHistoryConfirmedTxs(
      {
        networkId,
        accountAddress,
        xpub,
        txs: confirmedTxsToSave,
      },
    );

    await this.backgroundApi.simpleDb.localHistory.updateLocalHistoryPendingTxs(
      {
        networkId,
        accountAddress,
        xpub,
        pendingTxs,
      },
    );

    // 将本地 pending 的交易，已确认交易和链上的历史记录合并返回
    return unionBy(
      [...pendingTxs, ...mergedConfirmedTxs, ...onChainHistoryTxs],
      (tx) => tx.id,
    );
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
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    pendingTxs: IAccountHistoryTx[];
  }) {
    const { networkId, accountAddress, xpub, pendingTxs } = params;

    return this.backgroundApi.simpleDb.localHistory.saveLocalHistoryPendingTxs({
      networkId,
      accountAddress,
      xpub,
      txs: pendingTxs,
    });
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

    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
    ]);

    await this.saveLocalHistoryPendingTxs({
      networkId,
      accountAddress,
      xpub,
      pendingTxs: [newHistoryTx],
    });
  }
}

export default ServiceHistory;
