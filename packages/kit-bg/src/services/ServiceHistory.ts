/* eslint-disable @typescript-eslint/no-unused-vars */
import { cloneDeep, isEmpty, isNil, isNumber } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type {
  IFeeInfoUnit,
  IHistoryTx,
} from '@onekeyhq/engine/src/vaults/types';
import { IDecodedTxStatus } from '@onekeyhq/engine/src/vaults/types';
import { setIsPasswordLoadedInVault } from '@onekeyhq/kit/src/store/reducers/data';
import { refreshHistory } from '@onekeyhq/kit/src/store/reducers/refresher';
import type {
  SendConfirmOnSuccessData,
  SendConfirmResendActionInfo,
} from '@onekeyhq/kit/src/views/Send/types';
import { isEvmNetworkId } from '@onekeyhq/kit/src/views/Swap/utils';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceHistory extends ServiceBase {
  // TODO filter erc20 token, filter status
  @backgroundMethod()
  async getLocalHistory({
    networkId,
    accountId,
    tokenIdOnNetwork,
    limit,
    isPending,
  }: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
    limit?: number;
    isPending?: boolean;
  }): Promise<IHistoryTx[]> {
    /*
    {
      pending: [],
      // group by date
      finished: [
        {
          date: '2010-11-01',
          items: [],
        },
      ],
    }
     */

    const { engine, appSelector } = this.backgroundApi;
    const hideScamHistory = appSelector((s) => s.settings.hideScamHistory);
    const vaultSettings = await engine.getVaultSettings(networkId);

    const { items } = await simpleDb.history.getAccountHistory({
      limit: limit ?? HISTORY_CONSTS.GET_LOCAL_LIMIT,
      networkId,
      accountId,
      tokenIdOnNetwork,
      isPending,
    });

    if (!vaultSettings.supportFilterScam || !hideScamHistory) {
      return items;
    }

    const filteredHistory: IHistoryTx[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const isScam = await this.checkIsScamHistoryTx({
        accountId,
        networkId,
        historyTx: items[i],
      });
      if (!isScam) {
        filteredHistory.push(items[i]);
      }
    }
    return filteredHistory;
  }

  async fetchOnChainHistory({
    networkId,
    accountId,
    tokenIdOnNetwork,
    localHistory,
  }: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }) {
    const { engine, servicePassword } = this.backgroundApi;
    const vault = await engine.getVault({ networkId, accountId });
    const vaultSettings = await engine.getVaultSettings(networkId);

    let password;
    let passwordLoadedCallback;

    if (vaultSettings.validationRequired) {
      password = await servicePassword.getPassword();
      passwordLoadedCallback = (isLoaded: boolean) =>
        this.backgroundApi.dispatch(setIsPasswordLoadedInVault(isLoaded));
    }

    debugLogger.http.info('fetchOnChainHistory', {
      networkId,
      accountId,
      tokenIdOnNetwork,
    });

    return vault.fetchOnChainHistory({
      // TODO limit=50
      localHistory,
      tokenIdOnNetwork,
      password,
      passwordLoadedCallback,
    });
  }

  @backgroundMethod()
  async updateHistoryStatus(props: {
    networkId: string;
    accountId: string;
    items: IHistoryTx[];
  }) {
    const { networkId, accountId, items } = props;
    if (!items || !items.length) {
      return;
    }

    const { engine } = this.backgroundApi;
    const vault = await engine.getVault({ networkId, accountId });

    const nonce = await vault.getAccountNonce();
    const statusList = await vault.getTransactionStatuses(
      items.map((item) => item.decodedTx.txid),
    );

    const itemsToUpdate: IHistoryTx[] = [];
    const updateHistoryTxFields = (
      tx: IHistoryTx,
      getCloneUpdateTx: () => IHistoryTx,
      updateFields: {
        status: IDecodedTxStatus;
        isFinal?: boolean;
      },
    ) => {
      if (tx.decodedTx.status !== updateFields.status) {
        getCloneUpdateTx().decodedTx.status = updateFields.status;
      }
      if (!isNil(updateFields.isFinal)) {
        if (tx.decodedTx.isFinal !== updateFields.isFinal) {
          getCloneUpdateTx().decodedTx.isFinal = updateFields.isFinal;
        }
      }
    };
    items.forEach((tx, index) => {
      let newTx: IHistoryTx | undefined;
      const getCloneUpdateTx = (): IHistoryTx => {
        if (!newTx) {
          newTx = cloneDeep(tx);
        }
        return newTx;
      };

      const status = statusList[index];
      if (typeof status !== 'undefined') {
        if (status === TransactionStatus.CONFIRM_AND_SUCCESS) {
          updateHistoryTxFields(tx, getCloneUpdateTx, {
            status: IDecodedTxStatus.Confirmed,
          });
        }
        if (status === TransactionStatus.CONFIRM_BUT_FAILED) {
          updateHistoryTxFields(tx, getCloneUpdateTx, {
            status: IDecodedTxStatus.Failed,
          });
        }
        if (
          status === TransactionStatus.NOT_FOUND ||
          status === TransactionStatus.INVALID
        ) {
          if (isNumber(nonce) && tx.decodedTx.nonce < nonce) {
            updateHistoryTxFields(tx, getCloneUpdateTx, {
              status: IDecodedTxStatus.Dropped,
              isFinal: true, // this TX won't broadcast forever, set isFinal=true
            });
          }
        }
      }

      if (newTx) {
        itemsToUpdate.push(newTx);
      }
    });
    if (itemsToUpdate.length) {
      await this.saveHistoryTx({
        networkId,
        accountId,
        items: itemsToUpdate,
      });
    }
  }

  @backgroundMethod()
  async updateHistoryFee(props: {
    networkId: string;
    accountId: string;
    tx: IHistoryTx;
  }) {
    const { networkId, accountId, tx } = props;
    const { engine } = this.backgroundApi;

    if (tx.decodedTx.totalFeeInNative) return;

    const vault = await engine.getVault({ networkId, accountId });
    const totalFeeInNative = await vault.getTransactionFeeInNative(
      tx.decodedTx.txid,
    );
    if (!isEmpty(totalFeeInNative)) {
      const newTx = cloneDeep(tx);
      newTx.decodedTx.totalFeeInNative = totalFeeInNative;
      this.saveHistoryTx({
        accountId,
        networkId,
        items: [newTx],
      });
    }
  }

  // updatePendingTxs
  @backgroundMethod()
  async refreshPendingHistory({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const txList = await this.getLocalHistory({ networkId, accountId });
    const now = Date.now();
    const pendingTxList = txList.filter(
      (item) =>
        item.decodedTx.status === IDecodedTxStatus.Pending ||
        // both update Dropped tx status at TxHistoryDetailModal
        (item.decodedTx.status === IDecodedTxStatus.Dropped &&
          item.decodedTx.createdAt &&
          item.decodedTx.createdAt >
            now - HISTORY_CONSTS.REFRESH_DROPPED_TX_IN),
    );
    await this.updateHistoryStatus({
      networkId,
      accountId,
      items: pendingTxList,
    });
  }

  // refresh and save history by onChain and pending
  @backgroundMethod()
  async refreshHistory(props: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
    isRefreshPending?: boolean;
  }) {
    const {
      networkId,
      accountId,
      tokenIdOnNetwork,
      isRefreshPending = true,
    } = props;
    if (isRefreshPending) {
      await this.refreshPendingHistory({ networkId, accountId });
    }

    const localHistory = await this.getLocalHistory({
      networkId,
      accountId,
      tokenIdOnNetwork,
    });
    const localFinalHistory = localHistory.filter(
      (item) => item.decodedTx.isFinal,
    );

    // const localHistory: IHistoryTx[] = [];
    // const localFinalHistory: IHistoryTx[] = [];

    const onChainHistory = await this.fetchOnChainHistory({
      networkId,
      accountId,
      localHistory,
      tokenIdOnNetwork,
    });

    // do not save/update isFinal history
    const localIds = localFinalHistory.map((item) => item.id);
    const onChainHistoryToSave = onChainHistory.filter(
      (item) => !localIds.includes(item.id),
    );
    if (onChainHistoryToSave.length) {
      // TODO split pending and final history in DB
      // rename addOrUpdateHistoryTx
      await this.saveHistoryTx({
        networkId,
        accountId,
        items: onChainHistoryToSave,
      });
    }

    // TODO retry getLocalHistory and update localPendingHistory TX status
    // TODO set pending tx to Dropped if nonce < max nonce onChain

    // TODO updatePendingHistory here
    // this.updatePendingHistory()

    // TODO remove other account local final history > 300
    return onChainHistory;
  }

  @backgroundMethod()
  async refreshHistoryUi(): Promise<void> {
    this.backgroundApi.dispatch(refreshHistory());
    return Promise.resolve();
  }

  async saveHistoryTx({
    networkId,
    accountId,
    items,
  }: {
    networkId: string;
    accountId: string;
    items: IHistoryTx[];
  }) {
    if (!items || !items.length) {
      return;
    }

    const { engine } = this.backgroundApi;
    const vault = await engine.getVault({ networkId, accountId });

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await vault.fixHistoryTx(item);
    }
    return simpleDb.history.saveHistoryTx(items);
  }

  @backgroundMethod()
  async getOriginHistoryTxOfCancelTx(
    cancelTx?: IHistoryTx,
  ): Promise<IHistoryTx | undefined> {
    if (!cancelTx || cancelTx?.replacedType !== 'cancel') {
      return undefined;
    }
    let tx: IHistoryTx | undefined = cancelTx;
    while (tx?.replacedPrevId) {
      const id: string | undefined = tx?.replacedPrevId;
      tx = await simpleDb.history.getHistoryById({
        id,
        accountId: cancelTx.decodedTx.accountId,
        networkId: cancelTx.decodedTx.networkId,
      });
      if (tx?.replacedPrevId === id) {
        break;
      }
    }
    return tx;
  }

  @backgroundMethod()
  async saveSendConfirmHistory({
    networkId,
    accountId,
    data,
    resendActionInfo,
    feeInfo,
  }: {
    networkId: string;
    accountId: string;
    data?: SendConfirmOnSuccessData;
    resendActionInfo?: SendConfirmResendActionInfo;
    feeInfo?: IFeeInfoUnit | undefined;
  }) {
    const { engine, servicePassword } = this.backgroundApi;
    if (!data || !data.decodedTx) {
      return;
    }
    const { encodedTx, decodedTx, signedTx } = data;
    const vault = await engine.getVault({ networkId, accountId });
    const newHistoryTx = await vault.buildHistoryTx({
      encodedTx,
      decodedTx,
      signedTx,
      isSigner: true,
      isLocalCreated: true,
    });
    newHistoryTx.decodedTx.feeInfo = newHistoryTx.decodedTx.feeInfo ?? feeInfo;
    if (isEvmNetworkId(networkId)) {
      try {
        newHistoryTx.decodedTx.encodedTxEncrypted =
          newHistoryTx.decodedTx.encodedTxEncrypted ||
          (await servicePassword.encryptByInstanceId(
            JSON.stringify(encodedTx || decodedTx.encodedTx),
          ));
      } catch (error) {
        console.error(error);
      }
    }
    let prevTx: IHistoryTx | undefined;
    if (resendActionInfo && resendActionInfo.replaceHistoryId) {
      prevTx = await simpleDb.history.getHistoryById({
        id: resendActionInfo.replaceHistoryId,
        networkId,
        accountId,
      });
      if (prevTx) {
        // TODO previous Tx Dropped or Removed
        prevTx.decodedTx.status = IDecodedTxStatus.Dropped;
        prevTx.replacedNextId = newHistoryTx.id;

        newHistoryTx.replacedPrevId = prevTx.id;
        newHistoryTx.replacedType = resendActionInfo.type;
        newHistoryTx.decodedTx.interactInfo =
          newHistoryTx.decodedTx.interactInfo || prevTx.decodedTx.interactInfo;
      }
    }

    await this.saveHistoryTx({
      networkId,
      accountId,
      items: prevTx ? [newHistoryTx, prevTx] : [newHistoryTx],
    });
  }

  @backgroundMethod()
  async getTransactionsWithNonce({
    networkId,
    accountId,
    nonce,
  }: {
    networkId: string;
    accountId: string;
    nonce: number;
  }) {
    const historyTxs = await this.getLocalHistory({ networkId, accountId });
    const nonceTxs = historyTxs.filter((tx) => tx.decodedTx.nonce === nonce);
    return nonceTxs;
  }

  @backgroundMethod()
  async queryTransactionNonceStatus({
    networkId,
    accountId,
    nonce,
  }: {
    networkId: string;
    accountId: string;
    nonce: number;
  }): Promise<'pending' | 'failed' | 'sucesss' | 'canceled'> {
    await this.refreshPendingHistory({ networkId, accountId });
    const nonceTxs = await this.getTransactionsWithNonce({
      networkId,
      accountId,
      nonce,
    });
    const statusList = nonceTxs.map((tx) => tx.decodedTx.status);
    if (statusList.includes(IDecodedTxStatus.Confirmed)) {
      const canceledTxs = nonceTxs.filter(
        (tx) =>
          tx.decodedTx.status === IDecodedTxStatus.Confirmed &&
          tx.replacedType === 'cancel',
      );
      if (canceledTxs.length > 0) {
        return 'canceled';
      }
      return 'sucesss';
    }
    if (statusList.includes(IDecodedTxStatus.Failed)) {
      return 'failed';
    }
    // In some cases, there may be no pending state. so we use pending as default tx status
    // if (statusList.includes(IDecodedTxStatus.Pending)) {
    //   return 'pending';
    // }
    return 'pending';
  }

  @backgroundMethod()
  async queryTransactionByTxid({
    networkId,
    accountId,
    txid,
  }: {
    networkId: string;
    accountId: string;
    txid: string;
  }): Promise<'pending' | 'failed' | 'sucesss' | 'canceled'> {
    await this.refreshPendingHistory({ networkId, accountId });
    const historyTxs = await this.getLocalHistory({ networkId, accountId });
    const tx = historyTxs.find((item) => item.decodedTx.txid === txid);
    if (!tx) {
      return 'failed';
    }
    if (tx.decodedTx.status === IDecodedTxStatus.Confirmed) {
      return 'sucesss';
    }
    if (tx.decodedTx.status === IDecodedTxStatus.Failed) {
      return 'failed';
    }
    if (tx.decodedTx.status === IDecodedTxStatus.Dropped) {
      return 'canceled';
    }
    return 'pending';
  }

  @backgroundMethod()
  async checkIsScamHistoryTx({
    accountId,
    networkId,
    historyTx,
  }: {
    accountId: string;
    networkId: string;
    historyTx: IHistoryTx;
  }) {
    const { engine } = this.backgroundApi;
    const vault = await engine.getVault({ networkId, accountId });
    return vault.checkIsScamHistoryTx(historyTx);
  }
}

export default ServiceHistory;
