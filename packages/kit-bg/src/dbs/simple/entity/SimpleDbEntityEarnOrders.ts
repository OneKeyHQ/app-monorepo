import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IEarnOrderTrackingInfo } from '@onekeyhq/shared/types/staking';
import type { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IEarnOrderItem {
  orderId: string;
  networkId: string;
  txId: string;
  previousTxIds: string[];
  status: EDecodedTxStatus;
  updatedAt: number;
  createdAt: number;
  stakingLabel?: IEarnOrderTrackingInfo['stakingLabel'];
  stakingProtocol?: IEarnOrderTrackingInfo['stakingProtocol'];
  stakingTags?: IEarnOrderTrackingInfo['stakingTags'];
  etherFiSyncStatus?: 'notSent' | 'pending' | 'synced' | 'unknown';
  etherFiAccountId?: string;
}

export interface IEarnOrderDBStructure {
  data: Record<string, IEarnOrderItem>;
  txIdToOrderIdMap: Record<string, string>;
}

export type IAddEarnOrderParams = Omit<
  IEarnOrderItem,
  | 'updatedAt'
  | 'createdAt'
  | 'previousTxIds'
  | 'etherFiSyncStatus'
  | 'etherFiAccountId'
> &
  IEarnOrderTrackingInfo;

export class SimpleDbEntityEarnOrders extends SimpleDbEntityBase<IEarnOrderDBStructure> {
  entityName = 'earnOrders';

  override enableCache = false;

  @backgroundMethod()
  async addOrder(order: IAddEarnOrderParams) {
    await this.setRawData((rawData) => {
      const data: IEarnOrderDBStructure = {
        data: { ...rawData?.data },
        txIdToOrderIdMap: { ...rawData?.txIdToOrderIdMap },
      };
      const now = Date.now();
      data.data[order.orderId] = {
        ...order,
        previousTxIds: [],
        updatedAt: now,
        createdAt: now,
      };
      data.txIdToOrderIdMap[order.txId] = order.orderId;
      return data;
    });
  }

  async addOrderIfAbsent(
    order: IAddEarnOrderParams,
    accountId: string,
  ): Promise<'inserted' | 'existing' | 'conflict' | 'unavailable'> {
    let outcome: 'inserted' | 'existing' | 'conflict' = 'inserted';
    const saved = await this.setRawData((rawData) => {
      const data: IEarnOrderDBStructure = {
        data: { ...rawData?.data },
        txIdToOrderIdMap: { ...rawData?.txIdToOrderIdMap },
      };
      const existing = data.data[order.orderId];
      const mappedOrderId = data.txIdToOrderIdMap[order.txId];
      if (existing || mappedOrderId) {
        outcome =
          existing?.networkId === order.networkId &&
          existing.etherFiAccountId === accountId &&
          existing.txId === order.txId &&
          (!mappedOrderId || mappedOrderId === order.orderId)
            ? 'existing'
            : 'conflict';
        return data;
      }
      const now = Date.now();
      data.data[order.orderId] = {
        ...order,
        previousTxIds: [],
        etherFiSyncStatus: 'notSent',
        etherFiAccountId: accountId,
        updatedAt: now,
        createdAt: now,
      };
      data.txIdToOrderIdMap[order.txId] = order.orderId;
      return data;
    });
    return saved ? outcome : 'unavailable';
  }

  async getUnsentEtherFiOrders({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<IEarnOrderItem[]> {
    const rawData = await this.getRawData();
    return Object.values(rawData?.data ?? {})
      .filter(
        (order) =>
          order.etherFiAccountId === accountId &&
          order.networkId === networkId &&
          order.etherFiSyncStatus === 'notSent',
      )
      .slice(0, 20);
  }

  async updateEtherFiSyncStatus({
    orderId,
    networkId,
    txId,
    status,
  }: {
    orderId: string;
    networkId: string;
    txId: string;
    status: 'notSent' | 'synced' | 'unknown';
  }): Promise<boolean> {
    let updated = false;
    const saved = await this.setRawData((rawData) => {
      const data: IEarnOrderDBStructure = {
        data: { ...rawData?.data },
        txIdToOrderIdMap: { ...rawData?.txIdToOrderIdMap },
      };
      const current = data.data[orderId];
      if (
        current?.networkId === networkId &&
        current.txId === txId &&
        current.etherFiSyncStatus &&
        (current.etherFiSyncStatus !== 'synced' || status === 'synced') &&
        data.txIdToOrderIdMap[txId] === orderId
      ) {
        updated = true;
        data.data[orderId] = { ...current, etherFiSyncStatus: status };
      }
      return data;
    });
    return Boolean(saved && updated);
  }

  async claimEtherFiOrderRetry({
    orderId,
    networkId,
    txId,
  }: {
    orderId: string;
    networkId: string;
    txId: string;
  }): Promise<boolean> {
    let claimed = false;
    const saved = await this.setRawData((rawData) => {
      const data: IEarnOrderDBStructure = {
        data: { ...rawData?.data },
        txIdToOrderIdMap: { ...rawData?.txIdToOrderIdMap },
      };
      const current = data.data[orderId];
      if (
        current?.networkId === networkId &&
        current.txId === txId &&
        current.etherFiSyncStatus === 'notSent' &&
        data.txIdToOrderIdMap[txId] === orderId
      ) {
        claimed = true;
        data.data[orderId] = { ...current, etherFiSyncStatus: 'pending' };
      }
      return data;
    });
    return Boolean(saved && claimed);
  }

  @backgroundMethod()
  async updateOrderStatusByTxId(params: {
    currentTxId: string;
    newTxId?: string;
    status: EDecodedTxStatus;
  }): Promise<{
    success: boolean;
    order?: IEarnOrderItem;
  }> {
    const { currentTxId, newTxId, status } = params;

    await this.setRawData((rawData) => {
      const data: IEarnOrderDBStructure = {
        data: { ...rawData?.data },
        txIdToOrderIdMap: { ...rawData?.txIdToOrderIdMap },
      };

      const orderId = data.txIdToOrderIdMap[currentTxId];
      if (!orderId) {
        return data;
      }

      const order = data.data[orderId];
      if (!order) {
        return data;
      }

      // Update txId related info if new txId exists
      if (newTxId && newTxId !== currentTxId) {
        // Store old txId in history
        const previousTxIds = [...(order.previousTxIds || [])];
        previousTxIds.push(currentTxId);

        // Update txId mapping
        delete data.txIdToOrderIdMap[currentTxId];
        data.txIdToOrderIdMap[newTxId] = orderId;

        // Update order details
        data.data[orderId] = {
          ...order,
          txId: newTxId,
          previousTxIds,
          status,
          ...(order.etherFiSyncStatus
            ? { etherFiSyncStatus: 'unknown' as const }
            : undefined),
          updatedAt: Date.now(),
        };
      } else {
        // Update status only
        data.data[orderId] = {
          ...order,
          status,
          updatedAt: Date.now(),
        };
      }

      return data;
    });

    // Get updated order info
    const updatedOrder = await this.getOrderByTxId(newTxId || currentTxId);
    return {
      success: updatedOrder?.status === status,
      order: updatedOrder,
    };
  }

  @backgroundMethod()
  async getOrderByTxId(txId: string): Promise<IEarnOrderItem | undefined> {
    const rawData = await this.getRawData();
    const orderId = rawData?.txIdToOrderIdMap?.[txId];
    return orderId ? rawData?.data?.[orderId] : undefined;
  }
}
