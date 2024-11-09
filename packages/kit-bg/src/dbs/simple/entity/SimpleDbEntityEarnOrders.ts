import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
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
}

export interface IEarnOrderDBStructure {
  data: Record<string, IEarnOrderItem>;
  txIdToOrderIdMap: Record<string, string>;
}

export type IAddEarnOrderParams = Omit<
  IEarnOrderItem,
  'updatedAt' | 'createdAt' | 'previousTxIds'
>;

export class SimpleDbEntityEarnOrders extends SimpleDbEntityBase<IEarnOrderDBStructure> {
  entityName = 'earnOrders';

  override enableCache = false;

  @backgroundMethod()
  async addOrder(order: IAddEarnOrderParams) {
    await this.setRawData(({ rawData }) => {
      const data: IEarnOrderDBStructure = {
        data: { ...(rawData?.data || {}) },
        txIdToOrderIdMap: { ...(rawData?.txIdToOrderIdMap || {}) },
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

    await this.setRawData(({ rawData }) => {
      const data: IEarnOrderDBStructure = {
        data: { ...(rawData?.data || {}) },
        txIdToOrderIdMap: { ...(rawData?.txIdToOrderIdMap || {}) },
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
