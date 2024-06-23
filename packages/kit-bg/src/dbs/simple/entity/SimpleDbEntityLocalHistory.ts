import { assign, isEmpty, isNil, uniqBy } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { buildLocalHistoryKey } from '@onekeyhq/shared/src/utils/historyUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ILocalHistory {
  pendingTxs: Record<string, IAccountHistoryTx[]>; // Record<networkId_accountAddress/xpub, IAccountHistoryTx[]>
  confirmedTxs: Record<string, IAccountHistoryTx[]>; // Record<networkId_accountAddress/xpub, IAccountHistoryTx[]>
}

export class SimpleDbEntityLocalHistory extends SimpleDbEntityBase<ILocalHistory> {
  entityName = 'localHistory';

  override enableCache = false;

  @backgroundMethod()
  public async saveLocalHistoryPendingTxs({
    networkId,
    accountAddress,
    xpub,
    txs,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    txs: IAccountHistoryTx[];
  }) {
    return this.saveLocalHistoryTxs({
      networkId,
      accountAddress,
      xpub,
      pendingTxs: txs,
    });
  }

  @backgroundMethod()
  public async saveLocalHistoryConfirmedTxs({
    networkId,
    accountAddress,
    xpub,
    txs,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    txs: IAccountHistoryTx[];
  }) {
    return this.saveLocalHistoryTxs({
      networkId,
      accountAddress,
      xpub,
      confirmedTxs: txs,
    });
  }

  @backgroundMethod()
  public async updateLocalHistoryConfirmedTxs({
    networkId,
    accountAddress,
    xpub,
    txs,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    txs: IAccountHistoryTx[];
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const rawData = await this.getRawData();

    if (!txs) return;

    const key = buildLocalHistoryKey({ networkId, accountAddress, xpub });

    if (isEmpty(txs) && isEmpty(rawData?.confirmedTxs[key])) return;

    const pendingTxs = rawData?.pendingTxs || {};

    return this.setRawData({
      ...(rawData ?? {}),
      pendingTxs,
      confirmedTxs: assign({}, rawData?.confirmedTxs, { [key]: txs }),
    });
  }

  @backgroundMethod()
  public async saveLocalHistoryTxs({
    networkId,
    accountAddress,
    xpub,
    pendingTxs,
    confirmedTxs,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    pendingTxs?: IAccountHistoryTx[];
    confirmedTxs?: IAccountHistoryTx[];
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const key = buildLocalHistoryKey({ networkId, accountAddress, xpub });

    if (isEmpty(pendingTxs) && isEmpty(confirmedTxs)) return;
    const now = Date.now();
    const rawData = await this.getRawData();

    let finalPendingTxs = rawData?.pendingTxs[key] ?? [];
    let finalConfirmedTxs = rawData?.confirmedTxs[key] ?? [];

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
      pendingTxs: assign({}, rawData?.pendingTxs, { [key]: finalPendingTxs }),
      confirmedTxs: assign({}, rawData?.confirmedTxs, {
        [key]: finalConfirmedTxs,
      }),
    });
  }

  @backgroundMethod()
  public async updateLocalHistoryPendingTxs({
    networkId,
    accountAddress,
    xpub,
    confirmedTxs,
    onChainHistoryTxs,
    pendingTxs: pendingTxsFromOut,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    confirmedTxs?: IAccountHistoryTx[];
    onChainHistoryTxs?: IAccountHistoryTx[];
    pendingTxs?: IAccountHistoryTx[];
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const key = buildLocalHistoryKey({ networkId, accountAddress, xpub });

    const rawData = await this.getRawData();

    if (pendingTxsFromOut) {
      if (isEmpty(pendingTxsFromOut) && isEmpty(rawData?.pendingTxs[key]))
        return;

      return this.setRawData({
        ...rawData,
        confirmedTxs: rawData?.confirmedTxs || {},
        pendingTxs: assign({}, rawData?.pendingTxs, {
          [key]: pendingTxsFromOut,
        }),
      });
    }

    if (isEmpty(confirmedTxs) && isEmpty(onChainHistoryTxs)) return;

    const pendingTxs = rawData?.pendingTxs?.[key] || [];

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
      confirmedTxs: rawData?.confirmedTxs || {},
      pendingTxs: assign({}, rawData?.pendingTxs, { [key]: newPendingTxs }),
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

    const key = buildLocalHistoryKey({ networkId, accountAddress, xpub });

    let accountPendingTxs = (await this.getRawData())?.pendingTxs[key] ?? [];

    accountPendingTxs = this._arrangeLocalTxs({
      txs: accountPendingTxs,
      tokenIdOnNetwork,
    });

    return accountPendingTxs;
  }

  @backgroundMethod()
  public async getAccountLocalHistoryConfirmedTxs(params: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    tokenIdOnNetwork?: string;
  }) {
    const { accountAddress, xpub, networkId, tokenIdOnNetwork } = params;

    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const key = buildLocalHistoryKey({ networkId, accountAddress, xpub });

    let accountConfirmedTxs =
      (await this.getRawData())?.confirmedTxs[key] || [];

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
      const confirmedTxs = rawData?.confirmedTxs || {};
      return {
        ...(rawData ?? {}),
        pendingTxs: {},
        confirmedTxs,
      };
    });
  }

  @backgroundMethod()
  async clearLocalHistory() {
    return this.setRawData({
      pendingTxs: {},
      confirmedTxs: {},
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
