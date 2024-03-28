import { isNil, uniqBy } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface ILocalHistory {
  pendingTxs: IAccountHistoryTx[];
}

export class SimpleDbEntityLocalHistory extends SimpleDbEntityBase<ILocalHistory> {
  entityName = 'localHistory';

  override enableCache = false;

  @backgroundMethod()
  public async saveLocalHistoryPendingTxs(txs: IAccountHistoryTx[]) {
    if (!txs || !txs.length) return;
    const now = Date.now();
    const rawData = await this.getRawData();

    let pendingTxs = rawData?.pendingTxs ?? [];

    pendingTxs = uniqBy(
      [
        ...txs.map((tx) => ({
          ...tx,
          decodedTx: {
            ...tx.decodedTx,
            createdAt: now,
            updatedAt: now,
          },
        })),
        ...pendingTxs,
      ],
      (tx) => tx.id,
    ).filter((tx) => tx.decodedTx.status === EDecodedTxStatus.Pending);

    return this.setRawData({
      ...rawData,
      pendingTxs,
    });
  }

  @backgroundMethod()
  public async updateLocalHistoryPendingTxs(
    onChainHistoryTxs: IAccountHistoryTx[],
  ) {
    if (!onChainHistoryTxs || !onChainHistoryTxs.length) return;
    const rawData = await this.getRawData();

    const pendingTxs = rawData?.pendingTxs;

    if (!pendingTxs || !pendingTxs.length) return;

    const newPendingTxs: IAccountHistoryTx[] = [];

    for (const tx of pendingTxs) {
      const onChainHistoryTx = onChainHistoryTxs.find(
        (item) => item.id === tx.id,
      );
      if (
        !onChainHistoryTx ||
        onChainHistoryTx.decodedTx.status === EDecodedTxStatus.Pending
      ) {
        newPendingTxs.push(tx);
      }
    }

    return this.setRawData({
      ...rawData,
      pendingTxs: newPendingTxs,
    });
  }

  @backgroundMethod()
  public async getAccountLocalHistoryPendingTxs(params: {
    accountId: string;
    networkId: string;
    tokenIdOnNetwork?: string;
  }) {
    const { accountId, networkId, tokenIdOnNetwork } = params;
    const pendingTxs = (await this.getRawData())?.pendingTxs || [];
    let accountPendingTxs = this._getAccountLocalHistoryPendingTxs({
      pendingTxs,
      accountId,
      networkId,
    });

    accountPendingTxs.sort(
      (b, a) =>
        (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
        (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
    );

    if (!isNil(tokenIdOnNetwork)) {
      accountPendingTxs = accountPendingTxs.filter(
        (tx) =>
          ([] as IDecodedTxAction[])
            .concat(tx.decodedTx.actions)
            .concat(tx.decodedTx.outputActions || [])
            .filter(
              (action) =>
                action &&
                this._checkIsActionIncludesToken({
                  historyTx: tx,
                  action,
                  tokenIdOnNetwork,
                }),
            ).length > 0,
      );
    }

    return accountPendingTxs;
  }

  @backgroundMethod()
  async getPendingNonceList(props: {
    accountId: string;
    networkId: string;
  }): Promise<number[]> {
    const { accountId, networkId } = props;
    const pendingTxs = await this.getAccountLocalHistoryPendingTxs({
      accountId,
      networkId,
    });
    const nonceList = pendingTxs.map((tx) => tx.decodedTx.nonce);
    return nonceList || [];
  }

  @backgroundMethod()
  async getMaxPendingNonce(props: {
    accountId: string;
    networkId: string;
  }): Promise<number | null> {
    const nonceList = await this.getPendingNonceList(props);
    if (nonceList.length) {
      const nonce = Math.max(...nonceList);
      if (Number.isNaN(nonce) || nonce === Infinity || nonce === -Infinity) {
        return null;
      }
      return nonce;
    }
    return null;
  }

  _getAccountLocalHistoryPendingTxs(params: {
    accountId: string;
    networkId: string;
    pendingTxs: IAccountHistoryTx[];
  }) {
    const { accountId, networkId, pendingTxs } = params;
    return pendingTxs.filter(
      (tx) =>
        tx.decodedTx.accountId === accountId &&
        tx.decodedTx.networkId === networkId,
    );
  }

  _checkIsActionIncludesToken(params: {
    historyTx: IAccountHistoryTx;
    action: IDecodedTxAction;
    tokenIdOnNetwork: string;
  }) {
    const { action, tokenIdOnNetwork, historyTx } = params;

    const { assetTransfer, tokenApprove } = action;

    return (
      assetTransfer?.sends.find(
        (send) => send.tokenIdOnNetwork === tokenIdOnNetwork,
      ) ||
      assetTransfer?.receives.find(
        (receive) => receive.tokenIdOnNetwork === tokenIdOnNetwork,
      ) ||
      tokenApprove?.tokenIdOnNetwork === tokenIdOnNetwork ||
      (historyTx.decodedTx?.tokenIdOnNetwork === tokenIdOnNetwork &&
        tokenIdOnNetwork)
    );
  }
}
