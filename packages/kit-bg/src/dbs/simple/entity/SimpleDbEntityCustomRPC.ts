import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ICustomRpcDBStruct {
  data: Record<string, IDBCustomRpc>;
}

export class SimpleDbEntityCustomRpc extends SimpleDbEntityBase<ICustomRpcDBStruct> {
  entityName = 'customRpc';

  override enableCache = false;

  @backgroundMethod()
  async addCustomRpc({ rpcInfo }: { rpcInfo: IDBCustomRpc }) {
    await this.setRawData(({ rawData }) => {
      const data: ICustomRpcDBStruct = {
        data: { ...(rawData?.data || {}) },
      };
      let updatedAt = Date.now();
      if (
        data.data[rpcInfo.networkId]?.updatedAt &&
        data.data[rpcInfo.networkId]?.rpc === rpcInfo.rpc
      ) {
        updatedAt = data.data[rpcInfo.networkId].updatedAt || updatedAt;
      }
      data.data[rpcInfo.networkId] = {
        ...rpcInfo,
        updatedAt,
      };
      return data;
    });
  }

  @backgroundMethod()
  async deleteCustomRpc(networkId: string) {
    await this.setRawData(({ rawData }) => {
      const data: ICustomRpcDBStruct = {
        data: { ...(rawData?.data || {}) },
      };
      delete data.data[networkId];
      return data;
    });
  }

  @backgroundMethod()
  async updateCustomRpcEnabledStatus(params: {
    networkId: string;
    enabled: boolean;
  }): Promise<void> {
    const { networkId, enabled } = params;
    await this.setRawData(({ rawData }) => {
      const data: ICustomRpcDBStruct = {
        data: { ...(rawData?.data || {}) },
      };
      if (data.data[networkId]) {
        data.data[networkId] = {
          ...data.data[networkId],
          enabled,
          updatedAt: Date.now(),
        };
      }
      return data;
    });
  }

  @backgroundMethod()
  async getAllCustomRpc(): Promise<IDBCustomRpc[]> {
    const rawData = await this.getRawData();
    return Object.values(rawData?.data || {}).sort(
      (a, b) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0),
    );
  }

  @backgroundMethod()
  async getCustomRpcForNetwork(
    networkId: string,
  ): Promise<IDBCustomRpc | undefined> {
    const rawData = await this.getRawData();
    return rawData?.data?.[networkId];
  }
}
