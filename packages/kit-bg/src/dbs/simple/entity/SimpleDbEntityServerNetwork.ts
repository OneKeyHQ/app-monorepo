import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ENetworkStatus, IServerNetwork } from '@onekeyhq/shared/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IServerNetworkDBStruct {
  data: Record<
    string,
    IServerNetwork & { createdAt: number; updatedAt: number }
  >;
}

export class SimpleDbEntityServerNetwork extends SimpleDbEntityBase<IServerNetworkDBStruct> {
  entityName = 'ServerNetwork';

  override enableCache = false;

  @backgroundMethod()
  async upsertServerNetwork(params: { networkInfo: IServerNetwork }) {
    const { networkInfo } = params;
    await this.setRawData(({ rawData }) => {
      const data: IServerNetworkDBStruct = {
        data: { ...(rawData?.data || {}) },
      };
      const now = Date.now();
      const existingNetwork = data.data[networkInfo.id];

      data.data[networkInfo.id] = {
        ...networkInfo,
        createdAt: existingNetwork?.createdAt || now,
        updatedAt: now,
      };
      return data;
    });
  }

  @backgroundMethod()
  async deleteServerNetwork(params: { networkId: string }) {
    const { networkId } = params;
    await this.setRawData(({ rawData }) => {
      const data: IServerNetworkDBStruct = {
        data: { ...(rawData?.data || {}) },
      };
      delete data.data[networkId];
      return data;
    });
  }

  @backgroundMethod()
  async getAllServerNetworks(): Promise<IServerNetwork[]> {
    const rawData = await this.getRawData();
    return Object.values(rawData?.data || {}).sort(
      (a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0),
    );
  }

  @backgroundMethod()
  async getServerNetwork(params: { networkId: string }) {
    const { networkId } = params;
    const rawData = await this.getRawData();
    return rawData?.data?.[networkId];
  }

  @backgroundMethod()
  async updateNetworkStatus(params: {
    networkId: string;
    status: ENetworkStatus;
  }) {
    const { networkId, status } = params;
    await this.setRawData(({ rawData }) => {
      const data: IServerNetworkDBStruct = {
        data: { ...(rawData?.data || {}) },
      };
      if (data.data[networkId]) {
        data.data[networkId] = {
          ...data.data[networkId],
          status,
          updatedAt: Date.now(),
        };
      }
      return data;
    });
  }
}
