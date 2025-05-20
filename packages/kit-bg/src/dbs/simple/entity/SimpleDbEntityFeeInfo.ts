import { isNil, omitBy } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IFeeInfoDb {
  presetIndex: Record<string, number>; // <networkId, presetIndex>
  customFeeInfo: Record<
    string,
    {
      enabled: boolean;
      feeInfo: Omit<IFeeInfoUnit, 'common'>;
    }
  >;
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
    await this.setRawData((rawData) => {
      const data = rawData?.presetIndex ?? {};
      data[networkId] = presetIndex;
      return {
        ...rawData,
        customFeeInfo: rawData?.customFeeInfo ?? {},
        presetIndex: data,
      };
    });
  }

  @backgroundMethod()
  async getPresetIndex({ networkId }: { networkId: string }) {
    const feeInfo = await this.getRawData();
    return feeInfo?.presetIndex?.[networkId];
  }

  @backgroundMethod()
  async getCustomFeeInfo({ networkId }: { networkId: string }) {
    const feeInfo = await this.getRawData();

    return feeInfo?.customFeeInfo?.[networkId];
  }

  @backgroundMethod()
  async updateCustomFeeInfo({
    networkId,
    customFeeInfo,
    enabled,
  }: {
    networkId: string;
    enabled: boolean;
    customFeeInfo?: Omit<IFeeInfoUnit, 'common'>;
  }) {
    await this.setRawData((rawData) => {
      return {
        ...rawData,
        presetIndex: rawData?.presetIndex ?? {},
        customFeeInfo: {
          ...(rawData?.customFeeInfo ?? {}),
          [networkId]: {
            enabled,
            feeInfo: customFeeInfo
              ? omitBy(customFeeInfo, isNil)
              : rawData?.customFeeInfo?.[networkId]?.feeInfo ?? {},
          },
        },
      };
    });
  }
}
