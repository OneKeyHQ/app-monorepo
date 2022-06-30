/* eslint-disable @typescript-eslint/no-unused-vars */
import { TransactionStatus } from '@onekeyfe/blockchain-libs/dist/types/provider';
import { isNumber } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  IDecodedTxStatus,
  IHistoryTx,
} from '@onekeyhq/engine/src/vaults/types';

import { refreshHistory } from '../../store/reducers/refresher';
import {
  SendConfirmOnSuccessData,
  SendConfirmResendActionInfo,
} from '../../views/Send/types';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceHistory extends ServiceBase {
  // TODO filter erc20 token, filter status
  @backgroundMethod()
  async getLocalHistory({
    networkId,
    accountId,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
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
    const { items } = await simpleDb.history.getAccountHistory({
      limit: 100,
      networkId,
      accountId,
      tokenIdOnNetwork,
    });
    // TODO query limit=100, return limit=50
    return items;
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
    const { engine } = this.backgroundApi;
    const vault = await engine.getVault({ networkId, accountId });
    // TODO limit=50
    return vault.fetchOnChainHistory({
      localHistory,
      tokenIdOnNetwork,
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

    console.log('try updateHistoryStatus >>>>> ', items);
    const nonce = await vault.getAccountNonce();
    const statusList = await engine.providerManager.getTransactionStatuses(
      networkId,
      items.map((item) => item.decodedTx.txid),
    );
    let needsSaveUpdate = false;
    const updateStatus = (tx: IHistoryTx, status: IDecodedTxStatus) => {
      if (tx.decodedTx.status !== status) {
        tx.decodedTx.status = status;
        needsSaveUpdate = true;
      }
    };
    items.forEach((tx, index) => {
      const status = statusList[index];
      if (typeof status !== 'undefined') {
        if (status === TransactionStatus.CONFIRM_AND_SUCCESS) {
          updateStatus(tx, IDecodedTxStatus.Confirmed);
        }
        if (status === TransactionStatus.CONFIRM_BUT_FAILED) {
          updateStatus(tx, IDecodedTxStatus.Failed);
        }
        if (
          status === TransactionStatus.NOT_FOUND ||
          status === TransactionStatus.INVALID
        ) {
          if (isNumber(nonce) && tx.decodedTx.nonce < nonce) {
            updateStatus(tx, IDecodedTxStatus.Dropped);
          }
        }
      }
    });
    if (needsSaveUpdate) {
      await this.saveHistoryTx({
        networkId,
        accountId,
        items,
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
    const fiveMin = 5 * 60 * 1000;
    const pendingTxList = txList.filter(
      (item) =>
        item.decodedTx.status === IDecodedTxStatus.Pending ||
        // both update Dropped tx status at TxHistoryDetailModal
        (item.decodedTx.status === IDecodedTxStatus.Dropped &&
          item.decodedTx.createdAt &&
          item.decodedTx.createdAt > now - fiveMin),
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
    const localHistory2 = await this.getLocalHistory({
      networkId,
      accountId,
    });
    const localPendingHistory = localHistory2.filter(
      (item) => item.decodedTx.status === IDecodedTxStatus.Pending,
    );
    console.log('localPendingHistory', localPendingHistory);

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
  async saveSendConfirmHistory({
    networkId,
    accountId,
    data,
    resendActionInfo,
  }: {
    networkId: string;
    accountId: string;
    data?: SendConfirmOnSuccessData;
    resendActionInfo?: SendConfirmResendActionInfo;
  }) {
    const { engine } = this.backgroundApi;
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
    let prevTx: IHistoryTx | undefined;
    if (resendActionInfo && resendActionInfo.replaceHistoryId) {
      const txList = await this.getLocalHistory({ networkId, accountId });
      prevTx = txList.find(
        (item) => item.id === resendActionInfo.replaceHistoryId,
      );
      if (prevTx) {
        // TODO previous Tx Dropped or Removed
        prevTx.decodedTx.status = IDecodedTxStatus.Dropped;
        prevTx.replacedNextId = newHistoryTx.id;

        newHistoryTx.replacedPrevId = prevTx.id;
        newHistoryTx.replacedType = resendActionInfo.type;
      }
    }

    await this.saveHistoryTx({
      networkId,
      accountId,
      items: prevTx ? [newHistoryTx, prevTx] : [newHistoryTx],
    });
  }
}

export default ServiceHistory;
