import { isEmpty, isNil, uniqBy } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ILocalHistory {
  pendingTxs: IAccountHistoryTx[];
  confirmedTxs: IAccountHistoryTx[];
}

export class SimpleDbEntityLocalHistory extends SimpleDbEntityBase<ILocalHistory> {
  entityName = 'localHistory';

  override enableCache = false;

  @backgroundMethod()
  public async saveLocalHistoryPendingTxs(txs: IAccountHistoryTx[]) {
    return this.saveLocalHistoryTxs({ pendingTxs: txs });
  }

  public async saveLocalHistoryConfirmedTxs(txs: IAccountHistoryTx[]) {
    return this.saveLocalHistoryTxs({ confirmedTxs: txs });
  }

  @backgroundMethod()
  public async saveLocalHistoryTxs({
    pendingTxs,
    confirmedTxs,
  }: {
    pendingTxs?: IAccountHistoryTx[];
    confirmedTxs?: IAccountHistoryTx[];
  }) {
    if (isEmpty(pendingTxs) && isEmpty(confirmedTxs)) return;
    const now = Date.now();
    const rawData = await this.getRawData();

    let finalPendingTxs = rawData?.pendingTxs ?? [];
    let finalConfirmedTxs = rawData?.confirmedTxs ?? [];
    if (pendingTxs) {
      finalPendingTxs = uniqBy(
        [
          ...pendingTxs.map((tx) => ({
            ...tx,
            decodedTx: {
              ...tx.decodedTx,
              createdAt: now,
              updatedAt: now,
            },
          })),
          ...finalPendingTxs,
        ],
        (tx) => tx.id,
      ).filter((tx) => tx.decodedTx.status === EDecodedTxStatus.Pending);
    }

    if (confirmedTxs) {
      finalConfirmedTxs = uniqBy(
        [...confirmedTxs, ...finalConfirmedTxs],
        (tx) => tx.id,
      ).filter((tx) => tx.decodedTx.status !== EDecodedTxStatus.Pending);
    }

    return this.setRawData({
      ...(rawData ?? {}),
      pendingTxs: finalPendingTxs,
      confirmedTxs: finalConfirmedTxs,
    });
  }

  @backgroundMethod()
  public async updateLocalHistoryPendingTxs({
    confirmedTxs,
    onChainHistoryTxs,
  }: {
    confirmedTxs?: IAccountHistoryTx[];
    onChainHistoryTxs?: IAccountHistoryTx[];
  }) {
    if (isEmpty(confirmedTxs) && isEmpty(onChainHistoryTxs)) return;
    const rawData = await this.getRawData();

    const pendingTxs = rawData?.pendingTxs;

    if (!pendingTxs || !pendingTxs.length) return;

    const newPendingTxs: IAccountHistoryTx[] = [];

    for (const tx of pendingTxs) {
      const onChainHistoryTx = onChainHistoryTxs?.find(
        (item) => item.id === tx.id,
      );

      const confirmedTx = confirmedTxs?.find((item) => item.id === tx.id);

      if (!onChainHistoryTx && !confirmedTx) {
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
    networkId: string;
    accountAddress: string;
    xpub?: string;
    tokenIdOnNetwork?: string;
  }) {
    const { accountAddress, xpub, networkId, tokenIdOnNetwork } = params;

    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const pendingTxs = (await this.getRawData())?.pendingTxs || [];

    let accountPendingTxs = this._getAccountLocalHistoryTxs({
      txs: pendingTxs,
      networkId,
      xpub,
      accountAddress,
    });

    accountPendingTxs = this._arrangeLocalTxs({
      txs: accountPendingTxs,
      tokenIdOnNetwork,
    });

    return accountPendingTxs;
  }

  @backgroundMethod()
  public async getAccountLocalHistoryConfirmedTxs(params: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    tokenIdOnNetwork?: string;
  }) {
    const { accountAddress, xpub, networkId, tokenIdOnNetwork } = params;

    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const confirmedTxs = (await this.getRawData())?.confirmedTxs || [];
    let accountConfirmedTxs = this._getAccountLocalHistoryTxs({
      txs: confirmedTxs,
      accountAddress,
      xpub,
      networkId,
    });

    accountConfirmedTxs = this._arrangeLocalTxs({
      txs: accountConfirmedTxs,
      tokenIdOnNetwork,
    });

    return accountConfirmedTxs;
  }

  @backgroundMethod()
  async getPendingNonceList(props: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }): Promise<number[]> {
    const { accountAddress, xpub, networkId } = props;
    const pendingTxs = await this.getAccountLocalHistoryPendingTxs({
      accountAddress,
      xpub,
      networkId,
    });
    const nonceList = pendingTxs.map((tx) => tx.decodedTx.nonce);
    return nonceList || [];
  }

  @backgroundMethod()
  async getMaxPendingNonce(props: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
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

  @backgroundMethod()
  async clearLocalHistoryPendingTxs() {
    return this.setRawData(({ rawData }) => {
      const confirmedTxs = rawData?.confirmedTxs || [];
      return {
        ...(rawData ?? {}),
        pendingTxs: [],
        confirmedTxs,
      };
    });
  }

  @backgroundMethod()
  async clearLocalHistory() {
    return this.setRawData({
      pendingTxs: [],
      confirmedTxs: [],
    });
  }

  _getAccountLocalHistoryTxs(params: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    txs: IAccountHistoryTx[];
  }) {
    const { accountAddress, xpub, networkId, txs } = params;

    if (xpub) {
      return txs.filter(
        (tx) =>
          tx.decodedTx.xpub?.toLowerCase() === xpub.toLowerCase() &&
          tx.decodedTx.networkId === networkId,
      );
    }

    return txs.filter(
      (tx) =>
        tx.decodedTx.owner.toLowerCase() === accountAddress.toLowerCase() &&
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

  _arrangeLocalTxs({
    txs,
    tokenIdOnNetwork,
  }: {
    txs: IAccountHistoryTx[];
    tokenIdOnNetwork?: string;
  }) {
    let result = txs.sort(
      (b, a) =>
        (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
        (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
    );

    if (!isNil(tokenIdOnNetwork)) {
      result = result.filter(
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

    return result;
  }
}
