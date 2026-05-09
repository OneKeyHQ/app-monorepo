import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type ESwapNetworkFeeLevel,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

import {
  EMarketPresetKey,
  type EMarketPresetTradeSide,
  type IMarketPresetDirectionSettings,
  type IMarketPresetPriorityFeeOverride,
  type IMarketPresetSavedSettings,
  fetchMarketPresetConfig,
  getMarketPresetNetworkFeeLevel,
  getMarketPresetPriorityFeeOverride,
  isInvalidMarketPresetSlippageSettings,
  normalizeMarketPresetSavedSettings,
  resolveMarketPresetDirectionSettings,
} from './marketPresetSettings';

export type IMarketPresetSwapOverrides = {
  networkFeeLevel: ESwapNetworkFeeLevel;
  customPriorityFee?: IMarketPresetPriorityFeeOverride;
  slippage?: {
    key: ESwapSlippageSegmentKey;
    value?: number;
  };
};

export function buildMarketPresetSwapOverridesFromDirectionSettings(
  directionSettings?: IMarketPresetDirectionSettings,
): IMarketPresetSwapOverrides | undefined {
  if (!directionSettings) {
    return undefined;
  }

  let slippage: IMarketPresetSwapOverrides['slippage'] = {
    key: ESwapSlippageSegmentKey.AUTO,
  };
  if (directionSettings.slippage?.key === ESwapSlippageSegmentKey.CUSTOM) {
    const slippageValue = directionSettings.slippage?.value;
    slippage =
      typeof slippageValue === 'number' &&
      Number.isFinite(slippageValue) &&
      !isInvalidMarketPresetSlippageSettings(directionSettings)
        ? {
            key: ESwapSlippageSegmentKey.CUSTOM,
            value: slippageValue,
          }
        : undefined;
  }

  return {
    networkFeeLevel: getMarketPresetNetworkFeeLevel(directionSettings),
    customPriorityFee: getMarketPresetPriorityFeeOverride(directionSettings),
    slippage,
  };
}

export async function loadMarketPresetSwapOverrides({
  networkId,
  presetKey: presetKeyOverride,
  tradeSide,
}: {
  networkId: string;
  presetKey?: EMarketPresetKey;
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

    if (!config?.enabled) {
      return undefined;
    }

    const normalized = normalizeMarketPresetSavedSettings({
      config,
      savedSettings,
    });
    const presetKey =
      presetKeyOverride ??
      normalized?.selectedPresetKey ??
      config?.defaultPresetKey ??
      EMarketPresetKey.AUTO;
    const directionSettings = resolveMarketPresetDirectionSettings({
      config,
      savedSettings: normalized,
      presetKey,
      tradeSide,
    });

    return buildMarketPresetSwapOverridesFromDirectionSettings(
      directionSettings,
    );
  } catch (error) {
    // Falling back to defaults here is intentional (preset is non-critical),
    // but keep a minimal trace so SimpleDb / config drift is observable in
    // dev/staging instead of disappearing silently.
    console.error(
      '[marketPresetSwapOverrides] failed to load',
      { networkId, tradeSide },
      error,
    );
    return undefined;
  }
}
