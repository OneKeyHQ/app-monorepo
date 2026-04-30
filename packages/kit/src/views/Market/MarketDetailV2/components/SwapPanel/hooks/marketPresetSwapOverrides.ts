import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

import {
  EMarketPresetKey,
  type EMarketPresetTradeSide,
  type IMarketPresetPriorityFeeOverride,
  type IMarketPresetSavedSettings,
  fetchMarketPresetConfig,
  getMarketPresetNetworkFeeLevel,
  getMarketPresetPriorityFeeOverride,
  normalizeMarketPresetSavedSettings,
  resolveMarketPresetDirectionSettings,
} from './marketPresetSettings';

export type IMarketPresetSwapOverrides = {
  networkFeeLevel: ESwapNetworkFeeLevel;
  customPriorityFee?: IMarketPresetPriorityFeeOverride;
};

export async function loadMarketPresetSwapOverrides({
  networkId,
  tradeSide,
}: {
  networkId: string;
  tradeSide: EMarketPresetTradeSide;
}): Promise<IMarketPresetSwapOverrides | undefined> {
  if (!networkId) {
    return undefined;
  }

  try {
    const [config, savedSettings] = await Promise.all([
      fetchMarketPresetConfig({ networkId }),
      backgroundApiProxy.simpleDb.marketPresetSettings.getSettings({
        networkId,
      }) as Promise<IMarketPresetSavedSettings | undefined>,
    ]);

    const normalized = normalizeMarketPresetSavedSettings({
      config,
      savedSettings,
    });
    const presetKey =
      normalized?.selectedPresetKey ??
      config?.defaultPresetKey ??
      EMarketPresetKey.AUTO;
    const directionSettings = resolveMarketPresetDirectionSettings({
      config,
      savedSettings: normalized,
      presetKey,
      tradeSide,
    });

    return {
      networkFeeLevel: getMarketPresetNetworkFeeLevel(directionSettings),
      customPriorityFee: getMarketPresetPriorityFeeOverride(directionSettings),
    };
  } catch {
    return undefined;
  }
}
