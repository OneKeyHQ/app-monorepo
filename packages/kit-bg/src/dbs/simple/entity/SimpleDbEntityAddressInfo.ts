import type { IAddressInfo } from '@onekeyhq/shared/types/address';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IAddressInfoData {
  data: Record<string, IAddressInfo>; // Record<networkId_address, badge>
}

function buildAddressInfoKey(networkId: string, address: string) {
  return `${networkId}_${address}`;
}

export class SimpleDbEntityAddressInfo extends SimpleDbEntityBase<IAddressInfoData> {
  entityName = 'addressInfo';

  override enableCache = false;

  async updateAddressesInfo({
    data,
    merge,
  }: {
    data: Record<string, IAddressInfo>;
    merge?: boolean;
  }) {
    return this.setRawData((rawData) => {
      if (merge) {
        return {
          ...rawData,
          data: {
            ...rawData?.data,
            ...data,
          },
        };
      }
      return {
        data,
      };
    });
  }

  async getAddressesInfo(): Promise<Record<string, IAddressInfo>> {
    const rawData = await this.getRawData();
    return rawData?.data ?? {};
  }

  async getAddressInfo({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }): Promise<IAddressInfo | undefined> {
    const rawData = await this.getRawData();
    const key = buildAddressInfoKey(networkId, address);
    return rawData?.data?.[key];
  }

  async clearAddressesInfo() {
    return this.setRawData({
      data: {},
    });
  }
}
