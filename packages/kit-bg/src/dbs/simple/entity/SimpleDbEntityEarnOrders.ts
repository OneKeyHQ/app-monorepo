import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IEarnOrderTrackingInfo } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IEarnOrderItem {
  orderId: string;
  networkId: string;
  txId: string;
  previousTxIds: string[];
  status: EDecodedTxStatus;
  updatedAt: number;
  createdAt: number;
  // 链上状态与服务端是否接受此哈希独立，避免把关联成功当作交易确认。
  serverSyncStatus?: 'pending' | 'acknowledged' | 'rejected';
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
  'updatedAt' | 'createdAt' | 'previousTxIds' | 'serverSyncStatus'
> &
  IEarnOrderTrackingInfo;

export class SimpleDbEntityEarnOrders extends SimpleDbEntityBase<IEarnOrderDBStructure> {
  entityName = 'earnOrders';

  override enableCache = false;

  /** 保存订单及待同步状态；写入被禁用时返回 undefined，存储失败向上抛出。 */
  @backgroundMethod()
  async addOrder(order: IAddEarnOrderParams) {
    const saved = await this.setRawData((rawData) => {
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
        serverSyncStatus: 'pending',
      };
      data.txIdToOrderIdMap[order.txId] = order.orderId;
      return data;
    });
    return saved?.data[order.orderId];
  }

  /** 按当前哈希保存状态或替换哈希并返回写入快照；订单缺失返回失败，存储错误向上抛出。 */
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

    let updatedOrder: IEarnOrderItem | undefined;
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
      if (!order) {
        return data;
      }

      // 取消交易确认或再次加速都不能恢复为正常 Earn 操作。
      const nextStatus =
        order.status === EDecodedTxStatus.Removed ? order.status : status;

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
          status: nextStatus,
          serverSyncStatus:
            nextStatus === EDecodedTxStatus.Removed ? 'rejected' : 'pending',
          updatedAt: Date.now(),
        };
      } else {
        // Update status only
        data.data[orderId] = {
          ...order,
          status: nextStatus,
          serverSyncStatus:
            order.status === nextStatus || order.serverSyncStatus === 'rejected'
              ? order.serverSyncStatus
              : 'pending',
          updatedAt: Date.now(),
        };
      }

      updatedOrder = data.data[orderId];
      return data;
    });

    return {
      success: Boolean(saved && updatedOrder),
      order: saved ? updatedOrder : undefined,
    };
  }

  @backgroundMethod()
  async getOrderByTxId(txId: string): Promise<IEarnOrderItem | undefined> {
    const rawData = await this.getRawData();
    const orderId = rawData?.txIdToOrderIdMap?.[txId];
    return orderId ? rawData?.data?.[orderId] : undefined;
  }

  /** 返回待同步及缺少同步标记的旧订单；无记录返回空数组，读取失败向上抛出。 */
  @backgroundMethod()
  async getOrdersPendingSync(): Promise<IEarnOrderItem[]> {
    const rawData = await this.getRawData();
    return Object.values(rawData?.data ?? {}).filter(
      (order) =>
        !order.serverSyncStatus || order.serverSyncStatus === 'pending',
    );
  }

  /** 按请求时的订单快照保存服务端结果；哈希或链上状态已变化时忽略，存储失败向上抛出。 */
  @backgroundMethod()
  async setServerSyncResult({
    order,
    serverSyncStatus,
  }: {
    order: IEarnOrderItem;
    serverSyncStatus: 'acknowledged' | 'rejected';
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const data: IEarnOrderDBStructure = {
        data: { ...rawData?.data },
        txIdToOrderIdMap: { ...rawData?.txIdToOrderIdMap },
      };
      const current = data.data[order.orderId];
      if (
        current?.txId === order.txId &&
        current.status === order.status &&
        (!current.serverSyncStatus || current.serverSyncStatus === 'pending')
      ) {
        data.data[order.orderId] = { ...current, serverSyncStatus };
      }
      return data;
    });
  }
}
