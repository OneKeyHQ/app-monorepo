import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ENetworkStatus, IServerNetwork } from '@onekeyhq/shared/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ICustomNetworkDBStruct {
  data: Record<
    string,
    IServerNetwork & { createdAt: number; updatedAt: number }
  >;
}

export class SimpleDbEntityCustomNetwork extends SimpleDbEntityBase<ICustomNetworkDBStruct> {
  entityName = 'customNetwork';

  override enableCache = false;

  @backgroundMethod()
  async upsertCustomNetwork(params: { networkInfo: IServerNetwork }) {
    const { networkInfo } = params;
    await this.setRawData(({ rawData }) => {
      const data: ICustomNetworkDBStruct = {
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
  async deleteCustomNetwork(params: { networkId: string }) {
    const { networkId } = params;
    await this.setRawData(({ rawData }) => {
      const data: ICustomNetworkDBStruct = {
        data: { ...(rawData?.data || {}) },
      };
      delete data.data[networkId];
      return data;
    });
  }

  @backgroundMethod()
  async getAllCustomNetworks(): Promise<IServerNetwork[]> {
    const rawData = await this.getRawData();
    return Object.values(rawData?.data || {}).sort(
      (a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0),
    );
  }

  @backgroundMethod()
  async getCustomNetwork(params: { networkId: string }) {
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
      const data: ICustomNetworkDBStruct = {
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
