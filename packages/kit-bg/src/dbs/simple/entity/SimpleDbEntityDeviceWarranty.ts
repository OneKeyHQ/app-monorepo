import type { IDeviceWarrantyInfo } from '@onekeyhq/shared/types/device';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IDeviceWarrantyRecord = {
  // The device certificate (hex DER) the last genuine check read.
  cert: string;
  info?: IDeviceWarrantyInfo;
  checkedAt?: number;
};

export type IDeviceWarrantyData = {
  // Keyed by serial number, the certificate's common name.
  devices: Record<string, IDeviceWarrantyRecord>;
};

export class SimpleDbEntityDeviceWarranty extends SimpleDbEntityBase<IDeviceWarrantyData> {
  entityName = 'deviceWarranty';

  override enableCache = false;

  async getRecord(
    serialNo: string,
  ): Promise<IDeviceWarrantyRecord | undefined> {
    return (await this.getRawData())?.devices?.[serialNo];
  }

  // Read and write in one step, so two writers never drop each other's field.
  async updateRecord(
    serialNo: string,
    update: (prev: IDeviceWarrantyRecord | undefined) => IDeviceWarrantyRecord,
  ): Promise<IDeviceWarrantyRecord | undefined> {
    const data = await this.setRawData((raw) => ({
      devices: {
        ...raw?.devices,
        [serialNo]: update(raw?.devices?.[serialNo]),
      },
    }));
    return data?.devices[serialNo];
  }
}
