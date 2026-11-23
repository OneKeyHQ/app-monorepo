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
}

export interface IEarnOrderDBStructure {
  data: Record<string, IEarnOrderItem>;
  txIdToOrderIdMap: Record<string, string>;
}

export type IAddEarnOrderParams = Omit<
  IEarnOrderItem,
  'updatedAt' | 'createdAt' | 'previousTxIds'
> &
  IEarnOrderTrackingInfo;

export class SimpleDbEntityEarnOrders extends SimpleDbEntityBase<IEarnOrderDBStructure> {
  entityName = 'earnOrders';

  override enableCache = false;

  @backgroundMethod()
  async addOrder(
    order: IAddEarnOrderParams,
    options?: { preserveExistingTx?: boolean },
  ) {
    let preservedExisting = false;
    const saved = await this.setRawData((rawData) => {
      const data: IEarnOrderDBStructure = {
        data: { ...rawData?.data },
        txIdToOrderIdMap: { ...rawData?.txIdToOrderIdMap },
      };
      const existing = data.data[order.orderId];
      const mappedOrderId = data.txIdToOrderIdMap[order.txId];
      if (
        options?.preserveExistingTx &&
        (existing || (mappedOrderId && mappedOrderId !== order.orderId))
      ) {
        preservedExisting = true;
        return data;
      }
      if (
        existing?.networkId === order.networkId &&
        existing.previousTxIds?.includes(order.txId)
      ) {
        return data;
      }
      if (
        existing?.networkId === order.networkId &&
        existing.txId === order.txId &&
        (!mappedOrderId || mappedOrderId === order.orderId)
      ) {
        data.txIdToOrderIdMap[order.txId] = order.orderId;
        data.data[order.orderId] = {
          ...existing,
          stakingLabel: existing.stakingLabel ?? order.stakingLabel,
          stakingProtocol: existing.stakingProtocol ?? order.stakingProtocol,
          stakingTags: order.stakingTags?.length
            ? [
                ...new Set([
                  ...(existing.stakingTags ?? []),
                  ...order.stakingTags,
                ]),
              ]
            : existing.stakingTags,
        };
        return data;
      }
      const now = Date.now();
      if (
        existing &&
        existing.txId !== order.txId &&
        data.txIdToOrderIdMap[existing.txId] === order.orderId
      ) {
        delete data.txIdToOrderIdMap[existing.txId];
      }
      data.data[order.orderId] = {
        ...order,
        previousTxIds:
          existing?.networkId === order.networkId &&
          existing.txId !== order.txId
            ? [...(existing.previousTxIds ?? []), existing.txId]
            : [],
        updatedAt: now,
        createdAt: now,
      };
      data.txIdToOrderIdMap[order.txId] = order.orderId;
      return data;
    });
    if (!saved) return undefined;
    if (preservedExisting) return false;
    const current = saved.data[order.orderId];
    return Boolean(
      current?.networkId === order.networkId &&
      current.txId === order.txId &&
      (!options?.preserveExistingTx ||
        saved.txIdToOrderIdMap[order.txId] === order.orderId),
    );
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

    let updated = false;
    const saved = await this.setRawData((rawData) => {
      const data: IEarnOrderDBStructure = {
        data: { ...rawData?.data },
        txIdToOrderIdMap: { ...rawData?.txIdToOrderIdMap },
      };

      const orderId = data.txIdToOrderIdMap[currentTxId];
      if (!orderId) {
        return data;
      }

      const order = data.data[orderId];
      if (!order || order.txId !== currentTxId) {
        return data;
      }

      if (
        newTxId &&
        newTxId !== currentTxId &&
        data.txIdToOrderIdMap[newTxId] &&
        data.txIdToOrderIdMap[newTxId] !== orderId
      ) {
        return data;
      }
      updated = true;

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

    if (!saved || !updated) return { success: false };

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
    const order = orderId ? rawData?.data?.[orderId] : undefined;
    return order?.txId === txId ? order : undefined;
  }
}
