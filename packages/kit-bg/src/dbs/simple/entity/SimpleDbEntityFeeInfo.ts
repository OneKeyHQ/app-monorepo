import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IFeeInfoDb {
  presetIndex: Record<string, number>; // <networkId, presetIndex>
}

export class SimpleDbEntityFeeInfo extends SimpleDbEntityBase<IFeeInfoDb> {
  entityName = 'feeInfo';

  override enableCache = false;

  @backgroundMethod()
  async updatePresetIndex({
    networkId,
    presetIndex,
  }: {
    networkId: string;
    presetIndex: number;
  }) {
    await this.setRawData(({ rawData }) => {
      const data = rawData?.presetIndex ?? {};
      data[networkId] = presetIndex;
      return {
        ...rawData,
        presetIndex: data,
      };
    });
  }

  @backgroundMethod()
  async getPresetIndex({ networkId }: { networkId: string }) {
    const feeInfo = await this.getRawData();
    return feeInfo?.presetIndex[networkId];
  }
}
