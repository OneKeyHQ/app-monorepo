import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';
import type { IEarnAtomData } from '@onekeyhq/shared/types/staking';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

const LEGACY_EARN_AVAILABLE_ASSET_TYPES = new Set<string>([
  EAvailableAssetsTypeEnum.All,
  EAvailableAssetsTypeEnum.StableCoins,
  EAvailableAssetsTypeEnum.NativeTokens,
]);

function sanitizeLegacyEarnData({
  data,
}: {
  data: IEarnAtomData | null | undefined;
}) {
  if (!data?.availableAssetsByType) {
    return {
      changed: false,
      data,
    };
  }

  const nextAvailableAssetsByType = Object.fromEntries(
    Object.entries(data.availableAssetsByType).filter(
      ([type]) => !LEGACY_EARN_AVAILABLE_ASSET_TYPES.has(type),
    ),
  );

  if (
    Object.keys(nextAvailableAssetsByType).length ===
    Object.keys(data.availableAssetsByType).length
  ) {
    return {
      changed: false,
      data,
    };
  }

  return {
    changed: true,
    data: {
      ...data,
      availableAssetsByType: nextAvailableAssetsByType,
    },
  };
}

export class SimpleDbEntityEarn extends SimpleDbEntityBase<IEarnAtomData> {
  entityName = 'earnData';

  override enableCache = false;

  @backgroundMethod()
  async getEarnData() {
    const data = await this.getRawData();
    const sanitized = sanitizeLegacyEarnData({ data });

    if (sanitized.changed && sanitized.data) {
      await this.setRawData(sanitized.data);
    }

    return (
      sanitized.data ?? {
        availableAssetsByType: {},
        earnAccount: {},
      }
    );
  }

  @backgroundMethod()
  async resetEarnData() {
    await this.setRawData({
      availableAssetsByType: {},
      earnAccount: {},
    });
  }
}
